import { type Env, json, errorJson } from '../../../src/lib/env';
import { hashPassword, createSession, sessionCookie } from '../../../src/lib/auth';
import { isValidCode } from '../../../src/lib/codes';
import { renderLandingPage } from '../../../src/lib/template';

interface RegisterBody {
  email?: string;
  password?: string;
  code?: string;
  token?: string;
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

/** POST /api/auth/register — 注册 + 绑定选定的 8 位数字 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: RegisterBody;
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const code = body.code ?? '';
  const token = body.token ?? '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorJson('邮箱格式不正确', 400);
  if (password.length < 8) return errorJson('密码至少 8 位', 400);
  if (!isValidCode(code)) return errorJson('群号格式不正确', 400);
  if (!token) return errorJson('候选令牌缺失，请刷新页面重试', 400);

  // 可选 Turnstile 人机校验（设置了 TURNSTILE_SECRET_KEY 才启用）
  if (ctx.env.TURNSTILE_SECRET_KEY) {
    const ip = ctx.request.headers.get('CF-Connecting-IP');
    const ok =
      !!body.turnstileToken &&
      (await verifyTurnstile(ctx.env.TURNSTILE_SECRET_KEY, body.turnstileToken, ip));
    if (!ok) return errorJson('人机验证未通过', 403);
  }

  // 校验所选码确实来自本次发放的候选列表
  const candRaw = await ctx.env.SESSIONS.get(`cand:${token}`);
  if (!candRaw) return errorJson('候选码已过期，请刷新页面重新获取', 410);
  const candidates = JSON.parse(candRaw) as string[];
  if (!candidates.includes(code)) return errorJson('所选群号不在候选列表中', 400);

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  try {
    // batch 为原子事务：用户与群号同时创建
    await ctx.env.DB.batch([
      ctx.env.DB.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').bind(
        userId,
        email,
        passwordHash,
        now,
      ),
      ctx.env.DB.prepare('INSERT INTO codes (code, user_id, created_at) VALUES (?, ?, ?)').bind(
        code,
        userId,
        now,
      ),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) {
      if (msg.includes('users.email')) return errorJson('该邮箱已注册', 409);
      return errorJson('该群号刚被他人占用，请重新选择', 409);
    }
    throw e;
  }

  ctx.waitUntil(ctx.env.SESSIONS.delete(`cand:${token}`));

  // 预渲染占位展示页（暂无二维码），保证 /{code} 立即可访问
  await ctx.env.QR_BUCKET.put(
    `pages/${code}.html`,
    renderLandingPage({ code, host: ctx.env.PUBLIC_HOST, version: null }),
    { httpMetadata: { contentType: 'text/html; charset=utf-8' } },
  );

  const session = await createSession(ctx.env, userId);
  return json({ code }, 201, { 'set-cookie': sessionCookie(session) });
};
