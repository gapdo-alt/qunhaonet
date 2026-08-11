-- 本地演示：20 笔样例订单（仅用于验证记账与单位经济看板，非真实成交）
-- npx wrangler d1 execute qunhao-db --local --file=./schema-beijing-orders-demo.sql

INSERT OR IGNORE INTO bj_service_requests (id, category, district, address_hint, contact_name, contact_phone, description, source, status, created_at) VALUES
  ('req-demo-01','开锁','朝阳','示例小区A','用户1','13900000001','门锁异常','group','done', (unixepoch()-86400*10)*1000),
  ('req-demo-02','水管','通州','示例小区B','用户2','13900000002','漏水','web','done', (unixepoch()-86400*9)*1000),
  ('req-demo-03','电路','朝阳',NULL,'用户3','13900000003','跳闸','seo','failed', (unixepoch()-86400*8)*1000);

INSERT OR IGNORE INTO bj_orders (id, request_id, craftsman_id, category, district, source, amount_cents, commission_cents, aftersale_cents, status, fail_reason, complaint, notes, completed_at, created_at) VALUES
  ('ord-demo-01','req-demo-01','cm-bj-01','开锁','朝阳','group',18000,3600,0,'completed',NULL,0,'demo',(unixepoch()-86400*10)*1000,(unixepoch()-86400*10)*1000),
  ('ord-demo-02','req-demo-02','cm-bj-02','水管','通州','web',15000,3000,2000,'completed',NULL,1,'demo售后',(unixepoch()-86400*9)*1000,(unixepoch()-86400*9)*1000),
  ('ord-demo-03','req-demo-03','cm-bj-04','电路','朝阳','seo',0,0,0,'failed','用户改约美团',0,'demo',NULL,(unixepoch()-86400*8)*1000),
  ('ord-demo-04',NULL,'cm-bj-01','开锁','朝阳','group',20000,4000,0,'completed',NULL,0,'demo',(unixepoch()-86400*7)*1000,(unixepoch()-86400*7)*1000),
  ('ord-demo-05',NULL,'cm-bj-05','开锁','朝阳','referral',16000,3200,0,'completed',NULL,0,'demo',(unixepoch()-86400*7)*1000,(unixepoch()-86400*7)*1000),
  ('ord-demo-06',NULL,'cm-bj-02','水管','朝阳','group',12000,2400,0,'completed',NULL,0,'demo',(unixepoch()-86400*6)*1000,(unixepoch()-86400*6)*1000),
  ('ord-demo-07',NULL,'cm-bj-03','水管','通州','web',13000,2600,0,'completed',NULL,0,'demo',(unixepoch()-86400*6)*1000,(unixepoch()-86400*6)*1000),
  ('ord-demo-08',NULL,'cm-bj-08','电路','朝阳','seo',22000,4400,0,'completed',NULL,0,'demo',(unixepoch()-86400*5)*1000,(unixepoch()-86400*5)*1000),
  ('ord-demo-09',NULL,'cm-bj-07','开锁','通州','group',19000,3800,0,'completed',NULL,0,'demo',(unixepoch()-86400*5)*1000,(unixepoch()-86400*5)*1000),
  ('ord-demo-10',NULL,'cm-bj-09','开锁','朝阳','group',17000,3400,500,'completed',NULL,0,'demo',(unixepoch()-86400*4)*1000,(unixepoch()-86400*4)*1000),
  ('ord-demo-11',NULL,'cm-bj-02','水管','朝阳','web',14000,2800,0,'completed',NULL,0,'demo',(unixepoch()-86400*4)*1000,(unixepoch()-86400*4)*1000),
  ('ord-demo-12',NULL,'cm-bj-10','电路','通州','seo',21000,4200,0,'completed',NULL,0,'demo',(unixepoch()-86400*3)*1000,(unixepoch()-86400*3)*1000),
  ('ord-demo-13',NULL,'cm-bj-01','开锁','朝阳','group',18000,3600,0,'completed',NULL,0,'demo',(unixepoch()-86400*3)*1000,(unixepoch()-86400*3)*1000),
  ('ord-demo-14',NULL,'cm-bj-05','水管','朝阳','referral',11000,2200,0,'completed',NULL,0,'demo',(unixepoch()-86400*2)*1000,(unixepoch()-86400*2)*1000),
  ('ord-demo-15',NULL,'cm-bj-08','电路','朝阳','web',25000,5000,0,'completed',NULL,0,'demo',(unixepoch()-86400*2)*1000,(unixepoch()-86400*2)*1000),
  ('ord-demo-16',NULL,'cm-bj-03','水管','通州','group',16000,3200,0,'completed',NULL,0,'demo',(unixepoch()-86400*1)*1000,(unixepoch()-86400*1)*1000),
  ('ord-demo-17',NULL,'cm-bj-07','开锁','通州','seo',17500,3500,0,'completed',NULL,0,'demo',(unixepoch()-86400*1)*1000,(unixepoch()-86400*1)*1000),
  ('ord-demo-18',NULL,'cm-bj-09','开锁','朝阳','group',18500,3700,0,'completed',NULL,0,'demo',unixepoch()*1000,unixepoch()*1000),
  ('ord-demo-19',NULL,'cm-bj-02','水管','朝阳','web',14500,2900,0,'completed',NULL,0,'demo',unixepoch()*1000,unixepoch()*1000),
  ('ord-demo-20',NULL,'cm-bj-04','电路','朝阳','group',23000,4600,0,'completed',NULL,1,'demo投诉',unixepoch()*1000,unixepoch()*1000);
