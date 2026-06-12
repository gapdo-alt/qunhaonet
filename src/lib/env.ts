export interface Env {
  DB: D1Database;
  QR_BUCKET: R2Bucket;
  SESSIONS: KVNamespace;
  PUBLIC_HOST: string;
  /** 可选：设置后启用 Turnstile 人机校验（wrangler pages secret put TURNSTILE_SECRET_KEY） */
  TURNSTILE_SECRET_KEY?: string;
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function errorJson(message: string, status: number): Response {
  return json({ error: message }, status);
}
