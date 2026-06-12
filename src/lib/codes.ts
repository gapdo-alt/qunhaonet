/** 生成 5 位随机数字（10000–99999，不含前导零） */
export function randomCode(): string {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  const n = 10_000 + (buf[0] % 90_000);
  return String(n);
}

export function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && /^[1-9]\d{4}$/.test(code);
}

export const MAX_CODES_PER_USER = 5;

/** 生成 count 个未被占用的候选码 */
export async function generateCandidates(db: D1Database, count = 8): Promise<string[]> {
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

/** 服务端平台识别（与客户端 qr-tools.js 保持一致） */
export function detectPlatform(groupUrl: string): 'wechat' | 'feishu' | null {
  try {
    const h = new URL(groupUrl).hostname;
    if (h === 'weixin.qq.com' || h.endsWith('.weixin.qq.com')) return 'wechat';
    if (h === 'feishu.cn' || h.endsWith('.feishu.cn')) return 'feishu';
  } catch {
    /* 非合法 URL */
  }
  return null;
}

export const PLATFORM_LABELS: Record<string, string> = {
  wechat: '微信群',
  feishu: '飞书群',
};
