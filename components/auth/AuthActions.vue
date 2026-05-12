<script setup lang="ts">
import { extractApiErrorMessage } from '~/utils/request'

const props = withDefaults(
  defineProps<{
    mode?: 'compact' | 'stacked'
  }>(),
  {
    mode: 'compact',
  },
)

const { data: session, refresh: refreshSession } = await useFetch('/api/me', {
  key: 'me',
  default: () => ({
    ok: true,
    data: {
      authenticated: false,
      user: null,
      auth: {
        githubAvailable: false,
        telegramAvailable: false,
        telegramBotName: '',
      },
      turnstile: {
        configured: false,
        siteKey: '',
      },
    },
  }),
})

const pending = ref(false)
const errorMessage = ref('')

const isAuthenticated = computed(() => Boolean(session.value?.data.authenticated))
const currentUser = computed(() => session.value?.data.user)
const isAdmin = computed(() => currentUser.value?.role === 'admin')
const isCompact = computed(() => props.mode === 'compact')
const authConfig = computed(() => session.value?.data.auth)

async function syncSession() {
  await refreshSession()
  await refreshNuxtData('me')
}

async function logout() {
  pending.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/auth/logout', {
      method: 'POST',
    })
    await syncSession()
  } catch (error) {
    errorMessage.value = extractApiErrorMessage(error, 'Logout failed.')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="grid gap-2">
    <div
      v-if="isAuthenticated && currentUser"
      class="grid gap-2 border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] p-3"
    >
      <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div class="grid gap-1">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            session active
          </p>
          <p class="text-sm font-semibold text-pretty">
            {{ currentUser.displayName }} / {{ currentUser.provider }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-if="isAdmin"
            to="/admin/comments"
            class="border border-[var(--sgs-line-strong)] px-3 py-2 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)]"
          >
            Review Desk
          </NuxtLink>
          <button
            type="button"
            class="border border-[var(--sgs-line-strong)] px-3 py-2 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="pending"
            @click="logout"
          >
            {{ pending ? 'Signing Out' : 'Logout' }}
          </button>
        </div>
      </div>
      <p v-if="currentUser.commentBanned" class="text-sm text-[color:var(--sgs-accent)] text-pretty">
        This account can browse comments but is currently blocked from posting new ones.
      </p>
    </div>

    <div
      v-else
      class="grid gap-3 border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] p-3"
    >
      <div class="grid gap-1">
        <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
          {{ isCompact ? 'comment login' : 'sign in required' }}
        </p>
        <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
          GitHub and Telegram are the two supported providers for comment submission and moderation access.
        </p>
      </div>

      <div class="grid gap-3" :class="isCompact ? 'lg:grid-cols-2' : ''">
        <a
          v-if="authConfig?.githubAvailable"
          href="/api/auth/github/start"
          class="flex items-center justify-center border border-[var(--sgs-line-strong)] px-4 py-3 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)]"
        >
          GitHub Login
        </a>

        <ClientOnly v-if="authConfig?.telegramAvailable">
          <TelegramLoginButton :bot-name="authConfig?.telegramBotName || ''" @success="syncSession" />
        </ClientOnly>
      </div>

      <p
        v-if="!authConfig?.githubAvailable && !authConfig?.telegramAvailable"
        class="text-sm text-[color:var(--sgs-muted)] text-pretty"
      >
        Login providers are not configured in this environment yet.
      </p>
    </div>

    <p v-if="errorMessage" class="text-sm text-[color:var(--sgs-accent)] text-pretty">
      {{ errorMessage }}
    </p>
  </div>
</template>
