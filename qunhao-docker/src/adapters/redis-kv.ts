import { Redis } from 'ioredis';

export interface KvPutOptions {
  expirationTtl?: number;
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KvPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  sadd(key: string, member: string, ttlSeconds?: number): Promise<void>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, member: string): Promise<void>;
  ping(): Promise<boolean>;
  quit(): Promise<void>;
}

export function createRedisKv(url: string): KeyValueStore {
  const redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });

  return {
    async get(key) {
      return redis.get(key);
    },
    async put(key, value, options) {
      if (options?.expirationTtl) {
        await redis.setex(key, options.expirationTtl, value);
      } else {
        await redis.set(key, value);
      }
    },
    async delete(key) {
      await redis.del(key);
    },
    async sadd(key, member, ttlSeconds) {
      await redis.sadd(key, member);
      if (ttlSeconds) await redis.expire(key, ttlSeconds);
    },
    async smembers(key) {
      return redis.smembers(key);
    },
    async srem(key, member) {
      await redis.srem(key, member);
    },
    async ping() {
      return (await redis.ping()) === 'PONG';
    },
    async quit() {
      await redis.quit();
    },
  };
}

const CANONICAL_TTL = 3600;

export async function getCanonicalCode(kv: KeyValueStore, db: import('./sqlite.js').AppDatabase, segment: string, toCodeKey: (c: string) => string): Promise<string | null> {
  const key = `code:canonical:${toCodeKey(segment)}`;
  const cached = await kv.get(key);
  if (cached) return cached;

  const row = await db.prepare('SELECT code FROM codes WHERE code_key = ?').bind(toCodeKey(segment)).first<{ code: string }>();
  const code = row?.code ?? null;
  if (code) await kv.put(key, code, { expirationTtl: CANONICAL_TTL });
  return code;
}

export async function invalidateCanonicalCode(kv: KeyValueStore, code: string, toCodeKey: (c: string) => string): Promise<void> {
  await kv.delete(`code:canonical:${toCodeKey(code)}`);
}
