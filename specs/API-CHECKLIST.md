# API Checklist

## 1. 目的

本文件不是重复写一遍 API 列表，而是给接口实现与联调提供统一检查项。

接口只有在以下 5 类检查都通过后，才算完成：

- 路由与方法正确
- 权限正确
- 输入校验正确
- 输出结构正确
- 错误返回与测试点齐全

## 2. 通用约定

### 2.1 响应格式

首期建议统一 JSON 响应，下载直链接口除外。

普通成功响应建议至少包含：

```json
{
  "ok": true,
  "data": {}
}
```

错误响应建议至少包含：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "..."
  }
}
```

### 2.2 分页格式

分页接口建议统一返回：

- `page`
- `pageSize`
- `total`
- `totalPages`
- `items`

### 2.3 认证方式

- 登录成功后使用站内 session cookie
- 管理接口依赖管理员会话
- 未登录统一返回 `401`
- 已登录但无权限统一返回 `403`

### 2.4 速率限制

以下接口必须纳入限流：

- `/api/auth/*`
- `POST /api/comments`
- `POST /api/comments/:id/report`
- `/api/admin/*`

### 2.5 统一错误码建议

- `INVALID_INPUT`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `RATE_LIMITED`
- `TURNSTILE_FAILED`
- `OAUTH_STATE_INVALID`
- `TELEGRAM_SIGNATURE_INVALID`
- `CONTENT_VALIDATION_FAILED`
- `INTERNAL_ERROR`

## 3. 公开接口检查清单

### 3.1 `GET /api/me`

检查项：

- 无 session 时返回未登录状态或 `401`
- 有效 session 时返回当前用户信息
- 不暴露敏感字段

测试点：

- 未登录
- 已登录 GitHub 用户
- 已登录 Telegram 用户
- 已过期 session

### 3.2 `GET /api/search`

检查项：

- 支持 `q`
- 支持 `type`
- 支持 `page`
- 支持 `pageSize`
- 结果按既定规则排序
- 结果支持分页

测试点：

- 空关键词
- `type=all`
- `type=articles`
- `type=downloads`
- 超大 `pageSize`
- 超出页码范围

### 3.3 `GET /api/downloads`

检查项：

- 只返回公开可见下载条目
- 不返回本地绝对路径
- 列表字段适合摘要展示

测试点：

- 正常列表
- `hidden` / `archived` 条目过滤

### 3.4 `GET /api/downloads/:slug`

检查项：

- `slug` 校验
- 不存在时返回 `404`
- 返回版本、文件、下载链接数据

测试点：

- 有效 slug
- 无效 slug
- 不存在 slug

### 3.5 `GET /api/downloads/:slug/links`

检查项：

- `slug` 与 `fileId` 校验
- 只返回当前部署模式允许的下载链接
- 返回顺序符合 `order`
- 不泄露 `local.path`

测试点：

- Workers 模式
- 本地部署模式
- 无效 `fileId`
- 空链接列表

### 3.6 `GET /api/comments`

检查项：

- 只返回 `approved` 评论
- `articleSlug` 必填
- 返回顺序稳定

测试点：

- 有评论
- 无评论
- 含 `pending/spam/rejected` 数据时的过滤

### 3.7 `POST /api/comments`

检查项：

- 必须登录
- 必须带 Turnstile token
- 正文长度校验
- 黑名单词校验
- 频率限制校验
- 正确写入审核状态

测试点：

- 未登录
- Turnstile 缺失
- Turnstile 失败
- 命中黑名单词
- 高频重复提交
- 正常提交

### 3.8 `POST /api/comments/:id/report`

检查项：

- 必须登录
- 评论必须存在
- 同一用户重复举报要去重或幂等

测试点：

- 未登录
- 不存在评论
- 重复举报
- 正常举报

## 4. 认证接口检查清单

### 4.1 `GET /api/auth/github/start`

检查项：

- 生成 `state`
- 保存 `state`
- 正确跳转 GitHub

测试点：

- 正常跳转
- state 写入失败

### 4.2 `GET /api/auth/github/callback`

检查项：

- 校验 `state`
- 校验回调参数
- 换 token
- 拉用户信息
- 建立站内会话

测试点：

- 正常登录
- 缺失 `state`
- `state` 不匹配
- GitHub 返回失败

### 4.3 `POST /api/auth/telegram/verify`

检查项：

- 校验载荷结构
- 校验 Telegram 签名
- 校验时间戳
- 建立站内会话

测试点：

- 正常登录
- 签名错误
- 时间戳过期

### 4.4 `POST /api/auth/logout`

检查项：

- 清 session cookie
- 失效服务端会话

测试点：

- 已登录登出
- 未登录登出

## 5. 管理接口检查清单

### 5.1 `GET /api/admin/comments`

检查项：

- 必须管理员权限
- 支持待审核列表
- 可带状态筛选

测试点：

- 未登录
- 普通用户
- 管理员

### 5.2 `POST /api/admin/comments/:id/moderate`

检查项：

- 必须管理员权限
- 只允许合法动作
- 写入审核日志

测试点：

- 非法 action
- 不存在评论
- 正常通过
- 正常拒绝
- 正常标记 spam

### 5.3 `DELETE /api/admin/comments/:id`

检查项：

- 必须管理员权限
- 删除行为可审计

测试点：

- 非管理员删除
- 删除不存在评论
- 正常删除

### 5.4 `POST /api/admin/users/:id/ban`

检查项：

- 必须管理员权限
- 封禁后用户不可继续发表评论
- 活跃会话可被主动失效

测试点：

- 非管理员封禁
- 不存在用户
- 正常封禁

## 6. 内容与部署相关检查项

### 6.1 内容校验失败时

检查项：

- 不要返回模糊错误
- 应明确指出哪个条目、哪个字段失败

### 6.2 Workers 与本地部署一致性

检查项：

- 相同接口路径
- 相同响应结构
- 差异只体现在可用链接类型

## 7. 联调前自检

每个接口联调前，至少完成以下自检：

- 本地手工请求通过
- 失败分支至少测 1 次
- 鉴权分支至少测 1 次
- 字段命名与 SPEC 对齐
- 没有泄露本地绝对路径、密钥、token

## 8. 完成定义

一个接口只有在以下条件同时满足时才算完成：

- 路由已实现
- 权限已实现
- 校验已实现
- 错误码已实现
- 至少完成一次手工验证
