declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ) => string | number
      reset: (widgetId?: string | number) => void
      remove?: (widgetId?: string | number) => void
    }
    __subtitleGroupTelegramAuth?: (user: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
      auth_date: number
      hash: string
    }) => void | Promise<void>
  }
}

export {}
