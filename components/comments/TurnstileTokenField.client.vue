<script setup lang="ts">
const token = defineModel<string>({
  default: '',
})

const props = defineProps<{
  siteKey: string
}>()
const container = ref<HTMLElement | null>(null)
const widgetId = ref<string | number | null>(null)
const errorMessage = ref('')

const isConfigured = computed(() => {
  const siteKey = props.siteKey
  return Boolean(siteKey && !siteKey.startsWith('replace-with-'))
})

let turnstileScriptPromise: Promise<void> | null = null

function loadTurnstileScript() {
  if (window.turnstile) {
    return Promise.resolve()
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise
  }

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]')

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.turnstileScript = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script failed to load.'))
    document.head.appendChild(script)
  })

  return turnstileScriptPromise
}

function resetField() {
  if (!isConfigured.value) {
    token.value = 'dev-turnstile-pass'
    return
  }

  token.value = ''

  if (window.turnstile && widgetId.value !== null) {
    window.turnstile.reset(widgetId.value)
  }
}

async function mountWidget() {
  if (!isConfigured.value) {
    token.value = 'dev-turnstile-pass'
    return
  }

  if (!container.value) {
    return
  }

  try {
    await loadTurnstileScript()

    if (!window.turnstile) {
      errorMessage.value = 'Turnstile script is unavailable.'
      return
    }

    widgetId.value = window.turnstile.render(container.value, {
      sitekey: props.siteKey,
      callback(nextToken) {
        token.value = nextToken
      },
      'expired-callback'() {
        token.value = ''
      },
      'error-callback'() {
        token.value = ''
        errorMessage.value = 'Turnstile verification failed. Please retry.'
      },
      theme: 'light',
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Turnstile could not be loaded.'
  }
}

defineExpose({
  reset: resetField,
})

onMounted(() => {
  mountWidget()
})
</script>

<template>
  <div class="grid gap-2">
    <label class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
      human verification
    </label>

    <div v-if="!isConfigured" class="grid gap-2">
      <input
        v-model="token"
        type="text"
        name="turnstileToken"
        autocomplete="off"
        class="w-full border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] px-3 py-3 text-sm outline-none focus:border-[color:var(--sgs-accent)]"
        placeholder="dev-turnstile-pass"
      >
      <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
        Local development fallback is active. Keep the token as <code>dev-turnstile-pass</code>.
      </p>
    </div>

    <div v-else class="grid gap-2">
      <div ref="container" class="min-h-[72px]" />
      <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
        The verification token is checked on the server before comment submission.
      </p>
    </div>

    <p v-if="errorMessage" class="text-sm text-[color:var(--sgs-accent)] text-pretty">
      {{ errorMessage }}
    </p>
  </div>
</template>
