# Subtitle Group Site SPEC

## 1. 文档信息

- 文档状态：Draft v2
- 目标：定义一个基于 `Nuxt Content` 的内容站与下载站一体化方案
- 适用阶段：产品规划、UI 设计、工程初始化、开发拆分、部署决策
- 当前结论：采用 `Nuxt 4 + Nuxt Content`，主部署方式聚焦 `Cloudflare Workers` 与 `本地部署（Node/Nitro）`

## 2. 项目概述

本项目目标是建设一个以文章内容和资源下载为核心的站点。站点既要支持持续发布文章，也要支持面向访客的下载中心。部署层面不再以“尽量兼容所有静态平台”为目标，而是聚焦两条主线：`Cloudflare Workers` 负责公网主站与边缘运行时能力，`本地部署（Node/Nitro）` 负责全能力模式与单机目录直读场景。下载资源优先聚合 `Cloudflare R2`、`GitHub` 普通仓库文件、`OSS`、`WebDAV` 等来源，并允许在本地部署模式下扩展到单机目录文件源。

该项目不是单纯的博客，也不是纯静态文档站。它更接近“内容发布平台 + 下载分发平台”的组合，因此需要同时具备内容管理能力、下载源抽象能力、前端展示自由度，以及可根据部署模式切换的运行时 API 能力。

## 3. 目标与非目标

### 3.1 目标

- 支持基于 Markdown 的文章发布、分类、标签、归档和 SEO。
- 支持文章详情页挂载评论系统。
- 支持下载资源展示、版本说明、镜像源切换、文件元信息展示。
- 支持统一管理下载源，并按阶段演进：
  - `R2` 对象存储
  - `GitHub` 普通仓库文件
  - `OSS`
  - `WebDAV`
  - 本地部署模式下的单机目录文件源
- 支持对首页、列表页、文章页、下载页进行深度定制。
- 支持两种主部署模式：
  - `Cloudflare Workers` 公网主站模式
  - `本地部署（Node/Nitro）` 全能力模式
- 允许不同部署模式采用不同的下载源展示顺序与能力边界。
- 为后续接入后台编辑能力预留空间，例如 `Nuxt Studio` 或 Git-based 内容管理。

### 3.2 非目标

- 第一阶段不实现复杂的多角色后台权限系统。
- 第一阶段不做在线文件上传面板。
- 第一阶段不做支付、会员、限时下载等商业化能力。
- 第一阶段不做复杂的对象存储生命周期自动编排。
- 第一阶段不做分布式转码、断点续传客户端等重型下载能力。
- 第一阶段不要求 `Cloudflare Workers` 与本地部署两种模式同时达到全部高级能力。

## 4. 核心用户与场景

### 4.1 用户角色

- 访客：浏览文章、查看下载详情、下载资源。
- 注册用户：登录后发表评论、举报评论、管理自己的评论。
- 站点维护者：发布文章、维护下载元数据、调整页面内容与样式。
- 管理员：管理配置、评论接入参数、下载源配置、部署环境变量。

### 4.2 关键使用场景

#### 场景 A：文章阅读

访客从首页、文章列表、标签页进入文章详情页，查看正文、关联资源、评论区和相关推荐。未登录用户可以阅读评论，但不能直接发表评论。

#### 场景 B：资源下载

访客进入下载详情页，查看版本、更新说明、平台、文件大小和多个下载源。页面直接展示全部已启用下载源；在 `Cloudflare Workers` 模式下以 `R2`、`GitHub`、`OSS`、`WebDAV` 等远程来源为主，在本地部署模式下可进一步接入单机目录文件。

#### 场景 C：内容发布

维护者通过 Git 提交 Markdown 文件发布文章或更新下载条目，不依赖重后台即可完成日常维护。

## 5. 产品范围

### 5.1 内容系统

站点应支持以下内容类型：

- 文章 `articles`
- 下载条目 `downloads`
- 独立页面 `pages`
- 作者信息 `authors`（可选）
- 公告或更新日志 `changelog`（可选）

文章系统最低应具备：

