-- 群号服务 D1 数据库结构 v3
-- 注意：v2 → v3 为破坏性变更（重建表）
-- 初始化：wrangler d1 execute qunhao-db --remote --file=./schema.sql

DROP TABLE IF EXISTS codes;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS code_candidates;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'premium' | 'admin'
  wechat_id TEXT,
  has_wechat_qr INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 群号：普通用户 5 位数字；高级会员 3-10 位字母数字（创建时原样保存大小写）
CREATE TABLE codes (
  code TEXT PRIMARY KEY,                 -- 规范形态（创建时大小写），用于所有对外 URL
  code_key TEXT NOT NULL UNIQUE,         -- 查重键：自定义码 = lower(code)；数字码 = code
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  platform TEXT,                         -- 'wechat' | 'feishu'，NULL 表示未上传
  group_url TEXT,
  updated_at INTEGER,
  created_at INTEGER NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0   -- 1 = 高级会员自定义码
);

CREATE INDEX idx_codes_user ON codes(user_id);
