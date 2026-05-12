# Issue Breakdown

## 1. 目的

本文件把 `IMPLEMENTATION-PLAN.md` 继续下钻成可直接创建 issue 的任务卡。

使用原则：

- 每张卡都要能独立推进
- 每张卡都要有明确依赖
- 每张卡都要有清晰验收口径
- 先跑通 `Workers` 主路径，再补本地部署

## 2. 任务卡状态建议

建议统一使用以下状态：

- `todo`
- `in_progress`
- `blocked`
- `review`
- `done`

## 3. 任务卡字段模板

每张 issue 建议至少包含：

- `ID`
- `标题`
- `类型`
- `负责人类型`
- `依赖`
- `交付物`
- `验收条件`
- `非目标`

## 4. Epic A：项目骨架与内容基础

### ISSUE-001 `infra`

标题：

- 初始化 `Nuxt 4 + Nuxt Content + Workers` 项目骨架

负责人类型：

- 工程基础设施

依赖：

- 无

交付物：

- 基础目录结构
- 首页路由
- 文章列表路由
- 下载列表路由
- 搜索结果路由
- Workers 构建链路

验收条件：

- 本地开发可启动
- Workers 构建可产出
- 路由骨架存在且可访问

非目标：

- 不要求业务数据可用

### ISSUE-002 `content`

标题：

- 定义文章与下载条目内容 schema

负责人类型：

- 内容结构 / 后端

依赖：

- `ISSUE-001`

交付物：

- `articles` schema
- `downloads` schema
- 示例内容文件

验收条件：

- 合法内容可通过校验
- 非法内容会报错

非目标：

- 不要求搜索或页面展示完成

### ISSUE-003 `content`

标题：

- 实现内容校验脚本或构建期校验

负责人类型：

- 工程基础设施

依赖：

- `ISSUE-002`

交付物：

- 内容校验命令
- 校验失败提示格式

验收条件：

- 可识别非法 `slug`
- 可识别非法下载链接字段
- 可识别无效关联引用

非目标：

- 不要求后台编辑

## 5. Epic B：搜索

### ISSUE-004 `search`

标题：

- 构建文章与下载条目的搜索索引

负责人类型：

- 后端 / 内容处理

依赖：

- `ISSUE-002`

交付物：

- 搜索文档抽取逻辑
- 统一索引结构

验收条件：

- 文章字段可被提取
- 下载字段可被提取
- `draft` 内容不进入公开索引

### ISSUE-005 `search`

标题：

- 实现 `/api/search` 与分页协议

负责人类型：

- 后端 API

依赖：

- `ISSUE-004`

交付物：

- `GET /api/search`
- 分页返回结构
- 排序规则实现

验收条件：

- 支持 `type=all|articles|downloads`
- 支持 `page` 与 `pageSize`
- 结果排序符合 `SEARCH-SPEC.md`

### ISSUE-006 `search-ui`

标题：

- 实现搜索入口与搜索结果页

负责人类型：

- 前端

依赖：

- `ISSUE-005`

交付物：

- 首页搜索入口
- 头部搜索入口
- 搜索结果页
- 分页控件

验收条件：

- 可以发起搜索
- 可以翻页
- 可以切换 `all/articles/downloads`

非目标：

- 不做搜索联想

## 6. Epic C：认证与会话

### ISSUE-007 `auth`

标题：

- 实现 `GitHub OAuth` 登录链路

负责人类型：

- 后端认证

依赖：

- `ISSUE-001`

交付物：

- `/api/auth/github/start`
- `/api/auth/github/callback`
- `state` 校验

验收条件：

- 可完成 GitHub 登录
- 无效 `state` 被拒绝

### ISSUE-008 `auth`

标题：

- 实现 `Telegram Login` 校验链路

负责人类型：

- 后端认证

依赖：

- `ISSUE-001`

交付物：

- `/api/auth/telegram/verify`
- Telegram 签名校验

验收条件：

- 可完成 Telegram 登录
- 无效签名被拒绝

### ISSUE-009 `auth`

标题：

- 实现站内会话与 `/api/me`

负责人类型：

- 后端认证

依赖：

- `ISSUE-007`
- `ISSUE-008`

交付物：

- `sessions` 表
- session cookie
- `/api/me`
- `/api/auth/logout`

验收条件：

- 已登录状态可识别
- 未登录状态可识别
- 登出后会话失效

## 7. Epic D：评论与审核

### ISSUE-010 `comment`

标题：

- 实现评论列表与评论提交接口

