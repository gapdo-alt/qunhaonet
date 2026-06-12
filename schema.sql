-- 群号服务 D1 数据库结构 v2
-- 注意：v1 → v2 为破坏性变更（重建表）
-- 初始化：wrangler d1 execute qunhao-db --remote --file=./schema.sql

DROP TABLE IF EXISTS codes;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS code_candidates;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  wechat_id TEXT,
  has_wechat_qr INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 5 位群号，一个用户最多 5 个（创建接口计数校验）
CREATE TABLE codes (
  code TEXT PRIMARY KEY CHECK(length(code) = 5),
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  platform TEXT,            -- 'wechat' | 'feishu'，NULL 表示未上传
  group_url TEXT,           -- 二维码 B 解析出的群链接
  updated_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_codes_user ON codes(user_id);
