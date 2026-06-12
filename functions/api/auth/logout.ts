import { type Env, json } from '../../../src/lib/env';
import { deleteSession, clearSessionCookie } from '../../../src/lib/auth';

/** POST /api/auth/logout */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  await deleteSession(ctx.request, ctx.env);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
};
