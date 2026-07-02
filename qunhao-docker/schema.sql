-- 群号服务 SQLite 结构 v3

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  wechat_id TEXT,
  has_wechat_qr INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  code_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  platform TEXT,
  group_url TEXT,
  updated_at INTEGER,
  created_at INTEGER NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_codes_user ON codes(user_id);
