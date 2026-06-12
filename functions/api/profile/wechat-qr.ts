import { type Env, json, errorJson } from '../../../src/lib/env';
import { getSessionUserId } from '../../../src/lib/auth';

const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** POST /api/profile/wechat-qr — 上传群主微信二维码 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return errorJson('请以 multipart/form-data 上传', 400);
  }

  const file = form.get('file') as unknown as File | string | null;
  if (file === null || typeof file === 'string') return errorJson('缺少文件字段 file', 400);
  if (!ALLOWED_TYPES.has(file.type)) return errorJson('仅支持 PNG / JPEG / WebP 图片', 415);
  if (file.size === 0 || file.size > MAX_SIZE) return errorJson('文件不能超过 2MB', 413);

  await ctx.env.QR_BUCKET.put(`wechat-qr/${userId}`, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  await ctx.env.DB.prepare('UPDATE users SET has_wechat_qr = 1 WHERE id = ?').bind(userId).run();

  return json({ ok: true, updatedAt: Date.now() });
};

/** GET /api/profile/wechat-qr — 预览自己上传的微信二维码 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return errorJson('请先登录', 401);

  const object = await ctx.env.QR_BUCKET.get(`wechat-qr/${userId}`);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  return new Response(object.body, { headers });
};
