# Auth And Comment Spec

## 1. 范围

本文件补充 `SPEC.md` 中认证与评论相关实现细节，覆盖：

- `GitHub OAuth`
- `Telegram Login`
- 站内会话
- 评论提交、举报、审核、删除、封禁
- 评论反垃圾与审计

不覆盖：

- 邮箱/密码登录
- 找回密码 / 重置密码
- 楼中楼评论
- 评论编辑
- 用户自行删除评论

## 2. 角色与权限

### 2.1 访客

- 可以浏览文章评论
- 可以看到评论区登录提示
- 不可以发表评论
- 不可以举报评论

### 2.2 登录用户

- 可以发表评论
- 可以举报评论
- 不可以删除任何评论
- 不可以编辑任何评论
- 不可以访问管理审核页

### 2.3 管理员

- 可以查看待审核评论
- 可以通过、拒绝、标记垃圾评论
- 可以删除任意评论
- 可以封禁用户评论权限
- 可以查看审核日志

## 3. 第三方登录策略

首期固定只做两种登录方式：

- `GitHub OAuth`
- `Telegram Login`

不做：

- 邮箱/密码注册登录
- 短信验证码登录
- 绑定多个第三方账号到同一站内账号

## 4. GitHub OAuth

### 4.1 入口

- 前端登录按钮跳转 `GET /api/auth/github/start`
- 服务端生成 `state`
- `state` 写入短时 cookie 或服务端临时存储
- 跳转到 GitHub 授权页

### 4.2 回调

- GitHub 回调命中 `GET /api/auth/github/callback`
- 服务端必须校验 `state`
- 用授权码换 access token
- 拉取 GitHub 用户基础信息
- 以 `provider=github + provider_user_id` 作为唯一身份键

### 4.3 用户字段映射

- `provider`: `github`
- `provider_user_id`: GitHub 用户 ID
- `username`: GitHub login
- `display_name`: GitHub name，缺失时回退到 login
- `avatar_url`: GitHub avatar
- `email`: GitHub 邮箱，可空

## 5. Telegram Login

### 5.1 入口

- 前端使用 Telegram Login Widget 或等效方式获取登录载荷
- 前端把登录载荷提交到 `POST /api/auth/telegram/verify`

### 5.2 校验

- 服务端必须按 Telegram 官方规则校验签名
- 服务端必须校验时间戳有效性，避免重放
- 校验通过后建立站内会话

### 5.3 用户字段映射

- `provider`: `telegram`
- `provider_user_id`: Telegram 用户 ID
- `username`: Telegram username，可空
- `display_name`: first name + last name，缺失时回退到 username 或 `tg-{id}`
- `avatar_url`: Telegram photo_url，可空
- `email`: 固定为空

## 6. 站内会话

### 6.1 基本策略

- 第三方登录成功后，必须建立站内会话
- 会话采用随机不可预测 token
- cookie 名称建议统一，例如 `sgs_session`
- cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`

### 6.2 会话存储

- `sessions` 表保存服务端会话记录
- 建议保存 `token_hash` 而不是明文 token
- 建议保存：
  - `id`
  - `user_id`
  - `token_hash`
  - `expires_at`
  - `created_at`
  - `last_seen_at`
  - `ip_hash` 或等效审计字段
  - `user_agent` 摘要

### 6.3 有效期

- 首期建议固定有效期 `30` 天
- 登出后应立即失效
- 管理员封禁用户后，相关活跃会话应可被服务端主动失效

## 7. 评论提交规则

### 7.1 评论内容

- 首期只支持纯文本
- 不支持 Markdown
- 不支持 HTML
- 不支持楼中楼

### 7.2 提交流程

1. 用户已登录
2. 前端提交评论正文与 Turnstile token
3. 服务端校验登录态
4. 服务端校验 Turnstile token
5. 服务端执行频率限制
6. 服务端执行黑名单词检测
7. 服务端执行基础重复内容 / 高频外链检查
8. 写入评论与审核状态

### 7.3 状态

- `pending`
- `approved`
- `rejected`
- `spam`

公开页面只显示 `approved`。

## 8. 举报与审核

### 8.1 举报

- 登录用户可以举报评论
- 举报只记录，不自动删除评论
- 同一用户对同一评论重复举报应去重

### 8.2 审核页

`/admin/comments` 至少要支持：

- 待审核列表
- 评论正文查看
- 文章信息查看
- 举报原因查看
- 通过 / 拒绝 / 标记垃圾
- 删除评论
- 封禁用户

### 8.3 审核日志

每次管理员操作都应写入 `comment_moderation_logs`：

- `comment_id`
- `admin_user_id`
- `action`
- `note`
- `created_at`

## 9. 权限边界

明确锁死以下规则：

- 普通用户不能删除评论
- 普通用户不能编辑评论
- 只有管理员可以删除评论
- 只有管理员可以封禁用户评论权限

## 10. 风控策略

首期最低要求：

- 评论提交校验 Turnstile
- `/api/auth/*` 与 `/api/comments/*` 做频率限制
- 黑名单词拦截
- 基础重复内容拦截
- 高频外链拦截
- 审核状态控制公开可见性

建议默认速率限制按三维执行：

- IP 维度
- 用户维度
- 文章维度

## 11. API 收口

对照 `SPEC.md`，本补充规格额外强调：

- `GET /api/me`
- `GET /api/comments`
- `POST /api/comments`
- `POST /api/comments/:id/report`
- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`
- `POST /api/auth/telegram/verify`
- `POST /api/auth/logout`
- `GET /api/admin/comments`
- `POST /api/admin/comments/:id/moderate`
- `DELETE /api/admin/comments/:id`
- `POST /api/admin/users/:id/ban`

## 12. 成功标准

- GitHub 登录可稳定建立会话
- Telegram 登录可稳定建立会话
- 评论提交必须依赖登录态与 Turnstile
- 普通用户无法删除评论
- 管理员可以完成审核、删除、封禁
- 审核日志可追溯