- Markdown 编写
- Frontmatter 元数据
- 草稿状态 `draft`
- 发布时间 `publishedAt`
- 更新时间 `updatedAt`
- 标签 `tags`
- 分类 `category`
- 封面图 `cover`
- 摘要 `summary`
- 相关文章或关联下载项

### 5.2 评论系统

第一阶段不再采用 `giscus` 或纯第三方评论托管方案，而是采用“自建评论模块 + 登录态 + Cloudflare 人机验证 + 反垃圾策略”的方案。

评论系统最低要求：

- 必须登录后才能评论
- 未登录用户只能浏览评论，不能直接提交评论
- 第一阶段采用单层评论，不做楼中楼回复
- 第一阶段评论内容使用纯文本，不开放富文本或 Markdown
- 注册、登录、发表评论时接入 `Cloudflare Turnstile`
- 评论提交前必须在服务端校验 Turnstile token
- 对 `/api/auth/*` 与 `/api/comments/*` 接口启用频率限制
- 优先结合 `Cloudflare WAF / Rate Limiting` 规则做外围防刷
- 支持评论审核状态：
  - `pending`
  - `approved`
  - `rejected`
  - `spam`
- 支持管理员审核、删除、封禁用户、标记垃圾评论
- 支持用户举报评论
- 支持用户删除自己的评论

第一阶段推荐实现方式：

- `Cloudflare Workers` 模式下：
  - 使用 `Cloudflare D1` 保存用户、会话、评论、审核记录
  - 使用 `Cloudflare Turnstile` 负责人机验证
  - 使用 Workers API 处理注册、登录、评论提交、审核接口
- 本地部署模式下：
  - 复用相同的评论接口和数据模型
  - 优先使用 `SQLite` 兼容同一套 schema
  - 保留未来切换到 `PostgreSQL` 的可能

推荐反垃圾策略：

- 注册和登录时使用 Turnstile
- 评论提交时再次使用 Turnstile
- 同一 IP、同一账号、同一文章在短时间内限制发言频率
- 支持注入可配置的黑名单词列表，命中后直接拒绝、标记 `spam` 或转入待审
- 对高频外链、敏感词、重复内容做基础拦截或待审

认证方式建议：

- 第一阶段以“站内登录后评论”为硬要求
- 首期登录方式固定为 `邮箱/密码注册登录`
- 评论提交都必须经过 Turnstile 与服务端校验

### 5.3 下载中心

下载中心是本项目区别于普通博客的核心模块，应支持：

- 下载列表页
- 下载详情页
- 文件元数据展示
- 多版本展示
- 多平台文件展示
- 多下载源展示
- 直接展示全部已启用下载源
- 关联说明文档或教程文章

第一阶段默认能力：

- 展示 `R2`、`GitHub` 普通仓库文件、`OSS`、`WebDAV` 下载源
- 在 `Cloudflare Workers` 模式下完成下载来源聚合与直接展示
- 在本地部署模式下正式支持 `local` 单机目录来源

明确不做：

- 不把 `SHA256` 之类的专业校验值作为下载页默认展示项
- 不把下载页做成面向专业运维或镜像站管理员的重型信息面板
- 不做下载源容灾、自动切换、健康检查驱动选源
- 不做下载链接防盗链或短时签名

### 5.4 站内搜索

第一阶段必须提供站内搜索，最低要求如下：

- 支持搜索文章与下载条目
- 文章搜索至少覆盖标题、摘要、标签字段
- 下载搜索至少覆盖标题、摘要、标签、版本号、文件名字段
- 搜索入口在桌面端与移动端都可直接访问
- 搜索结果需能区分文章结果与下载结果
- 结果排序优先考虑标题命中与精确匹配
- 空结果状态与基础关键词高亮应可用

### 5.5 页面定制

前台页面不能只沿用默认主题，应至少支持以下定制：

- 首页 Hero 区与栏目布局自定义
- 导航、侧边栏、页脚自定义
- 文章列表页卡片样式自定义
- 下载页专用模块布局
- 颜色、字体、间距、卡片风格统一配置
- 桌面端和移动端都保持良好体验

## 6. 信息架构

建议站点路由如下：

