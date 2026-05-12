# Implementation Plan

## 1. 目标

本文件用于把 `SPEC.md` 与补充规格文档转成可执行开发顺序。

原则：

- 先闭环 `Cloudflare Workers` 主路径，再补本地部署
- 先把内容、搜索、认证、评论、下载链接这 5 条主链打通
- 不并行做与首期目标无关的增强项

## 2. 开发总顺序

固定顺序如下：

1. 项目骨架与运行链路
2. 内容 schema 与校验
3. 搜索索引与搜索 API
4. 第三方登录与站内会话
5. 评论接口与审核后台
6. 下载条目与下载链接展示
7. 观测、备份、部署收口
8. 本地部署模式补齐

禁止反向启动的事项：

- 评论后台未落地前，不算评论系统闭环
- 搜索分页未落地前，不算搜索闭环
- 下载页未展示真实下载链接前，不算下载中心闭环
- Workers 主路径未收口前，不进入本地部署阶段

## 3. 工作流切片

### Slice 1：项目骨架

目标：

- 初始化 `Nuxt 4`
- 接入 `Nuxt Content`
- 跑通 Workers 构建与本地开发

交付物：

- 基础目录结构
- `content/` 目录
- `server/api/` 目录
- 基础布局与路由骨架

依赖：

- 无

完成标准：

- 首页可运行
- 文章列表页路由存在
- 下载列表页路由存在
- 搜索结果页路由存在

### Slice 2：内容 schema 与校验

目标：

- 落实 `articles` 与 `downloads` schema
- 建立 frontmatter 校验能力

交付物：

- 内容集合定义
- 下载条目 schema
- 示例内容
- 校验脚本或构建期校验

依赖：

- Slice 1

完成标准：

- 非法 frontmatter 可被拦截
- 下载条目可渲染出版本、文件、下载链接结构

### Slice 3：搜索索引与搜索 API

目标：

- 构建搜索索引
- 完成 `/api/search`
- 落地搜索分页协议

交付物：

- 搜索索引构建逻辑
- 搜索 API
- 搜索结果页
- 搜索分页组件

依赖：

- Slice 2

完成标准：

- 可搜文章
- 可搜下载条目
- 分页正确
- `type=all|articles|downloads` 可用

### Slice 4：第三方登录与站内会话

目标：

- 打通 `GitHub OAuth`
- 打通 `Telegram Login`
- 建立站内会话

交付物：

- `/api/auth/github/start`
- `/api/auth/github/callback`
- `/api/auth/telegram/verify`
- `/api/auth/logout`
- `/api/me`
- 会话表与 cookie 策略

依赖：

- Slice 1

完成标准：

- 两种登录方式都能建立会话
- 未登录状态与已登录状态可被前端正确识别
- 登出后会话失效

### Slice 5：评论接口与审核后台

目标：

- 评论提交、列表、举报
- 审核状态流转
- 管理员删除与封禁

交付物：

- 评论表与审核日志表
- `/api/comments`
- `/api/comments/:id/report`
- `/api/admin/comments`
- `/api/admin/comments/:id/moderate`
- `/api/admin/comments/:id`
- `/api/admin/users/:id/ban`
- `/admin/comments`

依赖：

- Slice 4

完成标准：

- 登录用户可评论
- 未登录用户不能评论
- 评论提交必须通过 Turnstile
- 普通用户不能删除评论
- 管理员能审核、删除、封禁

### Slice 6：下载条目与下载链接展示

目标：

- 下载详情页展示真实链接
- 不做镜像切换，不做自动选链

交付物：

- 下载列表页
- 下载详情页
- `/api/downloads`
- `/api/downloads/:slug`
- `/api/downloads/:slug/links`
- 下载链接点击统计

依赖：

- Slice 2

完成标准：

- 页面能展示版本、文件、下载链接
- 支持 `R2`、`GitHub Repo`、`OSS`、`WebDAV`
- 下载链接顺序符合 `order`

### Slice 7：观测、备份、部署收口

目标：

- 补齐可观测性与基础备份
- 完成 Workers 首期上线条件

交付物：

- 下载点击统计
- 搜索请求统计
- 评论失败统计
- D1 导出方案
- Workers 部署说明

依赖：

- Slice 3
- Slice 5
- Slice 6

完成标准：

- Workers 可稳定部署
- 关键接口有基础日志
- D1 可导出

### Slice 8：本地部署模式补齐

目标：

- 在不改核心内容结构的前提下补齐 `Node/Nitro` 本地部署
- 支持 `local` 单机目录

交付物：

- 本地环境配置
- `local` 链接适配
- `SQLite` 版本的评论/会话数据层
- `SQLite` 备份方案

依赖：

- Slice 2
- Slice 4
- Slice 5
- Slice 6

完成标准：

- 本地部署可运行
- 下载页可展示 `local + R2 + GitHub + OSS + WebDAV`
- 评论与登录逻辑可复用

## 4. 推荐任务拆分

建议最少拆成以下任务卡：

- `infra-01`：Nuxt + Content 骨架
- `content-01`：文章与下载 schema
- `content-02`：内容校验脚本
- `search-01`：搜索索引构建
- `search-02`：搜索 API 与分页
- `auth-01`：GitHub OAuth
- `auth-02`：Telegram Login
- `auth-03`：会话与 `/api/me`
- `comment-01`：评论提交与列表
- `comment-02`：举报、审核、删除、封禁
- `comment-03`：审核后台页
- `download-01`：下载列表/详情页
- `download-02`：下载链接 API 与点击统计
- `ops-01`：Workers 部署与环境变量
- `ops-02`：D1 / SQLite 备份方案
- `local-01`：本地部署与 `local` 目录支持

## 5. 联调顺序

固定联调顺序建议如下：

1. 内容 schema 与下载页静态渲染
2. 搜索 API 与搜索页
3. GitHub 登录
4. Telegram 登录
5. 评论提交与评论列表
6. 审核后台
7. 下载链接接口
8. Workers 部署
9. 本地部署

## 6. 每个阶段的验收口径

### Workers 阶段验收

- 登录可用
- 评论可用
- 审核可用
- 搜索可用且分页正确
- 下载链接展示可用
- Workers 可部署

### 本地部署阶段验收

- 本地目录可用
- SQLite 可用
- 评论与登录逻辑复用
- 下载链接展示逻辑复用

## 7. 明确不插队的内容

以下内容在首期不允许插队：

- 邮箱/密码登录
- 找回密码 / 重置密码
- 评论编辑
- 用户自行删除评论
- 镜像源切换
- 下载健康检查
- 自动选源
- 防盗链签名

## 8. 完成定义

每个任务卡只有同时满足以下条件才算完成：

- 代码已接入主链路
- 页面或接口可实际运行
- 关键边界有校验
- 与现有 SPEC 不冲突
- 基础手工验证已完成
