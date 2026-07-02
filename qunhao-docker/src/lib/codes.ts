import type { AppDatabase } from '../adapters/sqlite.js';

export function randomCode(): string {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  const n = 10_000 + (buf[0] % 90_000);
  return String(n);
}

export function isNumericCode(code: unknown): boolean {
  return typeof code === 'string' && /^[1-9]\d{4}$/.test(code);
}

const RESERVED = new Set([
  'api', 'admin', 'dashboard', 'login', 'register', 'intro', 'owner',
  'i', 'a', 'assets', 'favicon', 'index', 'qunhao', 'www', '404',
  'forgot-password', 'reset-password', 'health',
]);

export function isReserved(segment: string): boolean {
  return RESERVED.has(segment.toLowerCase());
}

export function isValidCustomCode(code: unknown): code is string {
  return typeof code === 'string' && /^[a-zA-Z0-9]{3,10}$/.test(code) && !isReserved(code);
}

export function isCodeSegment(segment: unknown): segment is string {
  if (typeof segment !== 'string') return false;
  if (isNumericCode(segment)) return true;
  return /^[a-zA-Z0-9]{3,10}$/.test(segment) && !isReserved(segment);
}

export function toCodeKey(code: string): string {
  return isNumericCode(code) ? code : code.toLowerCase();
}

export async function resolveCanonicalCode(db: AppDatabase, segment: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT code FROM codes WHERE code_key = ?')
    .bind(toCodeKey(segment))
    .first<{ code: string }>();
  return row?.code ?? null;
}

export const MAX_CODES_PER_USER = 5;

export function statusLevel(updatedAt: number | null): 'none' | 'green' | 'yellow' | 'red' {
  if (!updatedAt) return 'none';
  const days = (Date.now() - updatedAt) / 86_400_000;
  if (days <= 3) return 'green';
  if (days <= 5) return 'yellow';
  return 'red';
}

export async function generateCandidates(db: AppDatabase, count = 8): Promise<string[]> {
  const picks = new Set<string>();
  let guard = 0;
  while (picks.size < count && guard++ < 10) {
    const batch = new Set<string>();
    while (batch.size < count - picks.size) batch.add(randomCode());
    const codes = [...batch];
    const placeholders = codes.map(() => '?').join(',');
    const { results } = await db
      .prepare(`SELECT code_key FROM codes WHERE code_key IN (${placeholders})`)
      .bind(...codes)
      .all<{ code_key: string }>();
    const taken = new Set(results.map((r) => r.code_key));
    for (const c of codes) if (!taken.has(c)) picks.add(c);
  }
  return [...picks].slice(0, count);
}

export function detectPlatform(groupUrl: string): 'wechat' | 'feishu' | null {
  try {
    const h = new URL(groupUrl).hostname;
    if (h === 'weixin.qq.com' || h.endsWith('.weixin.qq.com')) return 'wechat';
    if (h === 'feishu.cn' || h.endsWith('.feishu.cn')) return 'feishu';
  } catch {
    /* ignore */
  }
  return null;
}

export interface CodeRow {
  code: string;
  name: string;
  platform: 'wechat' | 'feishu' | null;
  updated_at: number | null;
  created_at: number;
  is_custom?: number;
}

export function codeMeta(row: CodeRow, host: string) {
  return {
    code: row.code,
    name: row.name,
    platform: row.platform,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    isCustom: row.is_custom === 1,
    statusLevel: statusLevel(row.updated_at),
    pageUrl: `https://${host}/${row.code}`,
    imageUrl: `https://${host}/i/${row.code}`,
    qrAUrl: `https://${host}/a/${row.code}`,
    shareText: `群号 ${row.code} Qunhao.net`,
  };
}
