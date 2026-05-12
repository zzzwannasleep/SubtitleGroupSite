export default defineAppConfig({
  site: {
    name: 'Subtitle Group Site',
    tagline: '内容发布与资源分发共用一条主链',
  },
  navigation: [
    { label: '首页', to: '/' },
    { label: '文章', to: '/articles' },
    { label: '下载', to: '/downloads' },
    { label: '搜索', to: '/search' },
    { label: '更新', to: '/changelog' },
    { label: '关于', to: '/about' },
  ],
})

