import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../lib/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../..');

export function loadConfig(): AppConfig {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const publicHost = process.env.PUBLIC_HOST ?? 'localhost';

  return {
    port,
    publicHost,
    cdnBaseUrl: process.env.CDN_BASE_URL ?? '',
    secureCookies: process.env.SECURE_COOKIES === 'true',
    databasePath: process.env.DATABASE_PATH ?? path.join(ROOT_DIR, '.data', 'qunhao.db'),
    redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    s3Endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
    s3Region: process.env.S3_REGION ?? 'us-east-1',
    s3Bucket: process.env.S3_BUCKET ?? 'qunhao-qr',
    s3AccessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    s3SecretKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    adminEmail: process.env.ADMIN_EMAIL,
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    resendFrom: process.env.RESEND_FROM,
    cdnPurgeUrl: process.env.CDN_PURGE_URL,
  };
}

export const SCHEMA_PATH = path.join(ROOT_DIR, 'schema.sql');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
