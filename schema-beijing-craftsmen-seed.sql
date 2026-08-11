-- 冷启动：10 名师傅占位建档（电话为占位，上线前替换为真实联系人）
-- npx wrangler d1 execute qunhao-db --local --file=./schema-beijing-craftsmen-seed.sql

INSERT OR IGNORE INTO bj_craftsmen (id, name, phone, categories, districts, id_verified, notes, status, created_at) VALUES
  ('cm-bj-01', '张师傅', '13800000001', '开锁', '朝阳', 1, '可夜间紧急·占位请替换', 'active', unixepoch() * 1000),
  ('cm-bj-02', '李师傅', '13800000002', '水管,电路', '朝阳,通州', 1, '小修为主·占位请替换', 'active', unixepoch() * 1000),
  ('cm-bj-03', '王师傅', '13800000003', '水管', '通州', 1, '占位请替换', 'active', unixepoch() * 1000),
  ('cm-bj-04', '赵师傅', '13800000004', '电路', '朝阳', 1, '占位请替换', 'active', unixepoch() * 1000),
  ('cm-bj-05', '刘师傅', '13800000005', '开锁,水管', '朝阳', 1, '占位请替换', 'active', unixepoch() * 1000),
  ('cm-bj-06', '陈师傅', '13800000006', '水管', '朝阳,通州', 0, '待补实名·占位', 'paused', unixepoch() * 1000),
  ('cm-bj-07', '杨师傅', '13800000007', '开锁', '通州', 1, '占位请替换', 'active', unixepoch() * 1000),
  ('cm-bj-08', '黄师傅', '13800000008', '电路,水管', '朝阳', 1, '占位请替换', 'active', unixepoch() * 1000),
  ('cm-bj-09', '周师傅', '13800000009', '开锁', '朝阳,通州', 1, '占位请替换', 'active', unixepoch() * 1000),
  ('cm-bj-10', '吴师傅', '13800000010', '水管,电路', '通州', 1, '占位请替换', 'active', unixepoch() * 1000);
