import type { Env } from '../../src/lib/env';
import { isValidCode } from '../../src/lib/codes';

/** GET /owner-qr/{code} — 该群号群主的微信二维码图片 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = ctx.params.code;
  if (!isValidCode(code)) return new Response('Not found', { status: 404 });

  const row = await ctx.env.DB.prepare('SELECT user_id FROM codes WHERE code = ?')
    .bind(code)
    .first<{ user_id: string }>();
  if (!row) return new Response('Not found', { status: 404 });

  const object = await ctx.env.QR_BUCKET.get(`wechat-qr/${row.user_id}`);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'public, max-age=300');
  return new Response(object.body, { headers });
};
