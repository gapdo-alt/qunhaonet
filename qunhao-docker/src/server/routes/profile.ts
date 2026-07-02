import { Hono } from 'hono';
import type { AppEnv } from '../../lib/env.js';
import { json } from '../../lib/env.js';
import { getSessionUserId } from '../../lib/auth.js';
import { writeHttpMetadata } from '../../adapters/s3-storage.js';
import { CACHE } from '../../lib/cache.js';

type Ctx = { Variables: { env: AppEnv } };

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_SIZE = 2 * 1024 * 1024;

export function profileRoutes() {
  const app = new Hono<Ctx>();

  app.get('/', async (c) => {
    const env = c.get('env');
    const userId = await getSessionUserId(c.req.raw, env);
    if (!userId) return json({ error: '请先登录' }, 401);

    const row = await env.db
      .prepare('SELECT email, wechat_id, has_wechat_qr FROM users WHERE id = ?')
      .bind(userId)
      .first<{ email: string; wechat_id: string | null; has_wechat_qr: number }>();
    if (!row) return json({ error: '用户不存在' }, 404);

    return json({
      email: row.email,
      wechatId: row.wechat_id,
      hasWechatQr: row.has_wechat_qr === 1,
    });
  });

  app.put('/', async (c) => {
    const env = c.get('env');
    const userId = await getSessionUserId(c.req.raw, env);
    if (!userId) return json({ error: '请先登录' }, 401);

    let body: { wechatId?: string };
    try {
      body = await c.req.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const wechatId = String(body.wechatId ?? '').trim();
    if (wechatId.length > 50) return json({ error: '微信号过长' }, 400);

    await env.db.prepare('UPDATE users SET wechat_id = ? WHERE id = ?').bind(wechatId || null, userId).run();
    return json({ ok: true });
  });

  app.post('/wechat-qr', async (c) => {
    const env = c.get('env');
    const userId = await getSessionUserId(c.req.raw, env);
    if (!userId) return json({ error: '请先登录' }, 401);

    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) return json({ error: '缺少文件字段 file' }, 400);
    if (!ALLOWED_TYPES.has(file.type)) return json({ error: '仅支持 PNG / JPEG / WebP 图片' }, 415);
    if (file.size === 0 || file.size > MAX_SIZE) return json({ error: '文件不能超过 2MB' }, 413);

    const buf = Buffer.from(await file.arrayBuffer());
    await env.storage.put(`wechat-qr/${userId}`, buf, { contentType: file.type });
    await env.db.prepare('UPDATE users SET has_wechat_qr = 1 WHERE id = ?').bind(userId).run();

    return json({ ok: true, updatedAt: Date.now() });
  });

  app.get('/wechat-qr', async (c) => {
    const env = c.get('env');
    const userId = await getSessionUserId(c.req.raw, env);
    if (!userId) return json({ error: '请先登录' }, 401);

    const object = await env.storage.get(`wechat-qr/${userId}`);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    writeHttpMetadata(headers, object);
    headers.set('cache-control', CACHE.PRIVATE);
    return new Response(object.body as BodyInit, { headers });
  });

  return app;
}
