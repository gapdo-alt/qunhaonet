import { type Env, json, errorJson } from '../../../../src/lib/env';
import { requireAdmin } from '../../../../src/lib/beijing';

/** GET /api/beijing/craftsmen — 管理员：师傅列表 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  const { results } = await ctx.env.DB.prepare(
    `SELECT id, name, phone, categories, districts, id_verified, notes, status, created_at
     FROM bj_craftsmen ORDER BY created_at DESC`,
  ).all();
  return json({ craftsmen: results });
};

interface Body {
  name?: string;
  phone?: string;
  categories?: string | string[];
  districts?: string | string[];
  idVerified?: boolean;
  notes?: string;
  status?: string;
}

function toCsvList(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.map((s) => s.trim()).filter(Boolean).join(',');
  return (v ?? '').trim();
}

/** POST /api/beijing/craftsmen — 管理员：新增师傅 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  let body: Body;
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const name = (body.name ?? '').trim();
  const phone = (body.phone ?? '').trim();
  const categories = toCsvList(body.categories);
  const districts = toCsvList(body.districts);
  const status = (body.status ?? 'active').trim();

  if (!name || !phone || !categories || !districts) return errorJson('姓名/电话/品类/城区必填', 400);
  if (!['active', 'paused', 'left'].includes(status)) return errorJson('状态无效', 400);

  const id = crypto.randomUUID();
  await ctx.env.DB.prepare(
    `INSERT INTO bj_craftsmen
      (id, name, phone, categories, districts, id_verified, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      name,
      phone,
      categories,
      districts,
      body.idVerified ? 1 : 0,
      (body.notes ?? '').trim() || null,
      status,
      Date.now(),
    )
    .run();

  return json({ ok: true, id }, 201);
};