- `/`：首页
- `/articles`：文章列表
- `/articles/[slug]`：文章详情
- `/tags/[tag]`：标签归档
- `/search`：站内搜索结果页
- `/downloads`：下载列表
- `/downloads/[slug]`：下载详情
- `/admin/comments`：评论审核页（管理员）
- `/changelog`：站点更新日志
- `/about`：关于页

下载详情页应允许关联到一篇或多篇文章，例如：

- 发布说明
- 安装教程
- 使用说明
- 更新日志

## 7. 技术方案

### 7.1 技术栈

- 前端框架：`Nuxt 4`
- 内容系统：`Nuxt Content`
- 运行时服务：`Nitro server/api`
- 评论系统：自建评论模块
- 评论数据库：
  - Workers 模式：`Cloudflare D1`
  - 本地部署模式：`SQLite` 优先
- 人机验证：`Cloudflare Turnstile`
- 样式方案：`Tailwind CSS` 或 `UnoCSS`，最终二选一
- 部署形态：双主线部署
  - `Cloudflare Workers`
  - `本地部署（Node/Nitro）`

### 7.2 选型结论

选择 `Nuxt Content` 的核心原因：

- 适合 Git-based 内容管理
- 可以用内容集合严格约束文章与下载数据结构
- 具备服务端 API 能力，适合在 `Workers` 与本地部署两种模式下统一处理多下载源
- 页面自由度比文档站框架更高
- 后续接入 `Nuxt Studio` 成本较低

### 7.3 双主线部署策略

本项目正式支持两种主部署模式：`Cloudflare Workers` 与 `本地部署（Node/Nitro）`。

#### 主模式 A：Cloudflare Workers

定位：

- 公网主站默认方案
- 边缘运行时方案
- 适合 `R2`、`GitHub Repo`、`OSS`、`WebDAV` 等远程来源聚合、搜索、统计与轻量 API

核心优势：

- 与 `R2`、`D1`、KV 等 Cloudflare 能力协同自然
- 可以同时托管前台资源与 `/api/*` 运行时逻辑
- 适合做全球访问、低运维成本的公网部署

关键限制：

- 无法直接访问服务器本地磁盘或单机目录
- 需要以公网可访问或受控远程来源作为下载源

默认建议：

- 作为公开站点的首选生产部署
- 下载主源优先使用 `R2`
- `GitHub Repo`、`OSS`、`WebDAV` 作为补充来源

#### 主模式 B：本地部署（Node/Nitro）

定位：

- 全能力方案
- 单机或自托管环境
- 支持本地单机目录直读，并兼容 `R2`、`GitHub Repo`、`OSS`、`WebDAV`

核心优势：

- 可直接读取服务器本地目录
- 更容易集成现有文件组织结构
- 更适合需要“本地文件优先”的场景

关键限制：

- 需要自行维护服务器、反向代理、TLS、备份与监控
- 公网访问体验和全球边缘分发能力通常不如 Workers

默认建议：

- 作为功能最完整的部署模式
- 可将 `local` 设为默认展示顺序第一位
- 以单机目录作为本地文件主来源

### 7.4 两种模式的能力矩阵

#### Cloudflare Workers 模式

适合：

- 文章发布
- 站内搜索
- 下载来源聚合 API
- 运行时统计
- `R2` / `GitHub Repo` / `OSS` / `WebDAV` 远程来源展示
- 登录后评论
- Turnstile 人机验证

限制：

- 不能直接读取单机目录
- 不应依赖本地桥接或自动同步到 `R2` 才能完成首期上线

#### 本地部署（Node/Nitro）模式

适合：

- 文章发布
- 站内搜索
- 下载来源聚合 API
- 本地单机目录读取
- 统一聚合 `local + R2 + GitHub + OSS + WebDAV`
- 登录后评论与管理

限制：

- 需要自行维护运维体系
- 公网分发与边缘性能需要额外优化

### 7.5 本地文件与 Workers 的边界

当站点主部署在 `Cloudflare Workers` 上时，Workers 不直接读取单机目录文件。

如确需间接接入本机文件，应优先把本机资源转为以下远程来源之一：

