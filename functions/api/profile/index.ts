import { type Env, json, errorJson } from '../../../src/lib/env';
import { getSessionUserId } from '../../../src/lib/auth';

/** GET /api/profile — 当前用户资料 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  const row = await ctx.env.DB.prepare('SELECT email, wechat_id, has_wechat_qr FROM users WHERE id = ?')
    .bind(userId)
    .first<{ email: string; wechat_id: string | null; has_wechat_qr: number }>();
  if (!row) return errorJson('用户不存在', 404);

  return json({
    email: row.email,
    wechatId: row.wechat_id,
    hasWechatQr: row.has_wechat_qr === 1,
  });
};

/** PUT /api/profile — 更新微信号 */
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  let body: { wechatId?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const wechatId = String(body.wechatId ?? '').trim();
  if (wechatId.length > 50) return errorJson('微信号过长', 400);

  await ctx.env.DB.prepare('UPDATE users SET wechat_id = ? WHERE id = ?')
    .bind(wechatId || null, userId)
    .run();

  return json({ ok: true });
};
