import { type Env, json, errorJson } from '../../../src/lib/env';
import { getSessionUser, isPremium } from '../../../src/lib/auth';
import {
  isNumericCode,
  isValidCustomCode,
  toCodeKey,
  codeMeta,
  type CodeRow,
  MAX_CODES_PER_USER,
} from '../../../src/lib/codes';
import { renderLandingPage } from '../../../src/lib/template';

/** GET /api/codes — 我的群号列表（摘要 + 状态色） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.request, ctx.env);
  if (!user) return errorJson('请先登录', 401);

  const { results } = await ctx.env.DB.prepare(
    'SELECT code, name, platform, updated_at, created_at, is_custom FROM codes WHERE user_id = ? ORDER BY created_at',
  )
    .bind(user.id)
    .all<CodeRow>();

  return json({
    codes: results.map((r) => codeMeta(r, ctx.env.PUBLIC_HOST)),
    max: MAX_CODES_PER_USER,
    host: ctx.env.PUBLIC_HOST,
    canCustomize: isPremium(user),
    role: user.role,
  });
};

/**
 * POST /api/codes — 创建群号（multipart/form-data）
 * 普通：code 来自候选 + token；高级会员可传 customCode（3-10 位字母数字，原样保存大小写）
 * file：浏览器渲染的二维码 A PNG
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.request, ctx.env);
  if (!user) return errorJson('请先登录', 401);

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const customCode = String(form.get('customCode') ?? '').trim();
  const pickedCode = String(form.get('code') ?? '').trim();
  const token = String(form.get('token') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const file = form.get('file') as unknown as File | string | null;

  if (!name || name.length > 30) return errorJson('请填写群名称（30 字以内）', 400);
  if (file === null || typeof file === 'string') return errorJson('缺少二维码 A 图片', 400);
  if (file.type !== 'image/png' || file.size === 0 || file.size > 1024 * 1024) {
    return errorJson('二维码 A 图片无效', 400);
  }

  let code: string;
  let isCustom = 0;

  if (customCode) {
    if (!isPremium(user)) return errorJson('自定义群号为高级会员功能', 403);
    if (!isValidCustomCode(customCode)) {
      return errorJson('自定义群号需 3-10 位字母或数字，且不可使用系统保留字', 400);
    }
    code = customCode;
    isCustom = 1;
  } else {
    if (!isNumericCode(pickedCode)) return errorJson('群号格式不正确', 400);
    if (!token) return errorJson('候选令牌缺失', 400);
    const candRaw = await ctx.env.SESSIONS.get(`cand:${token}`);
    if (!candRaw) return errorJson('候选码已过期，请重新获取', 410);
    const candidates = JSON.parse(candRaw) as string[];
    if (!candidates.includes(pickedCode)) return errorJson('所选群号不在候选列表中', 400);
    code = pickedCode;
  }

  const cnt = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM codes WHERE user_id = ?')
    .bind(user.id)
    .first<{ n: number }>();
  if ((cnt?.n ?? 0) >= MAX_CODES_PER_USER) {
    return errorJson(`每个账号最多创建 ${MAX_CODES_PER_USER} 个群号`, 403);
  }

  const now = Date.now();
  try {
    await ctx.env.DB.prepare(
      'INSERT INTO codes (code, code_key, user_id, name, created_at, is_custom) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(code, toCodeKey(code), user.id, name, now, isCustom)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE') || msg.includes('PRIMARY')) {
      return errorJson('该群号已被占用（大小写视为相同），请换一个', 409);
    }
    if (msg.includes('no column') || msg.includes('has no column')) {
      return errorJson('数据库未升级到 v3，请执行 npm run db:init:remote 后重新部署', 503);
    }
    console.error('create code failed:', msg);
    return errorJson('创建失败，请稍后重试', 500);
  }

  if (token) ctx.waitUntil(ctx.env.SESSIONS.delete(`cand:${token}`));

  // 二维码 A（永久不变）+ 占位展示页
  await ctx.env.QR_BUCKET.put(`qr-a/${code}.png`, file.stream(), {
    httpMetadata: { contentType: 'image/png' },
  });
  await ctx.env.QR_BUCKET.put(
    `pages/${code}.html`,
    renderLandingPage({ code, host: ctx.env.PUBLIC_HOST, name, platform: null, version: null }),
    { httpMetadata: { contentType: 'text/html; charset=utf-8' } },
  );

  return json(
    codeMeta({ code, name, platform: null, updated_at: null, created_at: now, is_custom: isCustom }, ctx.env.PUBLIC_HOST),
    201,
  );
};