- `WebDAV`
- `OSS`
- 受控 HTTP 文件服务

原则：

1. 第一阶段不要求 Workers 与本地目录自动同步到 `R2`
2. 第一阶段不引入专门的本地桥接服务作为必需链路
3. 如果项目核心需求是“本机目录直读”，则直接采用本地部署模式

### 7.6 部署实现备注

#### Cloudflare Workers

- 使用 Nuxt 官方 Cloudflare Workers 部署流程
- 已有 Nuxt 项目可直接使用 `wrangler deploy` 或先运行 `wrangler setup`
- 可将静态资源与 Worker 逻辑一起部署
- 官方自动配置会将入口指向 `.output/server/index.mjs`，静态资源目录指向 `.output/public`
- API 路由应集中在 `/api/*`，避免与静态资源路由职责混淆
- 下载来源聚合、搜索、统计等能力优先走 `/api/*` 路由
- `R2`、`D1`、KV 等能力应通过 Cloudflare bindings 管理，而不是写死在前端配置中

#### 本地部署（Node/Nitro）

- 使用 Nuxt 生成的 Node server 产物进行部署
- 默认运行入口为 `node .output/server/index.mjs`
- 默认监听变量遵循 `NITRO_PORT`/`PORT` 与 `NITRO_HOST`/`HOST`
- 推荐通过 `Nginx` 或 `Caddy` 做反向代理
- 本地下载目录、缓存目录应通过环境变量配置
- 如果本地部署将作为公网站点使用，应额外补齐 TLS、监控、日志与备份策略

### 7.7 推荐部署拓扑

#### 拓扑 A：Workers 公网主站

```text
Browser
  -> Cloudflare Workers
    -> D1
    -> R2
    -> GitHub Repo / OSS / WebDAV
```

适用：

- 公网站点
- 公开资源下载
- 低运维优先

特点：

- 结构最干净
- `R2` 为主源
- `GitHub Repo`、`OSS`、`WebDAV` 为补充来源

#### 拓扑 B：本地部署全能力站点

```text
Browser
  -> Nginx / Caddy
    -> Nuxt Nitro Server
      -> SQLite / compatible DB
      -> local directory
      -> R2
      -> GitHub Repo / OSS / WebDAV
```

适用：

- 需要本地文件直读
- 单机或自托管环境
- 需要完全掌控文件组织方式

特点：

- 功能最完整
- `local` 可作为默认展示顺序第一位
- 更容易接入现有目录结构

### 7.8 环境变量与配置原则

建议至少定义以下配置项：

- `SITE_BASE_URL`
- `DEPLOY_MODE=workers|local`
- `R2_PUBLIC_BASE_URL`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `GITHUB_TOKEN`
- `OSS_PUBLIC_BASE_URL`
- `WEBDAV_BASE_URL`
- `WEBDAV_USERNAME`
- `WEBDAV_PASSWORD`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `AUTH_SESSION_SECRET`
- `COMMENT_MODERATION_MODE=manual|hybrid|auto`
- `COMMENT_RATE_LIMIT_PER_MINUTE`
- `COMMENT_BLOCKLIST_WORDS`
- `LOCAL_STORAGE_ENABLE=true|false`
- `LOCAL_STORAGE_ROOT`
- `NITRO_PORT`
- `NITRO_HOST`

规则：

- Workers 模式下不应要求 `LOCAL_STORAGE_ROOT` 必填
- 本地部署模式下应允许 `LOCAL_STORAGE_ROOT` 成为正式配置项
- `COMMENT_BLOCKLIST_WORDS` 可通过环境变量或独立配置文件注入
- 如接入私有 OSS / WebDAV，再补充对应的凭据环境变量
- 所有私密配置必须走环境变量或平台 bindings，不能进入前端构建产物

## 8. 下载源设计

### 8.1 设计原则

- 页面层不直接感知具体存储实现。
- 所有下载资源统一抽象为“文件 + 来源列表”。
- 每个文件可以有多个镜像源。
- 所有已启用来源直接展示给用户。
- 第一阶段以“按配置展示全部来源”为主，不做容灾和自动切换。
- 来源排序仅用于展示顺序与默认按钮，不代表健康检查或自动回退。
- 用户应可以看到至少一个可直接使用的下载地址。

