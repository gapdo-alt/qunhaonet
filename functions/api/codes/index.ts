import { type Env, json, errorJson } from '../../../src/lib/env';
import { getSessionUserId } from '../../../src/lib/auth';
import { isValidCode, MAX_CODES_PER_USER } from '../../../src/lib/codes';
import { renderLandingPage } from '../../../src/lib/template';

interface CodeRow {
  code: string;
  name: string;
  platform: 'wechat' | 'feishu' | null;
  updated_at: number | null;
  created_at: number;
}

function codeMeta(row: CodeRow, host: string) {
  return {
    code: row.code,
    name: row.name,
    platform: row.platform,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    pageUrl: `https://${host}/${row.code}`,
    imageUrl: `https://${host}/i/${row.code}`,
    qrAUrl: `https://${host}/a/${row.code}`,
    shareText: `群号 ${row.code} Qunhao.net`,
  };
}

/** GET /api/codes — 我的群号列表 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  const { results } = await ctx.env.DB.prepare(
    'SELECT code, name, platform, updated_at, created_at FROM codes WHERE user_id = ? ORDER BY created_at',
  )
    .bind(userId)
    .all<CodeRow>();

  return json({
    codes: results.map((r) => codeMeta(r, ctx.env.PUBLIC_HOST)),
    max: MAX_CODES_PER_USER,
    host: ctx.env.PUBLIC_HOST,
  });
};

/**
 * POST /api/codes — 创建群号（multipart/form-data）
 * 字段：code、token（候选令牌）、name（群名称）、file（浏览器渲染的二维码 A PNG）
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const code = form.get('code');
  const token = form.get('token');
  const name = String(form.get('name') ?? '').trim();
  const file = form.get('file') as unknown as File | string | null;

  if (!isValidCode(code)) return errorJson('群号格式不正确', 400);
  if (typeof token !== 'string' || !token) return errorJson('候选令牌缺失', 400);
  if (!name || name.length > 30) return errorJson('请填写群名称（30 字以内）', 400);
  if (file === null || typeof file === 'string') return errorJson('缺少二维码 A 图片', 400);
  if (file.type !== 'image/png' || file.size === 0 || file.size > 1024 * 1024) {
    return errorJson('二维码 A 图片无效', 400);
  }

  // 校验所选码来自本次发放的候选列表
  const candRaw = await ctx.env.SESSIONS.get(`cand:${token}`);
  if (!candRaw) return errorJson('候选码已过期，请重新获取', 410);
  const candidates = JSON.parse(candRaw) as string[];
  if (!candidates.includes(code)) return errorJson('所选群号不在候选列表中', 400);

  // 每用户上限
  const cnt = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM codes WHERE user_id = ?')
    .bind(userId)
    .first<{ n: number }>();
  if ((cnt?.n ?? 0) >= MAX_CODES_PER_USER) {
    return errorJson(`每个账号最多创建 ${MAX_CODES_PER_USER} 个群号`, 403);
  }

  const now = Date.now();
  try {
    await ctx.env.DB.prepare('INSERT INTO codes (code, user_id, name, created_at) VALUES (?, ?, ?, ?)')
      .bind(code, userId, name, now)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE') || msg.includes('PRIMARY')) {
      return errorJson('该群号刚被他人占用，请重新选择', 409);
    }
    if (msg.includes('no column') || msg.includes('has no column')) {
      return errorJson('数据库未升级到 v2，请执行 npm run db:init:remote 后重新部署', 503);
    }
    console.error('create code failed:', msg);
    return errorJson('创建失败，请稍后重试', 500);
  }

  ctx.waitUntil(ctx.env.SESSIONS.delete(`cand:${token}`));

  // 二维码 A（永久不变）+ 占位展示页
  await ctx.env.QR_BUCKET.put(`qr-a/${code}.png`, file.stream(), {
    httpMetadata: { contentType: 'image/png' },
  });
  await ctx.env.QR_BUCKET.put(
    `pages/${code}.html`,
    renderLandingPage({ code, host: ctx.env.PUBLIC_HOST, name, platform: null, version: null }),
    { httpMetadata: { contentType: 'text/html; charset=utf-8' } },
  );

  return json(
    codeMeta({ code, name, platform: null, updated_at: null, created_at: now }, ctx.env.PUBLIC_HOST),
    201,
  );
};
