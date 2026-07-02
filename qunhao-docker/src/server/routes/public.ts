import { Hono } from 'hono';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Context } from 'hono';
import type { AppEnv } from '../../lib/env.js';
import {
  isNumericCode,
  isCodeSegment,
  resolveCanonicalCode,
  toCodeKey,
} from '../../lib/codes.js';
import { getCanonicalCode } from '../../adapters/redis-kv.js';
import { writeHttpMetadata } from '../../adapters/s3-storage.js';
import { renderOwnerPage } from '../../lib/template.js';
import { CACHE } from '../../lib/cache.js';
import { PUBLIC_DIR } from '../config.js';

type Ctx = { Variables: { env: AppEnv } };

async function bodyToArrayBuffer(body: ReadableStream<Uint8Array> | NodeJS.ReadableStream): Promise<ArrayBuffer> {
  if (body instanceof ReadableStream) {
    return new Response(body).arrayBuffer();
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).buffer;
}

export function publicRoutes() {
  const app = new Hono<Ctx>();

  app.get('/owner/:code', async (c) => {
    const env = c.get('env');
    const segment = c.req.param('code');
    if (!isCodeSegment(segment)) return new Response('Not found', { status: 404 });

    const row = await env.db
      .prepare(
        `SELECT c.code, c.name, u.wechat_id, u.has_wechat_qr
         FROM codes c JOIN users u ON u.id = c.user_id
         WHERE c.code_key = ?`,
      )
      .bind(toCodeKey(segment))
      .first<{ code: string; name: string; wechat_id: string | null; has_wechat_qr: number }>();

    if (!row) return c.redirect('/intro', 302);
    if (row.code !== segment) return c.redirect(`/owner/${row.code}`, 302);

    return c.html(
      renderOwnerPage({
        code: row.code,
        host: env.config.publicHost,
        name: row.name,
        wechatId: row.wechat_id,
        hasWechatQr: row.has_wechat_qr === 1,
      }),
      200,
      { 'cache-control': CACHE.OWNER },
    );
  });

  app.get('/owner-qr/:code', async (c) => {
    const env = c.get('env');
    const segment = c.req.param('code');
    if (!isCodeSegment(segment)) return new Response('Not found', { status: 404 });

    let code = segment;
    if (!isNumericCode(segment)) {
      const canonical = await getCanonicalCode(env.kv, env.db, segment, toCodeKey);
      if (!canonical) return new Response('Not found', { status: 404 });
      if (canonical !== segment) return c.redirect(`/owner-qr/${canonical}`, 302);
      code = canonical;
    }

    const row = await env.db.prepare('SELECT user_id FROM codes WHERE code = ?').bind(code).first<{ user_id: string }>();
    if (!row) return new Response('Not found', { status: 404 });

    const object = await env.storage.get(`wechat-qr/${row.user_id}`);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    writeHttpMetadata(headers, object);
    headers.set('cache-control', CACHE.QR_C);
    return new Response(object.body as BodyInit, { headers });
  });

  app.get('/dashboard/:code', async (c) => {
    const env = c.get('env');
    const segment = c.req.param('code');
    if (!isCodeSegment(segment)) return new Response('Not found', { status: 404 });

    if (!isNumericCode(segment)) {
      const canonical = await resolveCanonicalCode(env.db, segment);
      if (canonical && canonical !== segment) return c.redirect(`/dashboard/${canonical}`, 302);
    }

    const html = await fs.readFile(path.join(PUBLIC_DIR, 'dashboard-detail.html'), 'utf8');
    return c.html(html, 200, { 'cache-control': CACHE.PRIVATE });
  });

  app.get('/a/:code', (c) => serveQrImage(c, 'qr-a', CACHE.QR_A, '/a/'));
  app.get('/i/:code', (c) => serveQrImage(c, 'qr-c', CACHE.QR_C, '/i/'));

  return app;
}

/** 群号展示页，须在静态路由之后注册 */
export function landingRoute() {
  const app = new Hono<Ctx>();

  app.get('/:code', async (c) => {
    const env = c.get('env');
    const segment = c.req.param('code');
    if (!isCodeSegment(segment)) return c.notFound();

    let code = segment;
    if (!isNumericCode(segment)) {
      const canonical = await getCanonicalCode(env.kv, env.db, segment, toCodeKey);
      if (!canonical) return c.redirect('/intro', 302);
      if (canonical !== segment) return c.redirect(`/${canonical}`, 302);
      code = canonical;
    }

    const object = await env.storage.get(`pages/${code}.html`);
    if (!object) return c.redirect('/intro', 302);

    const etag = object.httpEtag;
    if (c.req.header('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { etag, 'cache-control': CACHE.PAGE } });
    }

    const buf = await bodyToArrayBuffer(object.body);
    return new Response(buf, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': CACHE.PAGE,
        etag,
      },
    });
  });

  return app;
}

async function serveQrImage(
  c: Context<Ctx>,
  prefix: 'qr-a' | 'qr-c',
  cacheControl: string,
  pathPrefix: string,
) {
  const env = c.get('env');
  const segment = c.req.param('code');
  if (!isCodeSegment(segment)) return new Response('Not found', { status: 404 });

  let code = segment;
  if (!isNumericCode(segment)) {
    const canonical = await getCanonicalCode(env.kv, env.db, segment, toCodeKey);
    if (!canonical) return new Response('Not found', { status: 404 });
    if (canonical !== segment) return c.redirect(`${pathPrefix}${canonical}`, 302);
    code = canonical;
  }

  const object = await env.storage.get(`${prefix}/${code}.png`);
  if (!object) return new Response('Not found', { status: 404 });

  const etag = object.httpEtag;
  if (c.req.header('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag, 'cache-control': cacheControl } });
  }

  const headers = new Headers();
  writeHttpMetadata(headers, object);
  headers.set('etag', etag);
  headers.set('cache-control', cacheControl);
  headers.set('access-control-allow-origin', '*');
  return new Response(object.body as BodyInit, { headers });
}
