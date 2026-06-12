import { type Env, json, errorJson } from '../../../src/lib/env';
import { getSessionUser, isPremium } from '../../../src/lib/auth';
import { isValidCustomCode, toCodeKey } from '../../../src/lib/codes';

/** GET /api/codes/check?code=AaAa — 高级会员自定义码可用性检查（大小写不敏感查重） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.request, ctx.env);
  if (!user) return errorJson('请先登录', 401);
  if (!isPremium(user)) return errorJson('自定义群号为高级会员功能', 403);

  const code = new URL(ctx.request.url).searchParams.get('code')?.trim() ?? '';
  if (!isValidCustomCode(code)) {
    return json({ code, available: false, reason: '需 3-10 位字母或数字，且不可使用系统保留字' });
  }

  const row = await ctx.env.DB.prepare('SELECT code FROM codes WHERE code_key = ?')
    .bind(toCodeKey(code))
    .first<{ code: string }>();

  if (row) {
    return json({ code, available: false, reason: `已被占用（现有群号 ${row.code}，大小写视为相同）` });
  }
  return json({ code, available: true });
};
