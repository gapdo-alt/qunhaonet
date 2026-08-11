import { type Env, json } from '../../../../src/lib/env';
import { requireAdmin, centsToYuan } from '../../../../src/lib/beijing';

/** GET /api/beijing/metrics — 管理员：单位经济汇总 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  const url = new URL(ctx.request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 90), 7), 365);
  const since = Date.now() - days * 86_400_000;

  const reqRow = await ctx.env.DB.prepare(
    `SELECT
       COUNT(*) AS n,
       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_n
     FROM bj_service_requests WHERE created_at >= ? AND status != 'cancelled'`,
  )
    .bind(since)
    .first<{ n: number; done_n: number | null }>();

  const orderAgg = await ctx.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status = 'completed' THEN amount_cents ELSE 0 END) AS amount_sum,
       SUM(CASE WHEN status = 'completed' THEN commission_cents ELSE 0 END) AS commission_sum,
       SUM(CASE WHEN status = 'completed' THEN aftersale_cents ELSE 0 END) AS aftersale_sum,
       SUM(CASE WHEN status = 'completed' AND complaint = 1 THEN 1 ELSE 0 END) AS complaints
     FROM bj_orders WHERE created_at >= ?`,
  )
    .bind(since)
    .first<{
      completed: number | null;
      failed: number | null;
      amount_sum: number | null;
      commission_sum: number | null;
      aftersale_sum: number | null;
      complaints: number | null;
    }>();

  const validRequests = reqRow?.n ?? 0;
  const doneRequests = reqRow?.done_n ?? 0;
  const completed = orderAgg?.completed ?? 0;
  const failed = orderAgg?.failed ?? 0;
  const amountSum = orderAgg?.amount_sum ?? 0;
  const commissionSum = orderAgg?.commission_sum ?? 0;
  const aftersaleSum = orderAgg?.aftersale_sum ?? 0;
  const complaints = orderAgg?.complaints ?? 0;

  // 需求→成交率：以需求单是否落地为准（避免手工补录订单把比率撑破）
  const conversionRate = validRequests > 0 ? doneRequests / validRequests : null;
  const avgOrderYuan = completed > 0 ? centsToYuan(amountSum / completed) : null;
  const avgGrossYuan = completed > 0 ? centsToYuan((commissionSum - aftersaleSum) / completed) : null;
  const complaintRate = completed > 0 ? complaints / completed : null;

  const continueOk =
    completed >= 20 &&
    conversionRate !== null &&
    conversionRate >= 0.3 &&
    avgGrossYuan !== null &&
    avgGrossYuan > 0 &&
    (complaintRate === null || complaintRate <= 0.15);

  const stopTriggers: string[] = [];
  if (completed < 5 && days >= 60) stopTriggers.push('成交过少');
  if (avgGrossYuan !== null && avgGrossYuan <= 0) stopTriggers.push('单均毛利非正');
  if (complaintRate !== null && complaintRate > 0.25) stopTriggers.push('投诉率过高');

  return json({
    city: '北京',
    days,
    validRequests,
    doneRequests,
    completedOrders: completed,
    failedOrders: failed,
    conversionRate,
    avgOrderYuan,
    avgGrossYuan,
    complaintRate,
    totals: {
      amountYuan: centsToYuan(amountSum),
      commissionYuan: centsToYuan(commissionSum),
      aftersaleYuan: centsToYuan(aftersaleSum),
    },
    decision: {
      continueOk,
      stopTriggers,
      note: continueOk
        ? '指标接近继续标准（仍需人工确认连续 4 周与 CAC）'
        : '尚未达到继续扩量标准，坚持单城验证或对照停损条款',
    },
  });
};
