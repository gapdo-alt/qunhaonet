# 群号（qunhao.net）

为群聊生成一个**永久不变**的 8 位数字链接，群二维码随时更换，分享出去的链接永远有效。

全部运行在 Cloudflare 免费层：**Pages（前端 + Functions）+ D1（数据库）+ R2（图片与预渲染页）+ KV（会话）**。

## 功能

| 链接 | 说明 |
|------|------|
| `qunhao.net/88888888` | 展示页：手机/电脑自适应的简洁页面，居中呈现二维码 |
| `qunhao.net/i/88888888` | 图片直链：可嵌入论坛、博客、文档 |

- 注册时从 5 个随机 8 位数字中选择一个，永久绑定
- 上传/替换二维码后，两类链接的 URL 不变、内容立即更新
- 展示页采用「上传时预渲染」：HTML 在上传时生成并存入 R2，访问热路径不查数据库

## 目录结构

```
qunhao/
├── wrangler.jsonc        # Pages 配置 + D1/R2/KV bindings
├── schema.sql            # D1 数据库结构
├── functions/            # Pages Functions（Workers 运行时）
│   ├── api/
│   │   ├── auth/         # register / login / logout
│   │   ├── codes/        # candidates（5 个候选码）
│   │   └── qr/           # upload / meta
│   ├── i/[code].ts       # 公开图片直链
│   └── [code].ts         # 公开展示页（读 R2 预渲染 HTML）
├── public/               # 静态前端（首页/注册/登录/控制台）
│   └── _routes.json      # 静态路径不经过 Functions，节省免费额度
└── src/lib/              # 共享逻辑（密码哈希、会话、模板等）
```

## 本地开发

```bash
npm install

# 初始化本地 D1（首次）
npm run db:init:local

# 启动本地开发服务器（D1/R2/KV 均为本地模拟）
npm run dev
```

打开 `http://localhost:8788`，注册 → 上传二维码 → 访问 `http://localhost:8788/你的群号` 验证。

## 部署步骤（详细）

### 0. 前置条件

- Cloudflare 账号（免费即可）
- Node.js 18+

### 1. 登录 Wrangler

```bash
npx wrangler login
```

### 2. 创建云端资源

```bash
# D1 数据库
npx wrangler d1 create qunhao-db
# 输出中的 database_id 复制到 wrangler.jsonc 的 d1_databases[0].database_id

# R2 存储桶（首次使用 R2 需在 Dashboard 开通，免费）
npx wrangler r2 bucket create qunhao-qr

# KV 命名空间
npx wrangler kv namespace create SESSIONS
# 输出中的 id 复制到 wrangler.jsonc 的 kv_namespaces[0].id
```

### 3. 初始化云端数据库

```bash
npm run db:init:remote
```

### 4. 部署

```bash
npm run deploy
```

首次部署会提示创建 Pages 项目（项目名 `qunhao`，生产分支 `main`），完成后获得 `https://qunhao.pages.dev`。

> bindings（D1/R2/KV）来自 `wrangler.jsonc`，会随部署自动应用，无需在 Dashboard 手动绑定。

### 5. 绑定自定义域名

1. 将 `qunhao.net` 添加到 Cloudflare（Dashboard → Add a site，按提示改 NS）
2. Dashboard → Workers & Pages → qunhao → Custom domains → 添加 `qunhao.net`
3. 等待证书签发（通常几分钟）

域名生效后，确认 `wrangler.jsonc` 中 `PUBLIC_HOST` 为 `qunhao.net`（影响预渲染页面里的 og:image 绝对地址），如有改动需重新部署。

### 6.（可选）启用 Turnstile 防机器人注册

1. Dashboard → Turnstile → Add widget，域名填 `qunhao.net`（开发时加 `localhost`），获得 sitekey 和 secret
2. 前端：编辑 `public/register.html`，把 `TURNSTILE_SITE_KEY = ''` 填入 sitekey
3. 后端：

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY
```

4. 重新部署：`npm run deploy`

不配置则注册流程跳过人机校验（适合先上线验证）。

### 7. 验证清单

- [ ] 注册时 5 个候选码可刷新、互不重复
- [ ] 两个账号不能选中同一个群号
- [ ] 上传二维码后 `qunhao.net/{code}` 展示页立即显示新码
- [ ] `qunhao.net/i/{code}` 直链返回图片，替换上传后内容更新（ETag 变化）
- [ ] 两类链接 URL 在多次替换后保持不变
- [ ] 未上传时：展示页显示「暂无二维码」，直链返回 404
- [ ] 未登录访问 `/dashboard` 跳转登录页
- [ ] `/register`、`/login` 等管理页不被展示页路由拦截

## 免费层注意事项

| 资源 | 免费额度 | 说明 |
|------|----------|------|
| Workers 请求 | 10 万/天 | 展示页 + 图片直链 + API 共享此额度；静态页（首页等）不计入 |
| KV 写入 | 1000/天 | 约等于每日登录/注册次数上限 |
| D1 | 500 万读 / 10 万写每天 | 远超本项目需求 |
| R2 | 10 GB 存储，出站免费 | 每张二维码 ~100KB，可存约 10 万张 |
| Pages 构建 | 500 次/月 | 仅代码部署消耗，用户上传不消耗 |

超出 Workers 每日请求额度会返回 Error 1027（次日 UTC 0 点恢复），不会自动扣费。流量增长后可升级 Workers Paid（$5/月）。
