import type { Env } from '../../src/lib/env';
import { isCodeSegment, isNumericCode, resolveCanonicalCode } from '../../src/lib/codes';

/** GET /dashboard/{code} — 群号详情页（自定义码大小写 302 规范化） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const segment = ctx.params.code;
  if (!isCodeSegment(segment)) return ctx.next();

  if (!isNumericCode(segment)) {
    const canonical = await resolveCanonicalCode(ctx.env.DB, segment);
    if (canonical && canonical !== segment) {
      return Response.redirect(new URL(`/dashboard/${canonical}`, ctx.request.url).toString(), 302);
    }
  }
  const asset = new URL('/dashboard-detail.html', ctx.request.url);
  const res = await ctx.env.ASSETS.fetch(asset.toString());
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
};
