import { type Env, json, errorJson } from '../../../../src/lib/env';
import { getSessionUserId } from '../../../../src/lib/auth';
import { isValidCode, detectPlatform } from '../../../../src/lib/codes';
import { renderLandingPage } from '../../../../src/lib/template';

/**
 * POST /api/codes/{code}/upload — 上传/替换二维码（multipart/form-data）
 * 字段：groupUrl（二维码 B 解析出的群链接）、file（浏览器重绘的二维码 C PNG）
 * 服务端校验域名白名单，写 R2，更新 D1，重渲染展示页。
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  const code = ctx.params.code;
  if (!isValidCode(code)) return errorJson('群号格式不正确', 400);

  const row = await ctx.env.DB.prepare('SELECT user_id, name FROM codes WHERE code = ?')
    .bind(code)
    .first<{ user_id: string; name: string }>();
  if (!row) return errorJson('群号不存在', 404);
  if (row.user_id !== userId) return errorJson('无权操作该群号', 403);

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return errorJson('请以 multipart/form-data 上传', 400);
  }

  const groupUrl = String(form.get('groupUrl') ?? '').trim();
  const file = form.get('file') as unknown as File | string | null;

  const platform = detectPlatform(groupUrl);
  if (!platform) return errorJson('仅支持微信群（weixin.qq.com）或飞书群（feishu.cn）二维码', 422);
  if (groupUrl.length > 2048) return errorJson('群链接过长', 400);

  if (file === null || typeof file === 'string') return errorJson('缺少二维码图片', 400);
  if (file.type !== 'image/png' || file.size === 0 || file.size > 1024 * 1024) {
    return errorJson('二维码图片无效（需 PNG 且不超过 1MB）', 400);
  }

  const now = Date.now();

  // 1. 覆盖写入二维码 C（key 固定 → /i/{code} 直链 URL 永远不变）
  await ctx.env.QR_BUCKET.put(`qr-c/${code}.png`, file.stream(), {
    httpMetadata: { contentType: 'image/png' },
  });

  // 2. 重新预渲染展示页
  await ctx.env.QR_BUCKET.put(
    `pages/${code}.html`,
    renderLandingPage({ code, host: ctx.env.PUBLIC_HOST, name: row.name, platform, version: now }),
    { httpMetadata: { contentType: 'text/html; charset=utf-8' } },
  );

  // 3. 更新元数据
  try {
    await ctx.env.DB.prepare('UPDATE codes SET platform = ?, group_url = ?, updated_at = ? WHERE code = ?')
      .bind(platform, groupUrl, now, code)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('no column') || msg.includes('has no column')) {
      return errorJson('数据库未升级到 v2，请执行 npm run db:init:remote 后重新部署', 503);
    }
    console.error('upload update failed:', msg);
    return errorJson('更新失败，请稍后重试', 500);
  }

  return json({ code, platform, updatedAt: now });
};
