import { type Env, json, errorJson } from '../../../../src/lib/env';
import { getSessionUserId } from '../../../../src/lib/auth';
import { toCodeKey, isCodeSegment, codeMeta, type CodeRow } from '../../../../src/lib/codes';

async function ownedCode(ctx: Parameters<PagesFunction<Env>>[0]): Promise<
  | { ok: true; row: CodeRow & { user_id: string } }
  | { ok: false; res: Response }
> {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return { ok: false, res: errorJson('请先登录', 401) };

  const segment = ctx.params.code;
  if (!isCodeSegment(segment)) return { ok: false, res: errorJson('群号格式不正确', 400) };

  const row = await ctx.env.DB.prepare(
    'SELECT code, code_key, user_id, name, platform, updated_at, created_at, is_custom FROM codes WHERE code_key = ?',
  )
    .bind(toCodeKey(segment))
    .first<CodeRow & { user_id: string }>();

  if (!row) return { ok: false, res: errorJson('群号不存在', 404) };
  if (row.user_id !== userId) return { ok: false, res: errorJson('无权操作该群号', 403) };
  return { ok: true, row };
}

/** GET /api/codes/{code} — 单个群号详情 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const r = await ownedCode(ctx);
  if (!r.ok) return r.res;
  return json(codeMeta(r.row, ctx.env.PUBLIC_HOST));
};

/** DELETE /api/codes/{code} — 删除群号及全部 R2 资源（不可恢复） */
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const r = await ownedCode(ctx);
  if (!r.ok) return r.res;
  const code = r.row.code;

  await ctx.env.DB.prepare('DELETE FROM codes WHERE code = ?').bind(code).run();
  await ctx.env.QR_BUCKET.delete([`qr-a/${code}.png`, `qr-c/${code}.png`, `pages/${code}.html`]);

  return json({ ok: true, deleted: code });
};
