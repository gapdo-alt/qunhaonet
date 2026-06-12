import type { Env } from '../../src/lib/env';
import { isValidCode } from '../../src/lib/codes';

// 二维码 A 永久不变，可长缓存
const CACHE_CONTROL = 'public, max-age=86400';

/** GET /a/{code} — 二维码 A 图片（内容为展示页链接，与群号互锁，永不变） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = ctx.params.code;
  if (!isValidCode(code)) return new Response('Not found', { status: 404 });

  const object = await ctx.env.QR_BUCKET.get(`qr-a/${code}.png`);
  if (!object) return new Response('Not found', { status: 404 });

  const etag = object.httpEtag;
  if (ctx.request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag, 'cache-control': CACHE_CONTROL } });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', etag);
  headers.set('cache-control', CACHE_CONTROL);
  headers.set('access-control-allow-origin', '*');
  return new Response(object.body, { headers });
};
