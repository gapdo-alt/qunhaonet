import { type Env, json, errorJson } from '../../../src/lib/env';
import { verifyPassword, createSession, sessionCookie } from '../../../src/lib/auth';

/** POST /api/auth/login */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: { email?: string; password?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!email || !password) return errorJson('请输入邮箱和密码', 400);

  const user = await ctx.env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return errorJson('邮箱或密码错误', 401);
  }

  const session = await createSession(ctx.env, user.id);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(session) });
};
