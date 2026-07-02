import { Hono } from 'hono';
import type { AppEnv } from '../../lib/env.js';
import { json } from '../../lib/env.js';
import { getSessionUser, getSessionUserId, isPremium } from '../../lib/auth.js';
import {
  isNumericCode,
  isValidCustomCode,
  toCodeKey,
  codeMeta,
  type CodeRow,
  MAX_CODES_PER_USER,
  generateCandidates,
  isCodeSegment,
  detectPlatform,
} from '../../lib/codes.js';
import { renderLandingPage } from '../../lib/template.js';
import { invalidateCanonicalCode } from '../../adapters/redis-kv.js';
import { checkRateLimit } from '../../lib/rate-limit.js';

type Ctx = { Variables: { env: AppEnv } };

const CANDIDATE_TTL = 15 * 60;

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function codesRoutes() {
  const app = new Hono<Ctx>();

  app.get('/', async (c) => {
    const env = c.get('env');
    const user = await getSessionUser(c.req.raw, env);
    if (!user) return json({ error: '请先登录' }, 401);

    const { results } = await env.db
      .prepare('SELECT code, name, platform, updated_at, created_at, is_custom FROM codes WHERE user_id = ? ORDER BY created_at')
      .bind(user.id)
      .all<CodeRow>();

    return json({
      codes: results.map((r) => codeMeta(r, env.config.publicHost)),
      max: MAX_CODES_PER_USER,
      host: env.config.publicHost,
      canCustomize: isPremium(user),
      role: user.role,
    });
  });

  app.post('/', async (c) => {
    const env = c.get('env');
    const user = await getSessionUser(c.req.raw, env);
    if (!user) return json({ error: '请先登录' }, 401);

    const form = await c.req.parseBody();
    const customCode = String(form.customCode ?? '').trim();
    const pickedCode = String(form.code ?? '').trim();
    const token = String(form.token ?? '').trim();
    const name = String(form.name ?? '').trim();
    const file = form.file;

    if (!name || name.length > 30) return json({ error: '请填写群名称（30 字以内）' }, 400);
    if (!(file instanceof File)) return json({ error: '缺少二维码 A 图片' }, 400);
    if (file.type !== 'image/png' || file.size === 0 || file.size > 1024 * 1024) {
      return json({ error: '二维码 A 图片无效' }, 400);
    }

    let code: string;
    let isCustom = 0;

    if (customCode) {
      if (!isPremium(user)) return json({ error: '自定义群号为高级会员功能' }, 403);
      if (!isValidCustomCode(customCode)) return json({ error: '自定义群号需 3-10 位字母或数字，且不可使用系统保留字' }, 400);
      code = customCode;
      isCustom = 1;
    } else {
      if (!isNumericCode(pickedCode)) return json({ error: '群号格式不正确' }, 400);
      if (!token) return json({ error: '候选令牌缺失' }, 400);
      const candRaw = await env.kv.get(`cand:${token}`);
      if (!candRaw) return json({ error: '候选码已过期，请重新获取' }, 410);
      const candidates = JSON.parse(candRaw) as string[];
      if (!candidates.includes(pickedCode)) return json({ error: '所选群号不在候选列表中' }, 400);
      code = pickedCode;
    }

    const cnt = await env.db.prepare('SELECT COUNT(*) AS n FROM codes WHERE user_id = ?').bind(user.id).first<{ n: number }>();
    if ((cnt?.n ?? 0) >= MAX_CODES_PER_USER) {
      return json({ error: `每个账号最多创建 ${MAX_CODES_PER_USER} 个群号` }, 403);
    }

    const now = Date.now();
    try {
      await env.db
        .prepare('INSERT INTO codes (code, code_key, user_id, name, created_at, is_custom) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(code, toCodeKey(code), user.id, name, now, isCustom)
        .run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('PRIMARY')) {
        return json({ error: '该群号已被占用（大小写视为相同），请换一个' }, 409);
      }
      console.error('create code failed:', msg);
      return json({ error: '创建失败，请稍后重试' }, 500);
    }

    if (token) await env.kv.delete(`cand:${token}`);

    const fileBuf = Buffer.from(await file.arrayBuffer());
    await env.storage.put(`qr-a/${code}.png`, fileBuf, { contentType: 'image/png' });
    await env.storage.put(
      `pages/${code}.html`,
      renderLandingPage({ code, host: env.config.publicHost, name, platform: null, version: null }),
      { contentType: 'text/html; charset=utf-8' },
    );

    return json(codeMeta({ code, name, platform: null, updated_at: null, created_at: now, is_custom: isCustom }, env.config.publicHost), 201);
  });

  app.get('/candidates', async (c) => {
    const env = c.get('env');
    const userId = await getSessionUserId(c.req.raw, env);
    if (!userId) return json({ error: '请先登录' }, 401);

    const codes = await generateCandidates(env.db, 8);
    const token = crypto.randomUUID();
    await env.kv.put(`cand:${token}`, JSON.stringify(codes), { expirationTtl: CANDIDATE_TTL });
    return json({ token, codes, host: env.config.publicHost });
  });

  app.get('/check', async (c) => {
    const env = c.get('env');
    const user = await getSessionUser(c.req.raw, env);
    if (!user) return json({ error: '请先登录' }, 401);
    if (!isPremium(user)) return json({ error: '自定义群号为高级会员功能' }, 403);

    const code = c.req.query('code')?.trim() ?? '';
    if (!isValidCustomCode(code)) {
      return json({ code, available: false, reason: '需 3-10 位字母或数字，且不可使用系统保留字' });
    }

    const row = await env.db.prepare('SELECT code FROM codes WHERE code_key = ?').bind(toCodeKey(code)).first<{ code: string }>();
    if (row) {
      return json({ code, available: false, reason: `已被占用（现有群号 ${row.code}，大小写视为相同）` });
    }
    return json({ code, available: true });
  });

  app.post('/:code/upload', async (c) => {
    const env = c.get('env');
    const userId = await getSessionUserId(c.req.raw, env);
    if (!userId) return json({ error: '请先登录' }, 401);

    const rl = await checkRateLimit(env.kv, `upload:${userId}`, 20, 3600);
    if (!rl.allowed) return json({ error: '上传过于频繁，请稍后再试' }, 429);

    const segment = c.req.param('code');
    if (!isCodeSegment(segment)) return json({ error: '群号格式不正确' }, 400);

    const row = await env.db
      .prepare('SELECT code, user_id, name FROM codes WHERE code_key = ?')
      .bind(toCodeKey(segment))
      .first<{ code: string; user_id: string; name: string }>();
    if (!row) return json({ error: '群号不存在' }, 404);
    if (row.user_id !== userId) return json({ error: '无权操作该群号' }, 403);

    const form = await c.req.parseBody();
    const groupUrl = String(form.groupUrl ?? '').trim();
    const file = form.file;

    const platform = detectPlatform(groupUrl);
    if (!platform) return json({ error: '仅支持微信群（weixin.qq.com）或飞书群（feishu.cn）二维码' }, 422);
    if (groupUrl.length > 2048) return json({ error: '群链接过长' }, 400);
    if (!(file instanceof File)) return json({ error: '缺少二维码图片' }, 400);
    if (file.type !== 'image/png' || file.size === 0 || file.size > 1024 * 1024) {
      return json({ error: '二维码图片无效（需 PNG 且不超过 1MB）' }, 400);
    }

    const now = Date.now();
    const code = row.code;
    const fileBuf = Buffer.from(await file.arrayBuffer());

    await env.storage.put(`qr-c/${code}.png`, fileBuf, { contentType: 'image/png' });
    await env.storage.put(
      `pages/${code}.html`,
      renderLandingPage({ code, host: env.config.publicHost, name: row.name, platform, version: now }),
      { contentType: 'text/html; charset=utf-8' },
    );
    await env.db
      .prepare('UPDATE codes SET platform = ?, group_url = ?, updated_at = ? WHERE code = ?')
      .bind(platform, groupUrl, now, code)
      .run();

    if (env.config.cdnPurgeUrl) {
      void fetch(env.config.cdnPurgeUrl, { method: 'POST' }).catch(() => {});
    }

    return json({ code, platform, updatedAt: now });
  });

  app.get('/:code', async (c) => {
    const env = c.get('env');
    const r = await ownedCode(c, env);
    if (!r.ok) return r.res;
    return json(codeMeta(r.row, env.config.publicHost));
  });

  app.delete('/:code', async (c) => {
    const env = c.get('env');
    const r = await ownedCode(c, env);
    if (!r.ok) return r.res;
    const code = r.row.code;

    await env.db.prepare('DELETE FROM codes WHERE code = ?').bind(code).run();
    await env.storage.delete([`qr-a/${code}.png`, `qr-c/${code}.png`, `pages/${code}.html`]);
    await invalidateCanonicalCode(env.kv, code, toCodeKey);

    return json({ ok: true, deleted: code });
  });

  return app;
}

async function ownedCode(
  c: { req: { raw: Request; param: (k: string) => string } },
  env: AppEnv,
): Promise<{ ok: true; row: CodeRow & { user_id: string } } | { ok: false; res: Response }> {
  const userId = await getSessionUserId(c.req.raw, env);
  if (!userId) return { ok: false, res: json({ error: '请先登录' }, 401) };

  const segment = c.req.param('code');
  if (!isCodeSegment(segment)) return { ok: false, res: json({ error: '群号格式不正确' }, 400) };

  const row = await env.db
    .prepare('SELECT code, code_key, user_id, name, platform, updated_at, created_at, is_custom FROM codes WHERE code_key = ?')
    .bind(toCodeKey(segment))
    .first<CodeRow & { user_id: string }>();

  if (!row) return { ok: false, res: json({ error: '群号不存在' }, 404) };
  if (row.user_id !== userId) return { ok: false, res: json({ error: '无权操作该群号' }, 403) };
  return { ok: true, row };
}
