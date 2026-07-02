import { Hono } from 'hono';
import type { AppEnv } from '../../lib/env.js';
import { json } from '../../lib/env.js';

type Ctx = { Variables: { env: AppEnv } };

export function configRoutes() {
  const app = new Hono<Ctx>();

  app.get('/', (c) => {
    const env = c.get('env');
    return json({
      publicHost: env.config.publicHost,
      cdnBaseUrl: env.config.cdnBaseUrl || null,
      turnstileSiteKey: env.config.turnstileSiteKey || null,
      passwordResetEnabled: !!(env.config.resendApiKey && env.config.resendFrom),
    });
  });

  return app;
}
