import type { Env } from '../../src/lib/env';
import { isCodeSegment, toCodeKey } from '../../src/lib/codes';

/** GET /owner-qr/{code} — 该群号群主的微信二维码图片（按 code_key 查找，大小写不敏感） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const segment = ctx.params.code;
  if (!isCodeSegment(segment)) return new Response('Not found', { status: 404 });

  const row = await ctx.env.DB.prepare('SELECT user_id FROM codes WHERE code_key = ?')
    .bind(toCodeKey(String(segment)))
    .first<{ user_id: string }>();
  if (!row) return new Response('Not found', { status: 404 });

  const object = await ctx.env.QR_BUCKET.get(`wechat-qr/${row.user_id}`);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'public, max-age=300');
  return new Response(object.body, { headers });
};