### 8.2 支持的来源类型

#### `r2`

适合做第一阶段主下载源。推荐使用公共桶 + 自定义域名，或其他可直接访问的公开 URL。

第一阶段不强依赖短时签名或防盗链。

#### `github_repo`

作为第一阶段主要 GitHub 来源类型。适合普通仓库文件、随仓库版本更新的资源。

#### `oss`

适合接入阿里云 OSS 或兼容对象存储的公开文件地址，可作为 Workers 模式下的补充远程来源。

#### `webdav`

适合接入公开可访问或受控鉴权的 WebDAV 文件目录，也适合作为间接承载本机文件的方式之一。

#### `github_release`

作为可选兼容来源，适合少量稳定版打包资产，但不是首期主路径。

#### `local`

这是本地部署模式下的正式来源类型，对应单机目录文件。`Cloudflare Workers` 模式下不直接读取 `local`，如需在公网侧可见，应改挂为 `webdav`、`oss` 或其他远程来源。

### 8.3 来源展示顺序

不同部署模式使用不同的默认展示顺序，页面会直接展示全部已启用来源。

#### Workers 模式默认展示顺序

1. `R2`
2. `GitHub Repo`
3. `OSS`
4. `WebDAV`
5. `GitHub Releases`（如启用）

说明：

- `R2` 是公网主源
- 其余远程来源作为补充显示
- 不做自动选源、健康切换、故障回退

#### 本地部署模式默认展示顺序

1. `local`
2. `R2`
3. `GitHub Repo`
4. `OSS`
5. `WebDAV`
6. `GitHub Releases`（如启用）

说明：

- 本地部署优先使用单机目录
- `R2` 与其他远程来源可作为补充来源同时展示
- 不要求把本地文件自动同步到 `R2`

### 8.4 阶段划分

#### 第一阶段

- 完成 `Cloudflare Workers` 主流程
- 支持 `R2`
- 支持 `GitHub Repo`
- 支持 `OSS`
- 支持 `WebDAV`
- 提供下载来源聚合 API 与来源直出展示

#### 第二阶段

- 完成本地部署（Node/Nitro）主流程
- 支持 `local` 单机目录文件源
- 复用相同下载数据结构与来源抽象
- 打通 `local + R2 + GitHub + OSS + WebDAV` 的统一展示逻辑

## 9. 数据模型

### 9.1 文章 Frontmatter

```yaml
title: 文章标题
slug: article-slug
summary: 文章摘要
publishedAt: 2026-05-12
updatedAt: 2026-05-12
draft: false
category: news
tags:
  - tag-a
  - tag-b
cover: /images/demo.jpg
authors:
  - admin
relatedDownloads:
  - tool-a
seo:
  title: 自定义 SEO 标题
  description: 自定义 SEO 描述
```

### 9.2 下载条目 Frontmatter

```yaml
title: 资源标题
slug: tool-a
summary: 资源简介
publishedAt: 2026-05-12
updatedAt: 2026-05-12
category: subtitles
tags:
  - windows
  - tools
status: active
cover: /images/tool-a.jpg
articleSlug: article-slug
versions:
  - version: 1.0.0
    label: Stable
    changelog: 首个稳定版本
    files:
      - id: win-x64
        name: tool-a-win-x64.zip
        platform: windows
        arch: x64
        size: 104857600
        sources:
          - type: r2
            key: releases/tool-a/1.0.0/tool-a-win-x64.zip
            order: 100
          - type: github_repo
            owner: example
            repo: tool-a-assets
            ref: main
            path: releases/tool-a/1.0.0/tool-a-win-x64.zip
            order: 80
          - type: oss
            url: https://oss.example.com/tool-a/1.0.0/tool-a-win-x64.zip
            order: 60
          - type: webdav
            url: https://dav.example.com/downloads/tool-a/1.0.0/tool-a-win-x64.zip
            order: 40
```

### 9.3 运行时内部模型

