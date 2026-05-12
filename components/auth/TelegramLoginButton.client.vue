<script setup lang="ts">
import { extractApiErrorMessage } from '~/utils/request'

const emit = defineEmits<{
  success: []
}>()

const props = defineProps<{
  botName: string
}>()
const container = ref<HTMLElement | null>(null)
const pending = ref(false)
const errorMessage = ref('')

function clearWidget() {
  if (container.value) {
    container.value.innerHTML = ''
  }
}

async function onTelegramAuth(user: {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}) {
  pending.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/auth/telegram/verify', {
      method: 'POST',
      body: user,
    })
    emit('success')
  } catch (error) {
    errorMessage.value = extractApiErrorMessage(error, 'Telegram login failed.')
  } finally {
    pending.value = false
  }
}

function mountWidget() {
  if (!container.value || !props.botName) {
    return
  }

  clearWidget()

  window.__subtitleGroupTelegramAuth = onTelegramAuth

  const script = document.createElement('script')
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.async = true
  script.setAttribute('data-telegram-login', props.botName)
  script.setAttribute('data-size', 'large')
  script.setAttribute('data-radius', '0')
  script.setAttribute('data-userpic', 'false')
  script.setAttribute('data-request-access', 'write')
  script.setAttribute('data-onauth', '__subtitleGroupTelegramAuth(user)')
  container.value.appendChild(script)
}

onMounted(() => {
  mountWidget()
})

onBeforeUnmount(() => {
  clearWidget()
})
</script>

<template>
  <div class="grid gap-2">
    <div ref="container" class="min-h-[52px]" />
    <p v-if="pending" class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
      verifying telegram session
    </p>
    <p v-if="errorMessage" class="text-sm text-[color:var(--sgs-accent)] text-pretty">
      {{ errorMessage }}
    </p>
  </div>
</template>
