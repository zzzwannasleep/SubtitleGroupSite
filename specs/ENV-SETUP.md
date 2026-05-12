# Environment Setup

## 1. 目的

本文件用于锁定开发、联调、部署时的环境变量模板与存放位置。

目标很明确：

- 不让变量命名漂移
- 不让 secrets 误入仓库
- 不让 Workers 与本地部署各玩一套口径

## 2. 环境分类

首期只区分 4 类环境：

- 本地开发
- Workers 预发
- Workers 生产
- 本地部署生产

## 3. 文件与存放位置约定

### 3.1 本地开发

建议使用：

- `.env.local`
- `.dev.vars`（如 Workers 本地调试需要）

规则：

- `.env.local` 不入库
- `.dev.vars` 不入库
- 如需示例文件，使用 `.env.example` 或文档模板，不存真实密钥

### 3.2 Workers 预发 / 生产

建议使用：

- `wrangler.toml` 或等效配置文件保存非敏感配置
- `wrangler secret` 保存敏感配置
- Cloudflare dashboard bindings 保存平台级绑定

规则：

- `Client Secret`
- `Bot Token`
- `TURNSTILE_SECRET_KEY`
- `AUTH_SESSION_SECRET`

以上敏感值不得写入仓库。

### 3.3 本地部署生产

建议使用：

- 系统环境变量
- 受控 `.env`
- 进程管理器注入环境变量

规则：

- 生产 `.env` 不入库
- 服务器上权限最小化存放

## 4. 通用变量清单

### 4.1 基础站点

- `SITE_BASE_URL`
- `DEPLOY_MODE=workers|local`
- `NITRO_HOST`
- `NITRO_PORT`

### 4.2 评论与会话

- `AUTH_SESSION_SECRET`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `COMMENT_RATE_LIMIT_PER_MINUTE`
- `COMMENT_BLOCKLIST_WORDS`

### 4.3 GitHub 登录

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

### 4.4 Telegram 登录

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_NAME`

### 4.5 下载链接

- `R2_PUBLIC_BASE_URL`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `GITHUB_TOKEN`
- `OSS_PUBLIC_BASE_URL`
- `WEBDAV_BASE_URL`
- `WEBDAV_USERNAME`
- `WEBDAV_PASSWORD`

### 4.6 本地部署专用

- `LOCAL_STORAGE_ENABLE=true|false`
- `LOCAL_STORAGE_ROOT`

## 5. 按部署模式的必填关系

### 5.1 Workers 模式

必填：

- `SITE_BASE_URL`
- `DEPLOY_MODE=workers`
- `AUTH_SESSION_SECRET`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_NAME`

按需启用：

- `R2_PUBLIC_BASE_URL`
- `GITHUB_TOKEN`
- `OSS_PUBLIC_BASE_URL`
- `WEBDAV_*`

不要求：

- `LOCAL_STORAGE_ROOT`

### 5.2 本地部署模式

必填：

- `SITE_BASE_URL`
- `DEPLOY_MODE=local`
- `AUTH_SESSION_SECRET`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_NAME`
- `LOCAL_STORAGE_ENABLE`
- `LOCAL_STORAGE_ROOT`

按需启用：

- `R2_PUBLIC_BASE_URL`
- `GITHUB_TOKEN`
- `OSS_PUBLIC_BASE_URL`
- `WEBDAV_*`

## 6. 本地开发模板

### 6.1 `.env.local` 示例

```dotenv
SITE_BASE_URL=http://127.0.0.1:3000
DEPLOY_MODE=local
NITRO_HOST=127.0.0.1
NITRO_PORT=3000

AUTH_SESSION_SECRET=replace-with-long-random-string
TURNSTILE_SITE_KEY=replace-with-dev-site-key
TURNSTILE_SECRET_KEY=replace-with-dev-secret-key
COMMENT_RATE_LIMIT_PER_MINUTE=5
COMMENT_BLOCKLIST_WORDS=spam,buy now,telegram群,qq裙

GITHUB_OAUTH_CLIENT_ID=replace-with-github-client-id
GITHUB_OAUTH_CLIENT_SECRET=replace-with-github-client-secret

TELEGRAM_BOT_TOKEN=replace-with-telegram-bot-token
TELEGRAM_BOT_NAME=replace-with-telegram-bot-name

