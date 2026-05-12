---
title: Subtitle Group Release Pack
slug: subtitle-group-pack
summary: 面向字幕组主发布链路的打包样例，覆盖 Windows、macOS 和 Linux 三个平台安装件。
publishedAt: "2026-05-02"
updatedAt: "2026-05-10"
status: active
category: release
tags:
  - release
  - windows
  - macos
  - linux
articleSlug: field-notes-on-release-orchestration
versions:
  - version: 2.4.1
    label: Stable Channel
    files:
      - id: win-x64-installer
        name: subtitle-group-pack-2.4.1-win-x64.exe
        platform: windows
        arch: x64
        size: 81264640
        links:
          - type: r2
            label: R2 Primary
            url: https://downloads.example.com/subtitle-group-pack/2.4.1/subtitle-group-pack-2.4.1-win-x64.exe
            order: 90
          - type: github_repo
            label: GitHub Mirror
            owner: subtitle-group
            repo: release-artifacts
            ref: main
            path: subtitle-group-pack/2.4.1/subtitle-group-pack-2.4.1-win-x64.exe
            order: 70
      - id: macos-universal
        name: subtitle-group-pack-2.4.1-macos-universal.dmg
        platform: macos
        arch: universal
        size: 92340224
        links:
          - type: r2
            label: R2 Primary
            url: https://downloads.example.com/subtitle-group-pack/2.4.1/subtitle-group-pack-2.4.1-macos-universal.dmg
            order: 90
          - type: webdav
            label: WebDAV Backup
            url: https://dav.example.com/public/subtitle-group-pack/2.4.1/subtitle-group-pack-2.4.1-macos-universal.dmg
            order: 60
      - id: linux-x64-tarball
        name: subtitle-group-pack-2.4.1-linux-x64.tar.gz
        platform: linux
        arch: x64
        size: 67502080
        links:
          - type: r2
            label: R2 Primary
            url: https://downloads.example.com/subtitle-group-pack/2.4.1/subtitle-group-pack-2.4.1-linux-x64.tar.gz
            order: 90
          - type: oss
            label: OSS Backup
            url: https://oss.example.com/subtitle-group-pack/2.4.1/subtitle-group-pack-2.4.1-linux-x64.tar.gz
            order: 65
  - version: 2.3.0
    label: Previous Stable
    files:
      - id: win-x64-installer-prev
        name: subtitle-group-pack-2.3.0-win-x64.exe
        platform: windows
        arch: x64
        size: 78433485
        links:
          - type: github_repo
            label: GitHub Archive
            owner: subtitle-group
            repo: release-artifacts
            ref: main
            path: subtitle-group-pack/2.3.0/subtitle-group-pack-2.3.0-win-x64.exe
            order: 75
---

## 资源说明

这个下载条目用于演示首期下载中心的主结构：

- 一个条目挂多个版本
- 每个版本挂多个文件
- 每个文件挂多个下载来源

## 为什么不做自动选链

首期不做镜像健康检查、自动故障切换和复杂回源决策。页面直接展示启用链接，按 `order` 倒序输出，保持行为可解释。
