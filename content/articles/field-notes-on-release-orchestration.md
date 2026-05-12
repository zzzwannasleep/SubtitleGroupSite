---
title: Release Orchestration Field Notes
slug: field-notes-on-release-orchestration
summary: 记录一个字幕组发布链路如何从手工接力切换到可追踪、可搜索、可复用的内容站与下载站协同面。
publishedAt: "2026-05-01"
updatedAt: "2026-05-10"
draft: false
category: operations
tags:
  - release
  - workflow
  - workers
relatedDownloads:
  - subtitle-group-pack
seo:
  title: Release Orchestration Field Notes
  description: 字幕组发布链路的结构化整理与站点化落地。
---

## 为什么先做“链路”而不是先做“页面”

很多字幕组工具站的问题不在于页面不好看，而在于发布链路没有稳定结构。文章、版本说明、下载链接、平台差异、评论反馈都散在不同地方，最后站点只能当做静态看板。

这个项目从一开始就把内容发布和下载分发绑定在一起，原因很简单：

- 文章要能解释资源
- 下载页要能承接文章
- 搜索要能同时命中文档和资源

## 两种部署模式的分工

`Cloudflare Workers` 负责公开访问链路，`Node/Nitro` 负责本地目录直读能力。我们不把这两种模式混成一个“万能配置”，而是先把公网主路径打透，再补本地模式。

## 这篇文章关联什么

你可以继续查看下载条目里的打包样例，它演示了多版本、多平台、多来源下载链接如何同时挂载。
