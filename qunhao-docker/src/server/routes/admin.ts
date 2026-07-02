import { Hono } from 'hono';
import type { AppEnv } from '../../lib/env.js';
import { json } from '../../lib/env.js';
import { getSessionUser } from '../../lib/auth.js';

type Ctx = { Variables: { env: AppEnv } };

export function adminRoutes() {
  const app = new Hono<Ctx>();

  app.get('/users', async (c) => {
    const env = c.get('env');
    const user = await getSessionUser(c.req.raw, env);
    if (!user) return json({ error: '请先登录' }, 401);
    if (user.role !== 'admin') return json({ error: '需要管理员权限' }, 403);

    const { results } = await env.db
      .prepare(
        `SELECT u.id, u.email, u.role, u.created_at, COUNT(c.code) AS code_count
         FROM users u LEFT JOIN codes c ON c.user_id = u.id
         GROUP BY u.id ORDER BY u.created_at`,
      )
      .all<{ id: string; email: string; role: string; created_at: number; code_count: number }>();

    return json({ users: results, me: user.id });
  });

  app.put('/users/:id', async (c) => {
    const env = c.get('env');
    const me = await getSessionUser(c.req.raw, env);
    if (!me) return json({ error: '请先登录' }, 401);
    if (me.role !== 'admin') return json({ error: '需要管理员权限' }, 403);

    const targetId = c.req.param('id');
    let body: { role?: string };
    try {
      body = await c.req.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const role = body.role;
    if (role !== 'user' && role !== 'premium') return json({ error: '角色仅支持 user 或 premium' }, 400);
    if (targetId === me.id) return json({ error: '不能修改自己的角色' }, 400);

    const target = await env.db.prepare('SELECT id, role FROM users WHERE id = ?').bind(targetId).first<{ id: string; role: string }>();
    if (!target) return json({ error: '用户不存在' }, 404);
    if (target.role === 'admin') return json({ error: '不能修改管理员的角色' }, 400);

    await env.db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, targetId).run();
    return json({ ok: true, id: targetId, role });
  });

  return app;
}
