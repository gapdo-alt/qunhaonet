import { type Env, json } from '../../../src/lib/env';
import { generateCandidates } from '../../../src/lib/codes';

const CANDIDATE_TTL_SECONDS = 15 * 60;

/** GET /api/codes/candidates — 返回 5 个可选 8 位数字 + 候选令牌（15 分钟有效） */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const codes = await generateCandidates(ctx.env.DB, 5);
  const token = crypto.randomUUID();
  await ctx.env.SESSIONS.put(`cand:${token}`, JSON.stringify(codes), {
    expirationTtl: CANDIDATE_TTL_SECONDS,
  });
  return json({ token, codes });
};
