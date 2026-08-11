import { type Env, json, errorJson } from '../../../../src/lib/env';
import { requireAdmin } from '../../../../src/lib/beijing';

/** PATCH /api/beijing/craftsmen/:id */
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  const id = ctx.params.id as string;
  let body: { status?: string; notes?: string; idVerified?: boolean };
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const status = body.status !== undefined ? body.status.trim() : null;
  if (status && !['active', 'paused', 'left'].includes(status)) return errorJson('状态无效', 400);

  const row = await ctx.env.DB.prepare('SELECT id FROM bj_craftsmen WHERE id = ?').bind(id).first();
  if (!row) return errorJson('师傅不存在', 404);

  await ctx.env.DB.prepare(
    `UPDATE bj_craftsmen SET
      status = COALESCE(?, status),
      notes = COALESCE(?, notes),
      id_verified = COALESCE(?, id_verified)
     WHERE id = ?`,
  )
    .bind(
      status,
      body.notes !== undefined ? body.notes.trim() || null : null,
      body.idVerified === undefined ? null : body.idVerified ? 1 : 0,
      id,
    )
    .run();

  return json({ ok: true });
};
