---
title: Subtitle Assistant CLI
slug: subtitle-assistant-cli
summary: 面向维护者的命令行工具样例，用于批量生成版本清单、校验内容结构和同步发布记录。
publishedAt: "2026-04-22"
status: active
category: tooling
tags:
  - cli
  - tooling
  - automation
articleSlug: building-a-two-mode-delivery-chain
versions:
  - version: 0.8.0
    label: Preview Build
    files:
      - id: universal-package
        name: subtitle-assistant-cli-0.8.0.tgz
        platform: universal
        size: 1864320
        links:
          - type: github_repo
            label: GitHub Package
            owner: subtitle-group
            repo: tools
            ref: main
            path: releases/subtitle-assistant-cli-0.8.0.tgz
            order: 80
          - type: r2
            label: R2 Copy
            url: https://downloads.example.com/subtitle-assistant-cli/0.8.0/subtitle-assistant-cli-0.8.0.tgz
            order: 95
---

## 使用场景

命令行工具不是公开主下载流的核心，但它很适合拿来验证：

- 搜索是否能命中版本号和文件名
- 下载条目是否能关联文章
- 页面是否能兼容“只有一个版本、一个文件”的简单结构
