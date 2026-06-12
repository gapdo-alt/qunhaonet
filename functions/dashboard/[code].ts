import type { Env } from '../../src/lib/env';
import { isCodeSegment } from '../../src/lib/codes';

/** GET /dashboard/{code} — 群号详情页（返回静态壳，数据由前端按 API 加载） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!isCodeSegment(ctx.params.code)) return ctx.next();
  const asset = new URL('/dashboard-detail.html', ctx.request.url);
  const res = await ctx.env.ASSETS.fetch(asset.toString());
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
};
