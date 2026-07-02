# 群号 Docker 自托管版

永久群号链接服务，支持 Docker Compose 一键部署。

## 技术栈

- **App**：Hono + Node.js
- **数据库**：SQLite (WAL)
- **会话/缓存**：Redis
- **对象存储**：MinIO (S3)
- **邮件**：Resend（密码重置）
- **反向代理**：Caddy + nginx (静态资源)

## 快速开始

```bash
cd qunhao-docker
cp .env.example .env
# 编辑 .env：PUBLIC_HOST、ADMIN_EMAIL、RESEND_* 等

docker compose up -d --build
./scripts/smoke-test.sh http://localhost
```

本地开发（仅基础设施用 Docker）：

```bash
docker compose up -d redis minio
npm install
cp .env.example .env
# 调整 REDIS_URL、S3_ENDPOINT 为 localhost
npm run dev
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `PUBLIC_HOST` | 是 | 对外域名 |
| `ADMIN_EMAIL` | 是 | 首管理员邮箱 |
| `RESEND_API_KEY` | 是* | 密码重置邮件 |
| `RESEND_FROM` | 是* | 已验证发件人 |
| `SECURE_COOKIES` | 生产 | HTTPS 后设 `true` |

## Resend 配置

1. 在 [resend.com/domains](https://resend.com/domains) 验证发信域名
2. 创建 API Key，填入 `RESEND_API_KEY`
3. 设置 `RESEND_FROM=群号 <noreply@yourdomain.com>`

## 功能

- 群号创建、二维码上传/替换、公开展示页
- 注册/登录、控制台、管理员设高级会员
- **忘记密码**（邮件链接）/ **重置密码** / **修改密码**
- 流量分层：静态资源长缓存、API no-store

## 目录

```
qunhao-docker/
├── src/server/     # Hono 服务
├── src/adapters/   # SQLite / Redis / MinIO
├── src/lib/        # 业务逻辑
├── public/         # 静态前端
├── docker-compose.yml
└── Caddyfile
```

## 备份

```bash
./scripts/backup.sh
```

## 上线验证

参见原项目 README 核心业务清单，另加：

- [ ] 忘记密码 → 收到邮件 → 重置成功
- [ ] 登录后修改密码
- [ ] `GET /health` 返回 ok
