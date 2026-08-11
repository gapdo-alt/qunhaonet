import { type Env, errorJson } from './env';
import { getSessionUser } from './auth';

export const BJ_CATEGORIES = ['开锁', '水管', '电路', '其他'] as const;
export const BJ_SOURCES = ['web', 'group', 'seo', 'referral'] as const;
export const BJ_REQUEST_STATUSES = ['new', 'assigned', 'done', 'failed', 'cancelled'] as const;
export const BJ_ORDER_STATUSES = ['open', 'completed', 'failed', 'disputed'] as const;

export async function requireAdmin(request: Request, env: Env) {
  const user = await getSessionUser(request, env);
  if (!user) return { error: errorJson('请先登录', 401) };
  if (user.role !== 'admin') return { error: errorJson('需要管理员权限', 403) };
  return { user };
}

export function yuanToCents(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v * 100);
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    const n = Number(v);
    if (n >= 0) return Math.round(n * 100);
  }
  return null;
}

export function centsToYuan(cents: number): number {
  return Math.round(cents) / 100;
}
