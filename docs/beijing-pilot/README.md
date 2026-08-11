# 北京单城试点（产品落地说明）

对应商业方案：北京唯一试点 · 小区服务撮合主线 · 主机游戏辅线。

## 文档

| 文件 | 用途 |
|---|---|
| [SCOPE.md](./SCOPE.md) | 范围锁定（做/不做） |
| [GROUP_RULES.md](./GROUP_RULES.md) | 群规与冷启动清单 |
| [CRAFTSMAN_ONBOARDING.md](./CRAFTSMAN_ONBOARDING.md) | 师傅建档 |
| [ORDER_SOP.md](./ORDER_SOP.md) | 派单成交 SOP |
| [UNIT_ECONOMICS.md](./UNIT_ECONOMICS.md) | 单位经济与去留 |
| [templates/](./templates/) | CSV 台账模板 |

## 站点路由

| 路径 | 说明 |
|---|---|
| `/beijing` | 群目录 + 试点说明 |
| `/beijing/request` | 公开报修表单 |
| `/beijing/xiaoqu` `/beijing/kaiguan` `/beijing/game` | SEO 落地页 |
| `/beijing/ops` | 管理员运营台（需求/师傅/订单/目录） |
| `/beijing/metrics` | 单位经济看板 |

## 数据库

```bash
npm run db:beijing:local    # 创建试点表 + 目录占位
npx wrangler d1 execute qunhao-db --local --file=./schema-beijing-craftsmen-seed.sql
npm run seed:beijing:orders:demo   # 可选：20 笔演示订单（非真实成交）
npm run test:beijing:smoke
npm run seed:beijing:craftsmen   # 打印说明
```

远端将 `local` 换成 `remote` / `db:beijing:remote`。

## API

- `GET/POST /api/beijing/directory`
- `POST/GET /api/beijing/requests`，`PATCH /api/beijing/requests/:id`
- `GET/POST /api/beijing/craftsmen`，`PATCH /api/beijing/craftsmen/:id`
- `GET/POST /api/beijing/orders`，`PATCH /api/beijing/orders/:id`
- `GET /api/beijing/metrics`

公开可写：仅报修 `POST /api/beijing/requests`。其余需管理员会话。
