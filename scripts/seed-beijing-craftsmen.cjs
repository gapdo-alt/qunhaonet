#!/usr/bin/env node
/**
 * 打印北京试点师傅种子导入命令（实际写入走 wrangler d1）
 */
console.log(`
北京试点 · 师傅种子

1) 先确保试点表已创建：
   npm run db:beijing:local

2) 导入 10 名占位师傅：
   npx wrangler d1 execute qunhao-db --local --file=./schema-beijing-craftsmen-seed.sql

远端：
   npm run db:beijing:remote
   npx wrangler d1 execute qunhao-db --remote --file=./schema-beijing-craftsmen-seed.sql

上线前请在 /beijing/ops 将电话与实名替换为真实师傅，paused 状态勿派单。
`);