服务端应在读取内容后，统一转换为内部模型：

- `DownloadEntry`
- `DownloadVersion`
- `DownloadFile`
- `SourceCandidate`

这样后续无论页面渲染、API 输出还是下载解析，都走同一套数据结构。

### 9.4 评论与认证数据模型

第一阶段建议至少包含以下逻辑表：

- `users`
  - `id`
  - `email`
  - `password_hash`
  - `display_name`
  - `role`
  - `status`
  - `created_at`
- `sessions`
  - `id`
  - `user_id`
  - `expires_at`
  - `created_at`
- `comments`
  - `id`
  - `article_slug`
  - `user_id`
  - `content`
  - `status`
  - `created_at`
  - `updated_at`
- `comment_reports`
  - `id`
  - `comment_id`
  - `reporter_user_id`
  - `reason`
  - `created_at`
- `comment_moderation_logs`
  - `id`
  - `comment_id`
  - `admin_user_id`
  - `action`
  - `note`
  - `created_at`

说明：

- `status` 至少支持 `pending / approved / rejected / spam`
- Workers 模式优先落在 `D1`
- 本地部署模式优先复用同一套 schema 到 `SQLite`
- 黑名单词可来自环境变量或单独配置，不要求首期单独建表

## 10. API 设计

### 10.1 公开 API

- `GET /api/me`
  - 返回当前登录用户与会话状态
- `GET /api/search?q=xxx&type=all|articles|downloads`
  - 返回站内搜索结果
- `GET /api/downloads`
  - 返回下载列表摘要
- `GET /api/downloads/:slug`
  - 返回下载详情
- `GET /api/downloads/:slug/sources?fileId=xxx`
  - 返回该文件的全部已启用来源
- `GET /api/downloads/:slug/resolve?fileId=xxx`（可选）
  - 返回默认下载按钮目标，或直接 302 跳转
- `GET /api/comments?articleSlug=xxx`
  - 返回指定文章的已公开评论
- `POST /api/comments`
  - 提交评论，要求登录态与 Turnstile token
- `DELETE /api/comments/:id`
  - 删除当前用户自己的评论
- `POST /api/comments/:id/report`
  - 举报评论
- `POST /api/auth/register`
  - 使用邮箱/密码注册账号，要求 Turnstile token
- `POST /api/auth/login`
  - 使用邮箱/密码登录账号，要求 Turnstile token
- `POST /api/auth/logout`
  - 退出登录

### 10.2 管理与内部 API

- `POST /api/admin/revalidate`（可选）
  - 用于内容更新后触发重新构建或缓存刷新
- `GET /api/admin/comments`
  - 获取待审核评论列表
- `POST /api/admin/comments/:id/moderate`
  - 执行通过、拒绝、标记垃圾评论等操作
- `POST /api/admin/users/:id/ban`
  - 封禁指定用户评论权限

说明：

- 在 `Cloudflare Workers` 模式下，上述 API 应作为正式能力启用
- 在本地部署模式下，上述 API 应作为完整能力的一部分启用

### 10.3 下载来源组装逻辑

`sources` 接口基本流程：

1. 根据 `slug + fileId` 找到目标文件
2. 收集该文件的全部已启用来源
3. 过滤无效、缺失配置或当前部署模式不可用的来源
4. 按配置的 `order` 字段排序
5. 返回完整来源列表给页面直接展示
6. 如调用 `resolve` 接口，则取排序后的第一条来源作为默认下载目标

### 10.4 评论与认证逻辑

评论与认证接口的最低处理流程：

1. 注册、登录、评论提交时接收 Turnstile token
2. 服务端调用 Cloudflare 官方校验接口验证 token
3. 注册与登录流程使用邮箱/密码，并签发站内会话
4. 密码必须使用安全哈希算法存储，例如 `Argon2id`、`scrypt` 或等效方案
5. 会话应定义明确有效期，并支持服务端主动失效
6. 对认证接口和评论接口执行频率限制
7. 未登录用户拒绝发表评论
8. 评论写入前执行黑名单词检测，以及基础重复内容/高频外链拦截
9. 命中黑名单规则时，可按配置直接拒绝、标记 `spam` 或转为 `pending`
10. 待审核评论在公开页面默认不可见

