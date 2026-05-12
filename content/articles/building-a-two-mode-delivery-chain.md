---
title: Building A Two-Mode Delivery Chain
slug: building-a-two-mode-delivery-chain
summary: 把 Workers 公网站点与本地部署目录直读分开建模，能减少实现时的大量隐藏复杂度。
publishedAt: "2026-04-21"
draft: false
category: architecture
tags:
  - architecture
  - downloads
  - local
relatedDownloads:
  - subtitle-assistant-cli
seo:
  title: Building A Two-Mode Delivery Chain
  description: 面向下载站的双模式部署拆分思路。
---

## Workers 不是本地文件服务器

首期有一个关键边界必须锁死：`Workers` 不直接读取单机目录。只要这条边界不清楚，后面的链接模型、API 设计和部署说明都会开始漂移。

## 为什么这很重要

因为下载中心需要支持：

- 公网主站的远程对象链接
- 本地部署时的目录直读
- 同一套页面结构与搜索协议

如果一开始就强行追求“什么都兼容”，项目会很快退化成到处塞条件分支的配置泥潭。

## 当前站点怎么处理

当前骨架已经把下载链接抽象为多种受控类型，并给后续的 `local` 模式留了入口，但不会在 Workers 路径里泄露本地绝对路径。
