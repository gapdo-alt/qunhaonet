-- 北京单城试点：附加表（不破坏现有 users/codes）
-- 本地：npx wrangler d1 execute qunhao-db --local --file=./schema-beijing-pilot.sql
-- 远端：npx wrangler d1 execute qunhao-db --remote --file=./schema-beijing-pilot.sql

CREATE TABLE IF NOT EXISTS bj_directory_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  district TEXT,
  description TEXT,
  code TEXT,
  join_hint TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bj_craftsmen (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  categories TEXT NOT NULL,
  districts TEXT NOT NULL,
  id_verified INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bj_service_requests (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  district TEXT NOT NULL,
  address_hint TEXT,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web',
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bj_orders (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  craftsman_id TEXT,
  category TEXT NOT NULL,
  district TEXT NOT NULL,
  source TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  aftersale_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  fail_reason TEXT,
  complaint INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bj_requests_created ON bj_service_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_bj_orders_created ON bj_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_bj_directory_cat ON bj_directory_groups(category);

-- 冷启动目录占位（运营替换为真实群号/入群方式）
INSERT OR IGNORE INTO bj_directory_groups (id, name, category, district, description, code, join_hint, status, updated_at, created_at)
VALUES
  ('dir-xq-1', '北京朝阳示例小区业主群', 'xiaoqu', '朝阳', '试点主小区群：报修与邻里互助', NULL, '群主建群后填写群号或更新二维码；公告贴 /beijing/request', 'pending', unixepoch() * 1000, unixepoch() * 1000),
  ('dir-game-1', '北京主机游戏交流群', 'game', '全市', '辅线：主机玩家交流，不承担主利润', NULL, '自建或接管后上架群号；禁止卡带租赁群发', 'pending', unixepoch() * 1000, unixepoch() * 1000),
  ('dir-svc-1', '北京开锁维修需求对接（圈层内）', 'service', '朝阳', '需求侧说明与报修入口备份', NULL, '主要转化走报修表单，本群为补充', 'pending', unixepoch() * 1000, unixepoch() * 1000);
