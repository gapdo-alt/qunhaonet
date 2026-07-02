import type { AppEnv } from './env.js';

const PBKDF2_ITERATIONS = 100_000;
const SESSION_COOKIE = 'qh_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await deriveBits(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

function userSessionsKey(userId: string): string {
  return `session:user:${userId}`;
}

export async function createSession(env: AppEnv, userId: string): Promise<string> {
  const token = randomToken();
  await env.kv.put(`session:${token}`, JSON.stringify({ userId, createdAt: Date.now() }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  await env.kv.sadd(userSessionsKey(userId), token, SESSION_TTL_SECONDS);
  return token;
}

export function sessionCookie(env: AppEnv, token: string): string {
  const secure = env.config.secureCookies ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(env: AppEnv): string {
  const secure = env.config.secureCookies ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`;
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([0-9a-f]{64})`));
  return match ? match[1] : null;
}

export async function getSessionUserId(request: Request, env: AppEnv): Promise<string | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  const raw = await env.kv.get(`session:${token}`);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { userId: string }).userId;
  } catch {
    return null;
  }
}

export async function deleteSession(request: Request, env: AppEnv): Promise<void> {
  const token = getSessionToken(request);
  if (!token) return;
  const raw = await env.kv.get(`session:${token}`);
  if (raw) {
    try {
      const { userId } = JSON.parse(raw) as { userId: string };
      await env.kv.srem(userSessionsKey(userId), token);
    } catch {
      /* ignore */
    }
  }
  await env.kv.delete(`session:${token}`);
}

export async function deleteAllUserSessions(env: AppEnv, userId: string, exceptToken?: string): Promise<void> {
  const tokens = await env.kv.smembers(userSessionsKey(userId));
  for (const token of tokens) {
    if (token === exceptToken) continue;
    await env.kv.delete(`session:${token}`);
    await env.kv.srem(userSessionsKey(userId), token);
  }
}

export interface SessionUser {
  id: string;
  email: string;
  role: 'user' | 'premium' | 'admin';
}

export async function getSessionUser(request: Request, env: AppEnv): Promise<SessionUser | null> {
  const userId = await getSessionUserId(request, env);
  if (!userId) return null;
  const row = await env.db.prepare('SELECT id, email, role FROM users WHERE id = ?').bind(userId).first<SessionUser>();
  return row ?? null;
}

export function isPremium(user: SessionUser): boolean {
  return user.role === 'premium' || user.role === 'admin';
}

const RESET_TTL = 3600;

export async function createPasswordResetToken(env: AppEnv, userId: string, email: string): Promise<string> {
  const token = randomToken();
  const old = await env.kv.get(`reset:user:${userId}`);
  if (old) await env.kv.delete(`reset:${old}`);

  await env.kv.put(`reset:${token}`, JSON.stringify({ userId, email, createdAt: Date.now() }), {
    expirationTtl: RESET_TTL,
  });
  await env.kv.put(`reset:user:${userId}`, token, { expirationTtl: RESET_TTL });
  return token;
}

export async function consumePasswordResetToken(
  env: AppEnv,
  token: string,
): Promise<{ userId: string; email: string } | null> {
  const raw = await env.kv.get(`reset:${token}`);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { userId: string; email: string };
    await env.kv.delete(`reset:${token}`);
    await env.kv.delete(`reset:user:${data.userId}`);
    return data;
  } catch {
    return null;
  }
}
