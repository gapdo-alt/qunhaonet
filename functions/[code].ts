import type { Env } from '../src/lib/env';
import { renderNotFoundPage } from '../src/lib/template';

const CACHE_CONTROL = 'public, max-age=300';

/**
 * GET /{code} — 公开展示页。
 * 热路径仅读 R2 预渲染 HTML（pages/{code}.html），不查 D1。
 * 非 8 位数字路径放行给静态资源（/register、/login 等）。
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = ctx.params.code;
  if (typeof code !== 'string' || !/^\d{8}$/.test(code)) {
    return ctx.next();
  }

  const object = await ctx.env.QR_BUCKET.get(`pages/${code}.html`);
  if (!object) {
    return new Response(renderNotFoundPage(ctx.env.PUBLIC_HOST), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
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
