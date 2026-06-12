-- 群号服务 D1 数据库结构
-- 初始化：wrangler d1 execute qunhao-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 8 位数字与用户的绑定（一人一码）
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY CHECK(length(code) = 8),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  content_type TEXT,
  updated_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_codes_user ON codes(user_id);
