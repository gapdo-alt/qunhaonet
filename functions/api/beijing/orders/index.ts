import { type Env, json, errorJson } from '../../../../src/lib/env';
import {
  requireAdmin,
  yuanToCents,
  BJ_SOURCES,
  BJ_ORDER_STATUSES,
} from '../../../../src/lib/beijing';

/** GET /api/beijing/orders — 管理员：订单列表 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  const { results } = await ctx.env.DB.prepare(
    `SELECT o.*, c.name AS craftsman_name
     FROM bj_orders o
     LEFT JOIN bj_craftsmen c ON c.id = o.craftsman_id
     ORDER BY o.created_at DESC LIMIT 300`,
  ).all();
  return json({ orders: results });
};

interface Body {
  requestId?: string;
  craftsmanId?: string;
  category?: string;
  district?: string;
  source?: string;
  amountYuan?: number | string;
  commissionYuan?: number | string;
  aftersaleYuan?: number | string;
  status?: string;
  failReason?: string;
  complaint?: boolean;
  notes?: string;
}

/** POST /api/beijing/orders — 管理员：录入订单 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  let body: Body;
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const category = (body.category ?? '').trim();
  const district = (body.district ?? '').trim();
  const source = (body.source ?? 'group').trim();
  const status = (body.status ?? 'open').trim();
  const amount = yuanToCents(body.amountYuan);
  const commission = yuanToCents(body.commissionYuan ?? 0);
  const aftersale = yuanToCents(body.aftersaleYuan ?? 0);

  if (!category || !district) return errorJson('品类与城区必填', 400);
  if (!BJ_SOURCES.includes(source as (typeof BJ_SOURCES)[number])) return errorJson('来源无效', 400);
  if (!BJ_ORDER_STATUSES.includes(status as (typeof BJ_ORDER_STATUSES)[number])) {
    return errorJson('状态无效', 400);
  }
  if (amount === null || commission === null || aftersale === null) {
    return errorJson('金额格式无效', 400);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const completedAt = status === 'completed' ? now : null;

  await ctx.env.DB.prepare(
    `INSERT INTO bj_orders
      (id, request_id, craftsman_id, category, district, source,
       amount_cents, commission_cents, aftersale_cents, status, fail_reason, complaint, notes, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      (body.requestId ?? '').trim() || null,
      (body.craftsmanId ?? '').trim() || null,
      category,
      district,
      source,
      amount,
      commission,
      aftersale,
      status,
      (body.failReason ?? '').trim() || null,
      body.complaint ? 1 : 0,
      (body.notes ?? '').trim() || null,
      completedAt,
      now,
    )
    .run();

  if (body.requestId) {
    const reqStatus = status === 'completed' ? 'done' : status === 'failed' ? 'failed' : 'assigned';
    await ctx.env.DB.prepare('UPDATE bj_service_requests SET status = ? WHERE id = ?')
      .bind(reqStatus, body.requestId)
      .run();
  }

  return json({ ok: true, id }, 201);
};
