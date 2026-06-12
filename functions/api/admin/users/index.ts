import { type Env, json, errorJson } from '../../../../src/lib/env';
import { getSessionUser } from '../../../../src/lib/auth';

/** GET /api/admin/users — 管理员：用户列表（含群号数量） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.request, ctx.env);
  if (!user) return errorJson('请先登录', 401);
  if (user.role !== 'admin') return errorJson('需要管理员权限', 403);

  const { results } = await ctx.env.DB.prepare(
    `SELECT u.id, u.email, u.role, u.created_at, COUNT(c.code) AS code_count
     FROM users u LEFT JOIN codes c ON c.user_id = u.id
     GROUP BY u.id ORDER BY u.created_at`,
  ).all<{ id: string; email: string; role: string; created_at: number; code_count: number }>();

  return json({ users: results, me: user.id });
};
