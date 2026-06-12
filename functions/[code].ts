import type { Env } from '../src/lib/env';

const CACHE_CONTROL = 'public, max-age=300';

/**
 * GET /{code} — 公开展示页（二维码 C）。
 * 热路径仅读 R2 预渲染 HTML（pages/{code}.html），不查 D1。
 * 不存在的群号统一 302 跳转到介绍页 /intro。
 * 非 5 位数字路径放行给静态资源（/register、/login 等）。
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = ctx.params.code;
  if (typeof code !== 'string' || !/^\d{5}$/.test(code)) {
    return ctx.next();
  }

  const object = await ctx.env.QR_BUCKET.get(`pages/${code}.html`);
  if (!object) {
    return Response.redirect(new URL('/intro', ctx.request.url).toString(), 302);
  }

  const etag = object.httpEtag;
  if (ctx.request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag, 'cache-control': CACHE_CONTROL } });
  }

  return new Response(object.body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': CACHE_CONTROL,
      etag,
    },
  });
};
