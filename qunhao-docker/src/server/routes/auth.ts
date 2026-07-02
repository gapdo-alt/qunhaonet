import { Hono } from 'hono';
import type { AppEnv } from '../../lib/env.js';
import { json } from '../../lib/env.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  sessionCookie,
  clearSessionCookie,
  getSessionUser,
  deleteSession,
  createPasswordResetToken,
  consumePasswordResetToken,
  deleteAllUserSessions,
  getSessionToken,
} from '../../lib/auth.js';
import { getClientIp } from '../../lib/env.js';
import { checkRateLimit } from '../../lib/rate-limit.js';
import { sendPasswordResetEmail } from '../../lib/email.js';

type Ctx = { Variables: { env: AppEnv } };

async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip ?? undefined }),
  });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

const FORGOT_MSG = '若该邮箱已注册，你将收到重置密码邮件，请查收（含垃圾箱）。';

export function authRoutes() {
  const app = new Hono<Ctx>();

  app.post('/register', async (c) => {
    const env = c.get('env');
    const ip = getClientIp(c.req.raw) ?? 'unknown';
    const rl = await checkRateLimit(env.kv, `register:${ip}`, 5, 3600);
    if (!rl.allowed) return json({ error: '请求过于频繁，请稍后再试' }, 429);

    let body: { email?: string; password?: string; turnstileToken?: string };
    try {
      body = await c.req.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: '邮箱格式不正确' }, 400);
    if (password.length < 8) return json({ error: '密码至少 8 位' }, 400);

    if (env.config.turnstileSecretKey) {
      const ok = !!body.turnstileToken && (await verifyTurnstile(env.config.turnstileSecretKey, body.turnstileToken, ip));
      if (!ok) return json({ error: '人机验证未通过' }, 403);
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const role = env.config.adminEmail && email === env.config.adminEmail.trim().toLowerCase() ? 'admin' : 'user';

    try {
      await env.db
        .prepare('INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, email, passwordHash, role, Date.now())
        .run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE')) return json({ error: '该邮箱已注册' }, 409);
      throw e;
    }

    const session = await createSession(env, userId);
    return json({ ok: true }, 201, { 'set-cookie': sessionCookie(env, session) });
  });

  app.post('/login', async (c) => {
    const env = c.get('env');
    const ip = getClientIp(c.req.raw) ?? 'unknown';
    const rl = await checkRateLimit(env.kv, `login:${ip}`, 10, 900);
    if (!rl.allowed) return json({ error: '请求过于频繁，请稍后再试' }, 429);

    let body: { email?: string; password?: string };
    try {
      body = await c.req.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    if (!email || !password) return json({ error: '请输入邮箱和密码' }, 400);

    const user = await env.db
      .prepare('SELECT id, password_hash, role FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; password_hash: string; role: string }>();

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return json({ error: '邮箱或密码错误' }, 401);
    }

    if (
      env.config.adminEmail &&
      email === env.config.adminEmail.trim().toLowerCase() &&
      user.role !== 'admin'
    ) {
      await env.db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(user.id).run();
    }

    const session = await createSession(env, user.id);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(env, session) });
  });

  app.post('/logout', async (c) => {
    const env = c.get('env');
    await deleteSession(c.req.raw, env);
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(env) });
  });

  app.post('/forgot-password', async (c) => {
    const env = c.get('env');
    if (!env.config.resendApiKey || !env.config.resendFrom) {
      return json({ error: '邮件服务暂未配置' }, 503);
    }

    const ip = getClientIp(c.req.raw) ?? 'unknown';
    const rlIp = await checkRateLimit(env.kv, `forgot:${ip}`, 3, 3600);
    if (!rlIp.allowed) return json({ error: '请求过于频繁，请稍后再试' }, 429);

    let body: { email?: string };
    try {
      body = await c.req.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const email = (body.email ?? '').trim().toLowerCase();
    if (!email) return json({ error: '请输入邮箱' }, 400);

    const rlEmail = await checkRateLimit(env.kv, `forgot:email:${email}`, 1, 3600);
    if (!rlEmail.allowed) return json({ message: FORGOT_MSG });

    const user = await env.db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (user) {
      const token = await createPasswordResetToken(env, user.id, email);
      const proto = env.config.secureCookies ? 'https' : 'http';
      const resetUrl = `${proto}://${env.config.publicHost}/reset-password?token=${token}`;
      await sendPasswordResetEmail({
        apiKey: env.config.resendApiKey,
        from: env.config.resendFrom,
        to: email,
        resetUrl,
        host: env.config.publicHost,
      });
    }

    return json({ message: FORGOT_MSG });
  });

  app.post('/reset-password', async (c) => {
    const env = c.get('env');
    const ip = getClientIp(c.req.raw) ?? 'unknown';
    const rl = await checkRateLimit(env.kv, `reset:${ip}`, 5, 3600);
    if (!rl.allowed) return json({ error: '请求过于频繁，请稍后再试' }, 429);

    let body: { token?: string; password?: string };
    try {
      body = await c.req.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const token = body.token ?? '';
    const password = body.password ?? '';
    if (!token || password.length < 8) return json({ error: '链接无效或密码至少 8 位' }, 400);

    const data = await consumePasswordResetToken(env, token);
    if (!data) return json({ error: '重置链接无效或已过期' }, 410);

    const passwordHash = await hashPassword(password);
    await env.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, data.userId).run();
    await deleteAllUserSessions(env, data.userId);

    return json({ ok: true });
  });

  app.post('/change-password', async (c) => {
    const env = c.get('env');
    const user = await getSessionUser(c.req.raw, env);
    if (!user) return json({ error: '请先登录' }, 401);

    let body: { currentPassword?: string; newPassword?: string };
    try {
      body = await c.req.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const currentPassword = body.currentPassword ?? '';
    const newPassword = body.newPassword ?? '';
    if (newPassword.length < 8) return json({ error: '新密码至少 8 位' }, 400);

    const row = await env.db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(user.id)
      .first<{ password_hash: string }>();
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      return json({ error: '当前密码错误' }, 401);
    }

    const passwordHash = await hashPassword(newPassword);
    await env.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, user.id).run();

    const currentToken = getSessionToken(c.req.raw);
    await deleteAllUserSessions(env, user.id, currentToken ?? undefined);

    return json({ ok: true });
  });

  return app;
}