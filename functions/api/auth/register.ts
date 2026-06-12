import { type Env, json, errorJson } from '../../../src/lib/env';
import { hashPassword, createSession, sessionCookie } from '../../../src/lib/auth';

interface RegisterBody {
  email?: string;
  password?: string;
  turnstileToken?: string;
}

async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip ?? undefined }),
  });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

/** POST /api/auth/register — 注册账号（群号在控制台单独创建，最多 5 个） */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: RegisterBody;
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorJson('邮箱格式不正确', 400);
  if (password.length < 8) return errorJson('密码至少 8 位', 400);

  // 可选 Turnstile 人机校验（设置了 TURNSTILE_SECRET_KEY 才启用）
  if (ctx.env.TURNSTILE_SECRET_KEY) {
    const ip = ctx.request.headers.get('CF-Connecting-IP');
    const ok =
      !!body.turnstileToken &&
      (await verifyTurnstile(ctx.env.TURNSTILE_SECRET_KEY, body.turnstileToken, ip));
    if (!ok) return errorJson('人机验证未通过', 403);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await ctx.env.DB.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(userId, email, passwordHash, Date.now())
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) return errorJson('该邮箱已注册', 409);
    throw e;
  }

  const session = await createSession(ctx.env, userId);
  return json({ ok: true }, 201, { 'set-cookie': sessionCookie(session) });
};
