import type { KeyValueStore } from '../adapters/redis-kv.js';

export async function checkRateLimit(
  kv: KeyValueStore,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const redisKey = `rl:${key}`;
  const current = await kv.get(redisKey);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  const next = count + 1;
  await kv.put(redisKey, String(next), { expirationTtl: windowSeconds });
  return { allowed: true, remaining: limit - next };
}
