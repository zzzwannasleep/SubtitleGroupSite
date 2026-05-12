# Content And Download Schema Spec

## 1. 范围

本文件细化 `content/` 下的内容结构与字段规则，重点覆盖：

- 文章条目 schema
- 下载条目 schema
- `versions / files / links` 结构
- 搜索提取字段
- 字段校验规则

## 2. 目录结构

```text
content/
  articles/
  downloads/
  pages/
  authors/
  changelog/
```

首期真正需要优先落地的是：

- `articles`
- `downloads`
- `pages`

`authors` 与 `changelog` 可后补。

## 3. 文章 Schema

### 3.1 必填字段

- `title`
- `slug`
- `summary`
- `publishedAt`
- `draft`

### 3.2 选填字段

- `updatedAt`
- `category`
- `tags`
- `cover`
- `authors`
- `relatedDownloads`
- `seo.title`
- `seo.description`

### 3.3 规则

- `slug` 在 `articles` 集合内必须唯一
- `draft: true` 的内容不应出现在公开列表、公开搜索、RSS 中
- `summary` 建议控制在 200 字以内
- `tags` 建议为小写、短词、可复用值

## 4. 下载条目 Schema

### 4.1 顶层必填字段

- `title`
- `slug`
- `summary`
- `publishedAt`
- `status`
- `versions`

### 4.2 顶层选填字段

- `updatedAt`
- `category`
- `tags`
- `cover`
- `articleSlug`

### 4.3 顶层规则

- `slug` 在 `downloads` 集合内必须唯一
- `status` 首期建议只允许：
  - `active`
  - `hidden`
  - `archived`
- `articleSlug` 如存在，必须能关联到真实文章

## 5. 版本结构

`versions` 是数组，每项至少包含：

- `version`
- `label`
- `files`

建议规则：

- 同一下载条目内，`version` 不重复
- 版本顺序按内容文件声明顺序展示
- 首期不要求自动语义化版本比较

## 6. 文件结构

`files` 是数组，每项至少包含：

- `id`
- `name`
- `platform`
- `size`
- `links`

选填字段：

- `arch`

规则：

- `id` 在同一版本内必须唯一
- `id` 建议只用小写字母、数字、短横线
- `size` 以字节为单位
- `platform` 建议受控枚举，例如：
  - `windows`
  - `macos`
  - `linux`
  - `android`
  - `ios`
  - `universal`

## 7. 下载链接结构

`links` 是数组，每项至少包含：

- `type`
- `label`
- `order`

按类型补充字段。

### 7.1 `r2`

必填：

- `type: r2`
- `label`
- `url`
- `order`

规则：

- `url` 必须是可直接访问的绝对地址

### 7.2 `github_repo`

必填：

- `type: github_repo`
- `label`
- `owner`
- `repo`
- `ref`
- `path`
- `order`

说明：

- 页面渲染时可转换为最终 GitHub Raw 或 Blob 下载链接
- 如项目实现时决定直接存 `url`，也可在构建阶段预生成

### 7.3 `oss`

必填：

- `type: oss`
- `label`
- `url`
- `order`

### 7.4 `webdav`

必填：

- `type: webdav`
- `label`
- `url`
- `order`

### 7.5 `github_release`

可选兼容类型，非首期主路径。

### 7.6 `local`

本地部署专用类型。

必填：

- `type: local`
- `label`
- `path`
- `order`

规则：

- `local` 不应在 Workers 模式下直接暴露
- `local.path` 不应直接出现在前端响应体
- 本地部署模式可在服务端转换为可下载链接

## 8. 链接排序规则

- `order` 越大，展示越靠前
- 页面直接按 `order` 倒序展示
- 不做自动健康检查改写排序
- 不做运行时故障回退

## 9. 搜索提取字段

### 9.1 文章

- `title`
- `summary`
- `tags`

### 9.2 下载条目

- `title`
- `summary`
- `tags`
- `versions.version`
- `files.name`

## 10. 校验规则

建议实现内容校验脚本，至少覆盖：

- `slug` 唯一性
- `articleSlug` 引用有效性
- `version` 唯一性
- `file.id` 唯一性
- `links` 非空
- 远程链接为绝对 URL
- `local` 只在本地部署模式启用
- `order` 为整数

## 11. 页面渲染规则

下载页展示顺序：

1. 下载条目基本信息
2. 版本列表
3. 文件列表
4. 每个文件下的下载链接列表
5. 关联文章或安装说明

明确不展示：

- `SHA256` 等校验值默认面板
- 下载源健康状态
- 自动切换说明

## 12. 成功标准

- 文章与下载条目 schema 可被程序稳定校验
- 下载条目可以稳定渲染为“版本 -> 文件 -> 下载链接”
- 搜索可稳定提取文章与下载条目的目标字段
- 同一份内容结构可被 Workers 与本地部署复用
