import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import type { AppEnv } from '../lib/env.js';
import { loadConfig, SCHEMA_PATH, PUBLIC_DIR } from './config.js';
import { openDatabase } from '../adapters/sqlite.js';
import { createRedisKv } from '../adapters/redis-kv.js';
import { createObjectStorage, ensureBucket } from '../adapters/s3-storage.js';
import { applySecurityHeaders } from './middleware/security.js';
import { authRoutes } from './routes/auth.js';
import { codesRoutes } from './routes/codes.js';
import { profileRoutes } from './routes/profile.js';
import { adminRoutes } from './routes/admin.js';
import { configRoutes } from './routes/config.js';
import { publicRoutes, landingRoute } from './routes/public.js';
import { json } from '../lib/env.js';

type Variables = { env: AppEnv };

const HTML_PAGES = [
  'index', 'intro', 'login', 'register', 'dashboard', 'dashboard-detail',
  'admin', '404', 'forgot-password', 'reset-password',
];

function createApp(env: AppEnv): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', async (c, next) => {
    c.set('env', env);
    await next();
    c.res = applySecurityHeaders(c.res);
  });

  app.get('/health', async (c) => {
    const e = c.get('env');
    const [redisOk, storageOk] = await Promise.all([e.kv.ping(), e.storage.ping()]);
    const ok = redisOk && storageOk;
    return json({ ok, redis: redisOk, storage: storageOk }, ok ? 200 : 503);
  });

  app.route('/api/auth', authRoutes());
  app.route('/api/codes', codesRoutes());
  app.route('/api/profile', profileRoutes());
  app.route('/api/admin', adminRoutes());
  app.route('/api/config', configRoutes());

  app.route('/', publicRoutes());

  for (const page of HTML_PAGES) {
    if (page === 'index') continue;
    app.get(`/${page}`, async (c) => {
      const file = path.join(PUBLIC_DIR, `${page}.html`);
      if (!fs.existsSync(file)) return c.notFound();
      const html = await fs.promises.readFile(file, 'utf8');
      return c.html(html);
    });
  }

  app.get('/', async (c) => {
    const html = await fs.promises.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    return c.html(html);
  });

  app.use('/assets/*', serveStatic({ root: PUBLIC_DIR }));
  app.get('/favicon.svg', serveStatic({ path: path.join(PUBLIC_DIR, 'favicon.svg') }));

  app.route('/', landingRoute());

  app.notFound(async (c) => {
    const file = path.join(PUBLIC_DIR, '404.html');
    if (fs.existsSync(file)) {
      const html = await fs.promises.readFile(file, 'utf8');
      return c.html(html, 404);
    }
    return c.text('Not Found', 404);
  });

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(config.databasePath, SCHEMA_PATH);
  const kv = createRedisKv(config.redisUrl);

  const s3Config = {
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    bucket: config.s3Bucket,
    accessKey: config.s3AccessKey,
    secretKey: config.s3SecretKey,
  };
  await ensureBucket(s3Config);
  const storage = createObjectStorage(s3Config);

  const env: AppEnv = { config, db, kv, storage };
  const app = createApp(env);

  serve({ fetch: app.fetch, port: config.port }, () => {
    console.log(JSON.stringify({ event: 'server_start', port: config.port, host: config.publicHost }));
  });

  const shutdown = () => {
    console.log(JSON.stringify({ event: 'server_shutdown' }));
    db.close();
    void kv.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
