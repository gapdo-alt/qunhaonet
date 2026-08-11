import { type Env, json, errorJson } from '../../../../src/lib/env';
import { BJ_CATEGORIES, BJ_SOURCES } from '../../../../src/lib/beijing';

interface Body {
  category?: string;
  district?: string;
  addressHint?: string;
  contactName?: string;
  contactPhone?: string;
  description?: string;
  source?: string;
}

/** POST /api/beijing/requests — 公开报修/需求提交 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: Body;
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const category = (body.category ?? '').trim();
  const district = (body.district ?? '').trim();
  const contactName = (body.contactName ?? '').trim();
  const contactPhone = (body.contactPhone ?? '').trim();
  const description = (body.description ?? '').trim();
  const addressHint = (body.addressHint ?? '').trim();
  const source = (body.source ?? 'web').trim();

  if (!BJ_CATEGORIES.includes(category as (typeof BJ_CATEGORIES)[number])) {
    return errorJson('品类无效', 400);
  }
  if (!district || district.length > 40) return errorJson('请填写服务城区', 400);
  if (!contactName || contactName.length > 40) return errorJson('请填写称呼', 400);
  if (!/^1\d{10}$/.test(contactPhone) && !/^[\d\-+\s]{7,20}$/.test(contactPhone)) {
    return errorJson('联系电话格式不正确', 400);
  }
  if (!description || description.length > 1000) return errorJson('请填写需求说明（最多 1000 字）', 400);
  if (!BJ_SOURCES.includes(source as (typeof BJ_SOURCES)[number])) {
    return errorJson('来源无效', 400);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await ctx.env.DB.prepare(
    `INSERT INTO bj_service_requests
      (id, category, district, address_hint, contact_name, contact_phone, description, source, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
  )
    .bind(id, category, district, addressHint || null, contactName, contactPhone, description, source, now)
    .run();

  return json({ ok: true, id }, 201);
};

/** GET /api/beijing/requests — 管理员：需求列表 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { requireAdmin } = await import('../../../../src/lib/beijing');
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  const url = new URL(ctx.request.url);
  const status = url.searchParams.get('status');
  let sql =
    `SELECT id, category, district, address_hint, contact_name, contact_phone, description, source, status, created_at
     FROM bj_service_requests`;
  const binds: string[] = [];
  if (status) {
    sql += ' WHERE status = ?';
    binds.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT 200';

  const stmt = ctx.env.DB.prepare(sql);
  const { results } = binds.length
    ? await stmt.bind(...binds).all()
    : await stmt.all();

  return json({ requests: results });
};
