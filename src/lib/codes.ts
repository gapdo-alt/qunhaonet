/** 生成 5 位随机数字（10000–99999，不含前导零） */
export function randomCode(): string {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  const n = 10_000 + (buf[0] % 90_000);
  return String(n);
}

/** 普通 5 位数字群号 */
export function isNumericCode(code: unknown): boolean {
  return typeof code === 'string' && /^[1-9]\d{4}$/.test(code);
}

/** 系统保留路径（大小写不敏感），不可注册为群号 */
const RESERVED = new Set([
  'api', 'admin', 'dashboard', 'login', 'register', 'intro', 'owner',
  'i', 'a', 'assets', 'favicon', 'index', 'qunhao', 'www', '404',
  'beijing',
]);

export function isReserved(segment: string): boolean {
  return RESERVED.has(segment.toLowerCase());
}

/** 高级会员自定义码：3-10 位字母数字，非保留字 */
export function isValidCustomCode(code: unknown): code is string {
  return (
    typeof code === 'string' &&
    /^[a-zA-Z0-9]{3,10}$/.test(code) &&
    !isReserved(code)
  );
}

/** URL 路径段是否可能是群号（接受任意大小写，用于公开路由） */
export function isCodeSegment(segment: unknown): segment is string {
  if (typeof segment !== 'string') return false;
  if (isNumericCode(segment)) return true;
  return /^[a-zA-Z0-9]{3,10}$/.test(segment) && !isReserved(segment);
}

/** 查重键：自定义码大小写不敏感；纯数字原样 */
export function toCodeKey(code: string): string {
  return isNumericCode(code) ? code : code.toLowerCase();
}

/** 按 code_key 解析规范群号（创建时保存的大小写形态）；不存在返回 null */
export async function resolveCanonicalCode(db: D1Database, segment: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT code FROM codes WHERE code_key = ?')
    .bind(toCodeKey(segment))
    .first<{ code: string }>();
  return row?.code ?? null;
}

export const MAX_CODES_PER_USER = 5;

/** 二维码状态色：none(未上传) / green(≤3天) / yellow(3-5天) / red(>5天) */
export function statusLevel(updatedAt: number | null): 'none' | 'green' | 'yellow' | 'red' {
  if (!updatedAt) return 'none';
  const days = (Date.now() - updatedAt) / 86_400_000;
  if (days <= 3) return 'green';
  if (days <= 5) return 'yellow';
  return 'red';
}

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
      .prepare(`SELECT code_key FROM codes WHERE code_key IN (${placeholders})`)
      .bind(...codes)
      .all<{ code_key: string }>();
    const taken = new Set(results.map((r) => r.code_key));
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

export interface CodeRow {
  code: string;
  name: string;
  platform: 'wechat' | 'feishu' | null;
  updated_at: number | null;
  created_at: number;
  is_custom?: number;
}

/** 群号 API 响应统一结构 */
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
