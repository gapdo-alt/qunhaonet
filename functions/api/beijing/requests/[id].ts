import { type Env, json, errorJson } from '../../../../src/lib/env';
import { requireAdmin, BJ_REQUEST_STATUSES } from '../../../../src/lib/beijing';

/** PATCH /api/beijing/requests/:id — 更新需求状态 */
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  const id = ctx.params.id as string;
  let body: { status?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const status = (body.status ?? '').trim();
  if (!BJ_REQUEST_STATUSES.includes(status as (typeof BJ_REQUEST_STATUSES)[number])) {
    return errorJson('状态无效', 400);
  }

  const result = await ctx.env.DB.prepare('UPDATE bj_service_requests SET status = ? WHERE id = ?')
    .bind(status, id)
    .run();
  if (!result.meta.changes) return errorJson('需求不存在', 404);
  return json({ ok: true });
};
