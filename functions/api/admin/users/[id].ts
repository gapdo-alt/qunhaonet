import { type Env, json, errorJson } from '../../../../src/lib/env';
import { getSessionUser } from '../../../../src/lib/auth';

/** PUT /api/admin/users/{id} — 管理员：调整用户角色（user | premium） */
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const me = await getSessionUser(ctx.request, ctx.env);
  if (!me) return errorJson('请先登录', 401);
  if (me.role !== 'admin') return errorJson('需要管理员权限', 403);

  const targetId = String(ctx.params.id ?? '');
  let body: { role?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const role = body.role;
  if (role !== 'user' && role !== 'premium') {
    return errorJson('角色仅支持 user 或 premium', 400);
  }
  if (targetId === me.id) return errorJson('不能修改自己的角色', 400);

  const target = await ctx.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
    .bind(targetId)
    .first<{ id: string; role: string }>();
  if (!target) return errorJson('用户不存在', 404);
  if (target.role === 'admin') return errorJson('不能修改管理员的角色', 400);

  await ctx.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, targetId).run();
  return json({ ok: true, id: targetId, role });
};
