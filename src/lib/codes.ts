/** 生成 8 位随机数字（首位非 0） */
export function randomCode(): string {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  const n = 10_000_000 + (buf[0] % 90_000_000);
  return String(n);
}

export function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{8}$/.test(code);
}

/** 生成 count 个未被占用的候选码 */
export async function generateCandidates(db: D1Database, count = 5): Promise<string[]> {
  const picks = new Set<string>();
  let guard = 0;
  while (picks.size < count && guard++ < 10) {
    const batch = new Set<string>();
    while (batch.size < count - picks.size) batch.add(randomCode());
    const codes = [...batch];
    const placeholders = codes.map(() => '?').join(',');
    const { results } = await db
      .prepare(`SELECT code FROM codes WHERE code IN (${placeholders})`)
      .bind(...codes)
      .all<{ code: string }>();
    const taken = new Set(results.map((r) => r.code));
    for (const c of codes) if (!taken.has(c)) picks.add(c);
  }
  return [...picks].slice(0, count);
}
