import type { Env } from '../../src/lib/env';
import { isValidCode } from '../../src/lib/codes';
import { renderOwnerPage } from '../../src/lib/template';

/** GET /owner/{code} — 群主信息页（动态渲染，资料更新即时生效；低频页面） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = ctx.params.code;
  if (!isValidCode(code)) return new Response('Not found', { status: 404 });

  const row = await ctx.env.DB.prepare(
    `SELECT c.name, u.wechat_id, u.has_wechat_qr
     FROM codes c JOIN users u ON u.id = c.user_id
     WHERE c.code = ?`,
  )
    .bind(code)
    .first<{ name: string; wechat_id: string | null; has_wechat_qr: number }>();

  if (!row) {
    return Response.redirect(new URL('/intro', ctx.request.url).toString(), 302);
  }

  return new Response(
    renderOwnerPage({
      code,
      host: ctx.env.PUBLIC_HOST,
      name: row.name,
      wechatId: row.wechat_id,
      hasWechatQr: row.has_wechat_qr === 1,
    }),
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60',
      },
    },
  );
};
