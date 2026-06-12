# 群号（qunhao.net）v2

为群聊生成一个**永久不变**的 5 位数字链接，群二维码随时更换，分享出去的链接永远有效。

全部运行在 Cloudflare 免费层：**Pages（前端 + Functions）+ D1（数据库）+ R2（图片与预渲染页）+ KV（会话）**。

## 核心概念：三个二维码

| 二维码 | 内容 | 生命周期 |
|--------|------|----------|
| **A（永久码）** | `https://qunhao.net/{code}` | 创建群号时生成，与群号互锁、永不变，可印刷/分享 |
| **B（用户上传）** | 微信/飞书原始群码 | 上传后浏览器端解析出群链接 |
| **C（标准码）** | B 解析出的群链接 | 统一风格重绘 + 中心平台 logo，展示页与图片直链呈现 |

**流程**：用户上传 B → 浏览器 `jsQR` 解码 → 按域名识别微信群（`weixin.qq.com`）/飞书群（`feishu.cn`）→ 浏览器 canvas 重绘为 C（H 级纠错 + 中心 logo，PNG）→ 上传；服务端校验域名白名单后写入 R2 并重渲染展示页。访客用微信扫 A → 打开展示页 → 长按识别 C 入群。

> 二维码解码/重绘放在浏览器端，是为了规避 Workers 免费层 10ms CPU 限制；PNG（而非 SVG）是为了微信「长按识别」可靠生效。

## 功能

- 注册后每账号可创建 **最多 5 个群号**（5 位数字，10000–99999，8 选 1）
- 主页搜索框：输入群号直达；**不存在的群号统一跳转介绍页 `/intro`**
- 每个群号三个分享框：直链、嵌入图片链接、文字 `群号 12345 Qunhao.net`
- **单步上传**：点击「上传/替换二维码」选图后自动解析并上传
- 群主资料：微信号 + 微信二维码；展示页自带「二维码失效？联系群主」入口

## 路由

| 路由 | 说明 |
|------|------|
| `/` | 主页（搜索框） |
| `/{code}` | 展示页（R2 预渲染，群名 + 平台徽标 + 二维码 C）；未启用 → 302 `/intro` |
| `/i/{code}` | 二维码 C 图片直链（URL 不变，内容随替换更新） |
| `/a/{code}` | 二维码 A 图片（永久不变） |
| `/owner/{code}` | 群主信息页（微信号 / 微信二维码） |
| `/api/codes*`、`/api/profile*`、`/api/auth/*` | 控制台 API |

## 目录结构

```
qunhao/
├── wrangler.jsonc            # Pages 配置 + D1/R2/KV bindings
├── schema.sql                # D1 结构（v2，破坏性重建）
├── functions/                # Pages Functions
│   ├── api/auth/             # register / login / logout
│   ├── api/codes/            # 列表、创建、candidates、[code]/upload
│   ├── api/profile/          # 微信号、微信二维码
│   ├── [code].ts             # 展示页（R2 预渲染，未命中 302 /intro）
│   ├── i/[code].ts           # 二维码 C 直链
│   ├── a/[code].ts           # 二维码 A
│   ├── owner/[code].ts       # 群主信息页（动态）
│   └── owner-qr/[code].ts    # 群主微信二维码图片
├── public/                   # 静态前端
│   ├── index/intro/404/register/login/dashboard.html
│   ├── assets/qr-tools.js    # 客户端解码 B / 重绘 A、C
│   └── assets/vendor/        # jsQR、qrcode-generator（UMD）
├── scripts/qr-roundtrip-test.cjs  # QR 编解码回归测试
└── src/lib/                  # 密码哈希、会话、码生成、页面模板
```

## R2 存储布局

```
qr-a/{code}.png      二维码 A（创建时生成，永不变）
qr-c/{code}.png      二维码 C（每次替换更新）
pages/{code}.html    预渲染展示页
wechat-qr/{userId}   群主微信二维码
```

## 本地开发

```bash
npm install
npm run db:init:local     # 初始化/重置本地 D1（v2 为破坏性重建）
npm run dev               # http://localhost:8788
node scripts/qr-roundtrip-test.cjs   # QR 编解码回归测试
```

## 部署步骤

### 0. 前置条件

- Cloudflare 账号（免费即可）、Node.js 18+
- 已完成 v1 部署的资源（D1 `qunhao-db`、R2 `qunhao-qr`、KV）可直接复用

### 1. 登录

```bash
npx wrangler login
```

### 2. 创建云端资源（首次部署才需要）

```bash
npx wrangler d1 create qunhao-db        # database_id 填入 wrangler.jsonc
npx wrangler r2 bucket create qunhao-qr
npx wrangler kv namespace create SESSIONS   # id 填入 wrangler.jsonc
```

> 注意：新版 wrangler 会把新建资源自动追加进 `wrangler.jsonc`，如出现重复 binding 报错，删除自动追加的条目、保留 `DB` / `QR_BUCKET` / `SESSIONS` 三个并填好 id。

### 3. 初始化/升级云端数据库

```bash
npm run db:init:remote
```

> **v1 → v2 为破坏性变更**（群号从 8 位改 5 位、表结构重建），该命令会清空既有用户与群号数据。v1 遗留的 R2 对象（`codes/*`、`pages/*` 旧页面）可在 Dashboard 中手动清理，不影响 v2 运行。

### 4. 部署

```bash
npm run deploy
```

### 5. 绑定自定义域名

Dashboard → Workers & Pages → qunhao → Custom domains → 添加 `qunhao.net`；确认 `wrangler.jsonc` 的 `PUBLIC_HOST` 为 `qunhao.net`。

### 6.（可选）启用 Turnstile

1. Dashboard → Turnstile → Add widget（域名 `qunhao.net`，开发加 `localhost`）
2. `public/register.html` 填入 `TURNSTILE_SITE_KEY`
3. `npx wrangler pages secret put TURNSTILE_SECRET_KEY`，重新部署

### 7. 上线验证清单

- [ ] 注册 → 控制台创建群号（8 选 1 + 群名称）→ 列表显示三个分享框
- [ ] 上传微信群截图：自动识别为「微信群」，展示页二维码中心为微信 logo
- [ ] 上传飞书群截图：识别为「飞书群」，logo 切换
- [ ] 手机微信扫二维码 A → 打开展示页 → 长按识别二维码 C 可入群
- [ ] 替换上传后 `/i/{code}` ETag 变化，两类链接 URL 不变
- [ ] 创建第 6 个群号被拒（403）
- [ ] 不存在的群号（如 `/99999`）跳转 `/intro`
- [ ] 填写微信号 + 上传微信二维码后，`/owner/{code}` 正确展示
- [ ] 第二个账号无法上传到他人群号（403）

## 免费层注意事项

| 资源 | 免费额度 | 说明 |
|------|----------|------|
| Workers 请求 | 10 万/天 | 展示页 + 图片 + API 共享；静态页不计入 |
| KV 写入 | 1000/天 | 登录/注册/候选码次数上限 |
| D1 | 500 万读 / 10 万写每天 | 远超需求 |
| R2 | 10 GB 存储，出站免费 | 每个群号约 3 个小文件 |
| Pages 构建 | 500 次/月 | 仅代码部署消耗 |

超出 Workers 每日请求额度返回 Error 1027（次日 UTC 0 点恢复），不会自动扣费；流量增长后可升级 Workers Paid（$5/月）。
