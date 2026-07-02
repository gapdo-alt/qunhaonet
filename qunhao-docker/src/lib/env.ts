import type { AppDatabase } from '../adapters/sqlite.js';
import type { KeyValueStore } from '../adapters/redis-kv.js';
import type { ObjectStorage } from '../adapters/s3-storage.js';

export interface AppConfig {
  port: number;
  publicHost: string;
  cdnBaseUrl: string;
  secureCookies: boolean;
  databasePath: string;
  redisUrl: string;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  adminEmail?: string;
  turnstileSecretKey?: string;
  turnstileSiteKey?: string;
  resendApiKey?: string;
  resendFrom?: string;
  cdnPurgeUrl?: string;
}

export interface AppEnv {
  config: AppConfig;
  db: AppDatabase;
  kv: KeyValueStore;
  storage: ObjectStorage;
}

export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function errorJson(message: string, status: number): Response {
  return json({ error: message }, status);
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}
