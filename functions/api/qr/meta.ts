import { type Env, json, errorJson } from '../../../src/lib/env';
import { getSessionUserId } from '../../../src/lib/auth';

/** GET /api/qr/meta — 当前登录用户的群号信息与两类外链 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  const row = await ctx.env.DB.prepare(
    'SELECT code, content_type, updated_at, created_at FROM codes WHERE user_id = ?',
  )
    .bind(userId)
    .first<{ code: string; content_type: string | null; updated_at: number | null; created_at: number }>();

  if (!row) return errorJson('账号未绑定群号', 404);

  const host = ctx.env.PUBLIC_HOST;
  return json({
    code: row.code,
    hasImage: row.updated_at != null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    pageUrl: `https://${host}/${row.code}`,
    imageUrl: `https://${host}/i/${row.code}`,
  });
};