## 11. 内容目录建议

```text
content/
  articles/
  downloads/
  pages/
  authors/
  changelog/

components/
  comments/
  download/
  article/
  layout/

server/
  api/
  services/
  utils/

lib/
  content/
  downloads/
  search/
  seo/
```

其中：

- `content/downloads` 用于维护下载元数据
- `server/services/downloads` 用于实现不同来源的适配器
- `server/services/search` 或 `lib/search` 用于统一文章与下载搜索索引
- `components/download` 用于下载页专用展示组件

说明：

- `server/` 中的下载解析逻辑不再是可有可无的附属物，而是两种主部署模式都应正式承载的核心模块

## 12. 前端页面要求

### 12.1 首页

首页需要同时承担“内容入口”和“下载入口”两种职责，建议包含：

- 站点定位说明
- 站内搜索入口
- 最新文章
- 热门下载
- 分类导航
- 公告或最近更新

### 12.2 文章页

文章页应包含：

- 标题与元数据
- 目录导航
- 正文内容
- 关联下载模块
- 评论区
- 登录提示、评论门槛说明与评论审核提示
- 上一篇/下一篇或相关推荐

### 12.3 下载详情页

下载详情页应优先突出：

- 资源说明
- 版本列表
- 文件列表
- 平台信息
- 文件大小
- 全部来源列表与默认下载按钮
- 安装说明或关联文章

下载详情页不应做成普通博客详情页的样子，而应该更偏工具页或发布页。

## 13. SEO 与可发现性

必须支持：

- 自定义 `title` 和 `meta description`
- Open Graph
- canonical URL
- sitemap
- RSS 或 Atom（至少文章支持）
- 结构化数据

文章和下载页都应生成稳定 URL，不应频繁修改 slug。

## 14. 安全与风控

- 本地文件绝对路径不得暴露到前端。
- 下载来源组装接口应校验 `slug` 和 `fileId`，防止路径拼接漏洞。
- GitHub API Token、R2 Key、WebDAV 凭据、评论系统密钥必须通过环境变量管理。
- 第一阶段下载链接不要求防盗链或短时签名。
- 若未来引入后台能力，需补充认证与审计设计。
- 评论注册、登录、提交接口必须在服务端校验 Turnstile。
- 评论接口应有 IP、用户、文章维度的频率限制。
- 评论接口应优先结合 Cloudflare WAF / Rate Limiting 规则做外围防刷。
- 评论内容提交前应执行黑名单词检测与基础重复内容检查。
- 评论内容必须带审核状态，未审核通过的评论默认不公开展示。
- 会话 cookie 应使用 `HttpOnly`、`Secure`、`SameSite` 等安全属性。

## 15. 性能要求

- 首页与文章页首屏尽量静态输出
- 评论区客户端懒加载
- 下载源列表可在客户端按需请求
- 图片支持优化与响应式尺寸
- 列表页需要控制首屏条目数，避免内容过重

## 16. 可观测性

建议在第一阶段至少记录：

- 下载按钮点击次数
- 各来源点击分布
- 搜索请求次数与无结果次数
- 404 内容访问情况
- 评论组件加载错误
- 评论提交失败次数
- Turnstile 校验失败次数
- 黑名单词命中次数
- 评论进入待审核与垃圾标记的数量

在两种主部署模式下，都建议记录：

- 下载来源组装失败次数
- 评论审核通过率
- 评论接口频率限制命中次数
- 登录失败次数

这部分可以先做轻量统计，不要求一开始就接完整 BI 系统。

## 16.1 备份与恢复

第一阶段建议明确以下原则：

- `content/` 目录与站点配置以 Git 仓库作为事实来源
- `Cloudflare D1` 需要有可执行的定期导出方案
- 本地部署使用的 `SQLite` 需要有定期备份方案
- 评论与用户数据恢复流程应至少做到“可导出、可导入、可手工恢复”

## 17. 实施里程碑

### Phase 1：项目骨架

