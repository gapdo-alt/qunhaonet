import type { Env } from '../../src/lib/env';
import { isValidCode } from '../../src/lib/codes';

const CACHE_CONTROL = 'public, max-age=300';

/** GET /i/{code} — 公开图片直链（URL 永远不变，内容随上传更新） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = ctx.params.code;
  if (!isValidCode(code)) return new Response('Not found', { status: 404 });

  const object = await ctx.env.QR_BUCKET.get(`codes/${code}`);
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
