import type { Context, Next } from 'hono';
import type { AppEnv } from '../../lib/env.js';

export async function securityHeaders(_c: Context, next: Next): Promise<void> {
  await next();
  // Headers set in response via middleware after handler - use onAfter for hono
}

export function applySecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