R2_PUBLIC_BASE_URL=https://downloads.example.com
GITHUB_TOKEN=replace-with-github-token
OSS_PUBLIC_BASE_URL=https://oss.example.com
WEBDAV_BASE_URL=https://dav.example.com
WEBDAV_USERNAME=replace-with-webdav-username
WEBDAV_PASSWORD=replace-with-webdav-password

LOCAL_STORAGE_ENABLE=true
LOCAL_STORAGE_ROOT=D:\downloads
```

### 6.2 `.dev.vars` 示例

```dotenv
SITE_BASE_URL=http://127.0.0.1:8787
DEPLOY_MODE=workers
AUTH_SESSION_SECRET=replace-with-long-random-string
TURNSTILE_SITE_KEY=replace-with-dev-site-key
TURNSTILE_SECRET_KEY=replace-with-dev-secret-key
COMMENT_RATE_LIMIT_PER_MINUTE=5
COMMENT_BLOCKLIST_WORDS=spam,buy now
GITHUB_OAUTH_CLIENT_ID=replace-with-github-client-id
GITHUB_OAUTH_CLIENT_SECRET=replace-with-github-client-secret
TELEGRAM_BOT_TOKEN=replace-with-telegram-bot-token
TELEGRAM_BOT_NAME=replace-with-telegram-bot-name
R2_PUBLIC_BASE_URL=https://downloads.example.com
GITHUB_TOKEN=replace-with-github-token
OSS_PUBLIC_BASE_URL=https://oss.example.com
WEBDAV_BASE_URL=https://dav.example.com
WEBDAV_USERNAME=replace-with-webdav-username
WEBDAV_PASSWORD=replace-with-webdav-password
```

## 7. Workers 生产配置建议

### 7.1 非敏感配置

可放在 `wrangler.toml` 或等效配置中：

- `SITE_BASE_URL`
- `DEPLOY_MODE=workers`
- `COMMENT_RATE_LIMIT_PER_MINUTE`
- `R2_PUBLIC_BASE_URL`
- `OSS_PUBLIC_BASE_URL`
- `WEBDAV_BASE_URL`

### 7.2 敏感配置

必须使用 `wrangler secret` 或 Cloudflare secret bindings：

- `AUTH_SESSION_SECRET`
- `TURNSTILE_SECRET_KEY`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `GITHUB_TOKEN`
- `WEBDAV_USERNAME`
- `WEBDAV_PASSWORD`

## 8. 本地部署生产配置建议

### 8.1 最小必填

- `SITE_BASE_URL`
- `DEPLOY_MODE=local`
- `AUTH_SESSION_SECRET`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_NAME`
- `LOCAL_STORAGE_ENABLE=true`
- `LOCAL_STORAGE_ROOT`

### 8.2 目录规则

- `LOCAL_STORAGE_ROOT` 必须为明确目录
- 不允许使用模糊相对路径
- 不允许直接暴露该绝对路径到前端

## 9. 变量命名约束

- 统一使用大写蛇形命名
- 布尔值统一写 `true|false`
- 枚举值统一小写
- 不新增同义变量名

禁止出现：

- `TG_TOKEN` 与 `TELEGRAM_BOT_TOKEN` 并存
- `CF_TURNSTILE_SECRET` 与 `TURNSTILE_SECRET_KEY` 并存
- `LOCAL_ROOT` 与 `LOCAL_STORAGE_ROOT` 并存

## 10. 安全约束

- 任何真实 secret 不得提交到仓库
- 不得在前端代码里硬编码 secret
- 不得在日志中输出完整 token、secret、cookie
- 本地绝对目录路径不得输出到公开 API

## 11. 联调前检查

联调前至少确认：

- 本地环境变量齐全
- Workers secret 已录入
- OAuth 回调地址已正确配置
- Telegram bot 名称与 token 匹配
- `SITE_BASE_URL` 与实际访问地址一致
- `LOCAL_STORAGE_ROOT` 在本地部署模式下真实存在

## 12. 完成定义

环境配置文档只有在以下条件满足时才算可用：

- 开发者可按文档跑起本地环境
- 运维可按文档部署 Workers
- 运维可按文档部署本地模式
- 变量命名与 `SPEC.md` 保持一致
