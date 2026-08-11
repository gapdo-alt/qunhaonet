#!/usr/bin/env node
/**
 * 北京试点闭环冒烟：目录 → 报修 →（需已登录管理员 cookie 文件）订单/指标说明
 * 用法：
 *   node scripts/beijing-pilot-smoke.cjs [baseUrl]
 */
const base = process.argv[2] || 'http://localhost:8788';

async function main() {
  const dir = await fetch(`${base}/api/beijing/directory`).then((r) => r.json());
  if (!Array.isArray(dir.groups)) throw new Error('directory failed');

  const req = await fetch(`${base}/api/beijing/requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      category: '水管',
      district: '通州',
      contactName: '冒烟测试',
      contactPhone: '13912345678',
      description: '自动化冒烟：水龙头滴水',
      source: 'web',
    }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

  if (req.status !== 201 || !req.body.id) throw new Error('request create failed: ' + JSON.stringify(req));

  const pages = ['/beijing', '/beijing/request', '/beijing/xiaoqu', '/beijing/kaiguan', '/beijing/game', '/beijing/ops', '/beijing/metrics'];
  for (const p of pages) {
    const res = await fetch(base + p);
    if (!res.ok) throw new Error(`page ${p} -> ${res.status}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        city: dir.city,
        groups: dir.groups.length,
        requestId: req.body.id,
        pagesChecked: pages.length,
        next: '管理员在 /beijing/ops 派单记账；/beijing/metrics 看单位经济。演示 20 单：npx wrangler d1 execute qunhao-db --local --file=./schema-beijing-orders-demo.sql',
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