负责人类型：

- 后端 API

依赖：

- `ISSUE-009`

交付物：

- `GET /api/comments`
- `POST /api/comments`
- Turnstile 校验

验收条件：

- 未登录无法评论
- 登录用户可评论
- 未审核评论不公开

### ISSUE-011 `comment`

标题：

- 实现举报、审核、管理员删除、封禁能力

负责人类型：

- 后端 API

依赖：

- `ISSUE-010`

交付物：

- `POST /api/comments/:id/report`
- `GET /api/admin/comments`
- `POST /api/admin/comments/:id/moderate`
- `DELETE /api/admin/comments/:id`
- `POST /api/admin/users/:id/ban`
- 审核日志写入

验收条件：

- 普通用户不能删除评论
- 管理员可以删除评论
- 管理员可以封禁用户评论权限

### ISSUE-012 `comment-ui`

标题：

- 实现文章页评论区与审核后台页

负责人类型：

- 前端

依赖：

- `ISSUE-010`
- `ISSUE-011`

交付物：

- 文章页评论区
- 登录提示
- 评论提交表单
- `/admin/comments`

验收条件：

- 评论区能正确显示状态
- 审核页能执行通过/拒绝/标记垃圾/删除/封禁

## 8. Epic E：下载中心

### ISSUE-013 `download`

标题：

- 实现下载列表页与下载详情页

负责人类型：

- 前端

依赖：

- `ISSUE-002`

交付物：

- 下载列表页
- 下载详情页
- 版本、文件、下载链接展示

验收条件：

- 能按 schema 渲染
- 能正确区分版本和文件

### ISSUE-014 `download`

标题：

- 实现下载条目 API 与下载链接输出

负责人类型：

- 后端 API

依赖：

- `ISSUE-002`

交付物：

- `GET /api/downloads`
- `GET /api/downloads/:slug`
- `GET /api/downloads/:slug/links`

验收条件：

- 不泄露本地绝对路径
- Workers 模式能正确过滤 `local`
- 返回顺序符合 `order`

### ISSUE-015 `download`

标题：

- 实现下载链接点击统计

负责人类型：

- 后端 / 观测

依赖：

- `ISSUE-014`

交付物：

- 点击埋点接口或服务端统计逻辑

验收条件：

- 能统计不同链接点击分布

## 9. Epic F：部署与运维

### ISSUE-016 `ops`

标题：

- 整理 Workers 环境变量、bindings 与部署流程

负责人类型：

- 运维 / 工程基础设施

依赖：

- `ISSUE-007`
- `ISSUE-008`
- `ISSUE-014`

交付物：

- Workers 变量清单
- 部署说明
- secrets 录入说明

验收条件：

- 环境变量齐全
- 部署链路可复现

### ISSUE-017 `ops`

标题：

- 实现 D1 备份导出与恢复流程

负责人类型：

- 运维 / 后端

依赖：

- `ISSUE-011`

交付物：

- D1 导出说明
- 恢复说明

验收条件：

- 评论与用户数据可导出
- 恢复流程有明确步骤

## 10. Epic G：本地部署第二阶段

### ISSUE-018 `local`

标题：

- 实现本地部署模式与 `SQLite` 数据层

负责人类型：

- 后端 / 运维

依赖：

- `ISSUE-009`
- `ISSUE-011`

交付物：

- `SQLite` 数据层
- 本地运行说明

验收条件：

- 本地模式可运行
- 评论与会话逻辑可复用

### ISSUE-019 `local`

标题：

- 实现 `local` 单机目录下载链接输出

负责人类型：

- 后端

依赖：

- `ISSUE-014`
- `ISSUE-018`

交付物：

- 本地目录读取逻辑
- `local` 链接输出逻辑

验收条件：

- 本地部署模式下可展示 `local` 下载链接
- 不暴露原始绝对路径

## 11. 推荐 issue labels

建议最少使用以下 labels：

- `infra`
- `content`
- `search`
- `auth`
- `comment`
- `download`
- `ops`
- `local`
- `frontend`
- `backend`

## 12. 推荐 milestones

- `M1 Skeleton`
- `M2 Search`
- `M3 Auth`
- `M4 Comment`
- `M5 Download`
- `M6 Workers Launch`
- `M7 Local Deploy`

## 13. 完成定义

一张 issue 只有在以下条件同时满足时才算完成：

- 交付物存在
- 依赖项已满足
- 验收条件通过
- 与现有 SPEC 文档无冲突
- 基础手工验证已完成
