import type { Env } from '../../src/lib/env';
import { isNumericCode, isCodeSegment, resolveCanonicalCode } from '../../src/lib/codes';

const CACHE_CONTROL = 'public, max-age=300';

/** GET /i/{code} — 二维码 C 图片直链（URL 永远不变，内容随替换更新；大小写 302 规范化） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const segment = ctx.params.code;
  if (!isCodeSegment(segment)) return new Response('Not found', { status: 404 });

  let code = segment;
  if (!isNumericCode(segment)) {
    const canonical = await resolveCanonicalCode(ctx.env.DB, segment);
    if (!canonical) return new Response('Not found', { status: 404 });
    if (canonical !== segment) {
      return Response.redirect(new URL(`/i/${canonical}`, ctx.request.url).toString(), 302);
    }
    code = canonical;
  }

  const object = await ctx.env.QR_BUCKET.get(`qr-c/${code}.png`);
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
