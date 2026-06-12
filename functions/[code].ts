import type { Env } from '../src/lib/env';
import { isNumericCode, isCodeSegment, resolveCanonicalCode } from '../src/lib/codes';

const CACHE_CONTROL = 'public, max-age=300';

/**
 * GET /{code} — 公开展示页（二维码 C）。
 * 数字码热路径仅读 R2 预渲染 HTML（pages/{code}.html），不查 D1。
 * 自定义码先查 D1 规范大小写：非规范形态 302 跳转到创建时保存的原始大小写。
 * 不存在的群号统一 302 跳转到介绍页 /intro；非群号形态路径放行给静态资源。
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const segment = ctx.params.code;
  if (!isCodeSegment(segment)) {
    return ctx.next();
  }

  let code = segment;
  if (!isNumericCode(segment)) {
    const canonical = await resolveCanonicalCode(ctx.env.DB, segment);
    if (!canonical) {
      return Response.redirect(new URL('/intro', ctx.request.url).toString(), 302);
    }
    if (canonical !== segment) {
      return Response.redirect(new URL(`/${canonical}`, ctx.request.url).toString(), 302);
    }
    code = canonical;
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
