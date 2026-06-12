import { type Env, json } from '../../../src/lib/env';
import { generateCandidates } from '../../../src/lib/codes';
import { getSessionUserId } from '../../../src/lib/auth';

const CANDIDATE_TTL_SECONDS = 15 * 60;

/** GET /api/codes/candidates — 返回 8 个可选 5 位数字 + 候选令牌（15 分钟有效） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const userId = await getSessionUserId(ctx.request, ctx.env);
  if (!userId) return json({ error: '请先登录' }, 401);

  const codes = await generateCandidates(ctx.env.DB, 8);
  const token = crypto.randomUUID();
  await ctx.env.SESSIONS.put(`cand:${token}`, JSON.stringify(codes), {
    expirationTtl: CANDIDATE_TTL_SECONDS,
  });
  return json({ token, codes, host: ctx.env.PUBLIC_HOST });
};