- 初始化 `Nuxt 4`
- 接入 `Nuxt Content`
- 建立内容集合、下载 schema 与搜索结构
- 完成基础布局、路由与搜索入口
- 完成 `Cloudflare Workers` 目标下的项目骨架与构建链路

### Phase 2：Workers 评论与认证系统

- 建立 `D1` schema：用户、会话、评论、审核记录
- 完成邮箱/密码注册、登录、退出登录接口
- 接入 `Cloudflare Turnstile`
- 完成评论提交、举报、审核基础流程
- 完成评论接口的频率限制、黑名单词与基础反垃圾策略
- 完成最小可用的评论审核页

### Phase 3：Workers 内容、下载与搜索

- 文章列表和详情页
- 标签与分类
- SEO 基础能力
- 下载数据模型
- 下载列表与详情页
- 站内搜索
- `R2`、`GitHub Repo`、`OSS`、`WebDAV` 下载源适配
- 下载来源直接展示与点击统计
- 站点稳定部署到 `Cloudflare Workers`

### Phase 4：本地部署能力

- 完成本地部署（Node/Nitro）链路
- 复用评论与认证接口
- 优先复用 `D1` 对应 schema 到 `SQLite`
- 接入 `local` 单机目录文件源
- 校验 `local + R2 + GitHub + OSS + WebDAV` 统一展示逻辑
- 落实 `SQLite` 备份与恢复流程

### Phase 5：体验完善

- 首页定制
- 下载页与搜索结果页体验收敛
- 评论审核与管理体验优化
- 视觉风格收敛

## 18. 当前推荐决策

- 框架：`Nuxt 4 + Nuxt Content`
- 评论：自建评论系统，必须登录后评论
- 登录方式：`邮箱/密码`
- 评论风控：`Cloudflare Turnstile` + 频率限制 + 黑名单词 + 审核状态
- 评论存储：Workers 阶段用 `Cloudflare D1`，本地部署阶段优先用 `SQLite`
- 站内搜索：第一阶段必做
- 下载主源：`R2`
- GitHub 来源：优先 `GitHub Repo`
- 补充来源：`OSS` 与 `WebDAV`
- 主部署模式：`Cloudflare Workers`
- 第二主部署模式：`本地部署（Node/Nitro）`
- 开发顺序：先完成 `Cloudflare Workers` 模式，再在其抽象基础上扩展本地部署模式
- 本地部署文件主来源：`单机目录`
- 下载展示策略：直接展示全部已启用来源，不做容灾或自动切换
- 下载安全策略：第一阶段不做防盗链或短时签名
- 部署协同策略：Workers 与本地部署之间不要求自动同步到 `R2`
- 内容管理：先走 Git 工作流，后续按需要接 `Nuxt Studio`

## 19. 待确认问题

当前版本暂无阻塞性待确认问题，可按本 SPEC 直接进入设计与开发拆分。

## 20. 成功标准

### 20.1 Workers 阶段成功标准

- 维护者可以通过 Markdown 发布文章与下载条目
- 站内搜索可用，且覆盖文章与下载条目
- 访客可以在文章页查看评论
- 只有已登录用户才能发表评论
- 评论注册、登录、评论提交流程包含邮箱/密码、Turnstile 与服务端校验
- 评论系统具备黑名单词、频率限制、审核状态等基础反垃圾能力
- Workers 模式下，一个下载文件可以直接展示全部已配置来源，且首期至少支持 `R2` 与 `GitHub Repo`
- 如配置 `OSS` 或 `WebDAV`，下载页可以一并正确展示
- 页面样式可以不受默认模板限制进行二改
- 站点可以稳定部署到 `Cloudflare Workers`

### 20.2 全部双模式成功标准

- 在满足 Workers 阶段成功标准的前提下，站点可以稳定部署到本地 `Node/Nitro` 环境
- 本地部署模式下，一个下载文件可以直接读取单机目录，并聚合 `local + R2 + GitHub + OSS + WebDAV`
- Workers 与本地部署可以复用同一套核心内容结构、评论接口与下载抽象
- 不依赖自动同步到 `R2` 也能完成两种模式的正常运行
