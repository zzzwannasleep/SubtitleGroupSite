import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const articleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  summary: z.string().min(1).max(240),
  publishedAt: z.string(),
  updatedAt: z.string().optional(),
  draft: z.boolean(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  authors: z.array(z.string()).default([]),
  relatedDownloads: z.array(z.string()).default([]),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
})

const linkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('r2'),
    label: z.string().min(1),
    url: z.string().url(),
    order: z.number().int(),
  }),
  z.object({
    type: z.literal('github_repo'),
    label: z.string().min(1),
    owner: z.string().min(1),
    repo: z.string().min(1),
    ref: z.string().min(1),
    path: z.string().min(1),
    order: z.number().int(),
  }),
  z.object({
    type: z.literal('oss'),
    label: z.string().min(1),
    url: z.string().url(),
    order: z.number().int(),
  }),
  z.object({
    type: z.literal('webdav'),
    label: z.string().min(1),
    url: z.string().url(),
    order: z.number().int(),
  }),
  z.object({
    type: z.literal('local'),
    label: z.string().min(1),
    path: z.string().min(1),
    order: z.number().int(),
  }),
])

const fileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  platform: z.enum(['windows', 'macos', 'linux', 'android', 'ios', 'universal']),
  size: z.number().int().nonnegative(),
  arch: z.string().optional(),
  links: z.array(linkSchema).min(1),
})

const versionSchema = z.object({
  version: z.string().min(1),
  label: z.string().min(1),
  files: z.array(fileSchema).min(1),
})

const downloadSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  summary: z.string().min(1).max(240),
  publishedAt: z.string(),
  updatedAt: z.string().optional(),
  status: z.enum(['active', 'hidden', 'archived']),
  versions: z.array(versionSchema).min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  articleSlug: z.string().optional(),
})

const pageSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  summary: z.string().min(1).max(240),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
})

export default defineContentConfig({
  collections: {
    articles: defineCollection({
      type: 'page',
      source: 'articles/*.md',
      schema: articleSchema,
    }),
    downloads: defineCollection({
      type: 'page',
      source: 'downloads/*.md',
      schema: downloadSchema,
    }),
    pages: defineCollection({
      type: 'page',
      source: 'pages/*.md',
      schema: pageSchema,
    }),
    changelog: defineCollection({
      type: 'page',
      source: 'changelog/*.md',
      schema: pageSchema.extend({
        publishedAt: z.string(),
      }),
    }),
  },
})

