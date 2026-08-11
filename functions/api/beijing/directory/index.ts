import { type Env, json, errorJson } from '../../../../src/lib/env';

/** GET /api/beijing/directory — 公开：北京群目录 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const category = url.searchParams.get('category');

  let sql =
    `SELECT id, name, category, district, description, code, join_hint, status, updated_at, created_at
     FROM bj_directory_groups WHERE status IN ('active', 'pending')`;
  const binds: string[] = [];
  if (category) {
    sql += ' AND category = ?';
    binds.push(category);
  }
  sql += ' ORDER BY category, name';

  const stmt = ctx.env.DB.prepare(sql);
  const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
  return json({ groups: results, city: '北京', pilotDistrict: '朝阳/通州相邻带' });
};

interface DirBody {
  id?: string;
  name?: string;
  category?: string;
  district?: string;
  description?: string;
  code?: string;
  joinHint?: string;
  status?: string;
}

/** POST /api/beijing/directory — 管理员：新建或更新目录项 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { requireAdmin } = await import('../../../../src/lib/beijing');
  const auth = await requireAdmin(ctx.request, ctx.env);
  if (auth.error) return auth.error;

  let body: DirBody;
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('请求格式错误', 400);
  }

  const name = (body.name ?? '').trim();
  const category = (body.category ?? '').trim();
  if (!name || !['xiaoqu', 'game', 'service'].includes(category)) {
    return errorJson('名称或分类无效', 400);
  }

  const now = Date.now();
  const id = (body.id ?? '').trim() || crypto.randomUUID();
  const status = (body.status ?? 'pending').trim();
  if (!['active', 'pending', 'expired'].includes(status)) return errorJson('状态无效', 400);

  await ctx.env.DB.prepare(
    `INSERT INTO bj_directory_groups
      (id, name, category, district, description, code, join_hint, status, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      district = excluded.district,
      description = excluded.description,
      code = excluded.code,
      join_hint = excluded.join_hint,
      status = excluded.status,
      updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      name,
      category,
      (body.district ?? '').trim() || null,
      (body.description ?? '').trim() || null,
      (body.code ?? '').trim() || null,
      (body.joinHint ?? '').trim() || null,
      status,
      now,
      now,
    )
    .run();

  return json({ ok: true, id });
};
