import { type Env, json, errorJson } from '../../../src/lib/env';
import { getSessionUserId } from '../../../src/lib/auth';
import { renderLandingPage } from '../../../src/lib/template';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** POST /api/qr/upload — 上传/替换二维码，并同步重新生成预渲染展示页 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  const row = await ctx.env.DB.prepare('SELECT code FROM codes WHERE user_id = ?')
    .bind(userId)
    .first<{ code: string }>();
  if (!row) return errorJson('账号未绑定群号', 404);
  const code = row.code;

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return errorJson('请以 multipart/form-data 上传文件', 400);
  }

  // workers-types 将 get() 声明为 string | null，运行时实际可能是 File
  const file = form.get('file') as unknown as File | string | null;
  if (file === null || typeof file === 'string') return errorJson('缺少文件字段 file', 400);
  if (!ALLOWED_TYPES.has(file.type)) return errorJson('仅支持 PNG / JPEG / WebP 图片', 415);
  if (file.size === 0) return errorJson('文件为空', 400);
  if (file.size > MAX_SIZE) return errorJson('文件不能超过 2MB', 413);

  const now = Date.now();

  // 1. 覆盖写入二维码图片（key 固定 → 直链 URL 永远不变）
  await ctx.env.QR_BUCKET.put(`codes/${code}`, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  // 2. 重新预渲染展示页（带新版本号，确保访客看到新码）
  await ctx.env.QR_BUCKET.put(
    `pages/${code}.html`,
    renderLandingPage({ code, host: ctx.env.PUBLIC_HOST, version: now }),
    { httpMetadata: { contentType: 'text/html; charset=utf-8' } },
  );

  // 3. 更新元数据
  await ctx.env.DB.prepare('UPDATE codes SET content_type = ?, updated_at = ? WHERE code = ?')
    .bind(file.type, now, code)
    .run();

  return json({ code, updatedAt: now });
};
