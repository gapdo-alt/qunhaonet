import { type Env, json, errorJson } from '../../../../src/lib/env';
import { requireAdmin, yuanToCents, BJ_ORDER_STATUSES } from '../../../../src/lib/beijing';

/** PATCH /api/beijing/orders/:id */
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  const id = ctx.params.id as string;
  let body: {
    status?: string;
    aftersaleYuan?: number | string;
    failReason?: string;
    complaint?: boolean;
    notes?: string;
  };
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const existing = await ctx.env.DB.prepare('SELECT id, status FROM bj_orders WHERE id = ?')
    .bind(id)
    .first<{ id: string; status: string }>();
  if (!existing) return errorJson('订单不存在', 404);

  const status = body.status !== undefined ? body.status.trim() : existing.status;
  if (!BJ_ORDER_STATUSES.includes(status as (typeof BJ_ORDER_STATUSES)[number])) {
    return errorJson('状态无效', 400);
  }

  const aftersale =
    body.aftersaleYuan !== undefined ? yuanToCents(body.aftersaleYuan) : null;
  if (body.aftersaleYuan !== undefined && aftersale === null) return errorJson('售后金额无效', 400);

  const completedAt = status === 'completed' ? Date.now() : null;

  await ctx.env.DB.prepare(
    `UPDATE bj_orders SET
      status = ?,
      aftersale_cents = COALESCE(?, aftersale_cents),
      fail_reason = COALESCE(?, fail_reason),
      complaint = COALESCE(?, complaint),
      notes = COALESCE(?, notes),
      completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE completed_at END
     WHERE id = ?`,
  )
    .bind(
      status,
      aftersale,
      body.failReason !== undefined ? body.failReason.trim() || null : null,
      body.complaint === undefined ? null : body.complaint ? 1 : 0,
      body.notes !== undefined ? body.notes.trim() || null : null,
      status,
      completedAt,
      id,
    )
    .run();

  return json({ ok: true });
};
