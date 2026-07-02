import type { Env } from '../../src/lib/env';
import { isCodeSegment, isNumericCode, resolveCanonicalCode } from '../../src/lib/codes';

/** GET /owner-qr/{code} — 该群号群主的微信二维码图片（大小写 302 规范化） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const segment = ctx.params.code;
  if (!isCodeSegment(segment)) return new Response('Not found', { status: 404 });

  let code = segment;
  if (!isNumericCode(segment)) {
    const canonical = await resolveCanonicalCode(ctx.env.DB, segment);
    if (!canonical) return new Response('Not found', { status: 404 });
    if (canonical !== segment) {
      return Response.redirect(new URL(`/owner-qr/${canonical}`, ctx.request.url).toString(), 302);
    }
    code = canonical;
  }

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
