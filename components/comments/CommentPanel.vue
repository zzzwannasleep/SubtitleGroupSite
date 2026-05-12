<script setup lang="ts">
import { formatDate } from '~/utils/format'
import { extractApiErrorMessage } from '~/utils/request'

const props = defineProps<{
  articleSlug: string
}>()

const { data: session } = await useFetch('/api/me', {
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

const { data, pending, refresh } = await useFetch('/api/comments', {
  key: () => `comments:${props.articleSlug}`,
  query: computed(() => ({
    articleSlug: props.articleSlug,
    page: '1',
    pageSize: '50',
  })),
  default: () => ({
    ok: true,
    data: {
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0,
      items: [],
    },
  }),
})

const composer = reactive({
  body: '',
  turnstileToken: 'dev-turnstile-pass',
  error: '',
  success: '',
})

const submitting = ref(false)
const reportingId = ref<number | null>(null)
const reportReason = ref('')
const reportPending = ref(false)
const reportError = ref('')
const reportSuccess = ref('')
const turnstileField = ref<{ reset: () => void } | null>(null)

const comments = computed(() => data.value?.data.items || [])
const totalComments = computed(() => data.value?.data.total || 0)
const currentUser = computed(() => session.value?.data.user)
const isAuthenticated = computed(() => Boolean(session.value?.data.authenticated))
const canPost = computed(() => Boolean(isAuthenticated.value && !currentUser.value?.commentBanned))
const turnstileSiteKey = computed(() => session.value?.data.turnstile?.siteKey || '')

async function submitComment() {
  submitting.value = true
  composer.error = ''
  composer.success = ''

  try {
    const response = await $fetch('/api/comments', {
      method: 'POST',
      body: {
        articleSlug: props.articleSlug,
        body: composer.body,
        turnstileToken: composer.turnstileToken,
      },
    })

    composer.body = ''
    composer.success = response.data.message
    composer.turnstileToken = 'dev-turnstile-pass'
    turnstileField.value?.reset()
    await refresh()
  } catch (error) {
    composer.error = extractApiErrorMessage(error, 'Comment submission failed.')
    composer.turnstileToken = 'dev-turnstile-pass'
    turnstileField.value?.reset()
  } finally {
    submitting.value = false
  }
}

function openReport(commentId: number) {
  reportingId.value = commentId
  reportReason.value = ''
  reportError.value = ''
  reportSuccess.value = ''
}

async function submitReport() {
  if (!reportingId.value) {
    return
  }

  reportPending.value = true
  reportError.value = ''
  reportSuccess.value = ''

  try {
    await $fetch(`/api/comments/${reportingId.value}/report`, {
      method: 'POST',
      body: {
        reason: reportReason.value,
      },
    })

    reportSuccess.value = 'Report submitted for review.'
    reportingId.value = null
    reportReason.value = ''
  } catch (error) {
    reportError.value = extractApiErrorMessage(error, 'Comment report failed.')
  } finally {
    reportPending.value = false
  }
}
</script>

<template>
  <div class="grid gap-6">
    <FramePanel tone="muted" class="accent-strip">
      <div class="grid gap-4">
        <SectionHeading
          label="comments"
          :title="`${totalComments} Public Comment${totalComments === 1 ? '' : 's'}`"
          summary="Only approved comments are visible publicly. New submissions pass through login, Turnstile validation, and moderation status checks."
        />

        <FramePanel v-if="pending">
          <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
            Loading comment records and moderation status.
          </p>
        </FramePanel>

        <template v-else>
          <FramePanel v-if="!comments.length">
            <div class="grid gap-3">
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                empty state
              </p>
              <h3 class="brand-display text-2xl font-black uppercase text-balance">
                No approved comments yet
              </h3>
              <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
                Sign in and submit the first moderation-tracked note for this article.
              </p>
            </div>
          </FramePanel>

          <div v-else class="grid gap-4">
            <FramePanel
              v-for="comment in comments"
              :key="comment.id"
            >
              <div class="grid gap-4">
                <div class="flex flex-col gap-2 border-b border-[var(--sgs-line)] pb-4 md:flex-row md:items-center md:justify-between">
                  <div class="grid gap-1">
                    <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                      {{ comment.provider }} / {{ formatDate(comment.createdAt) }}
                    </p>
                    <p class="text-sm font-semibold text-pretty">{{ comment.displayName }}</p>
                  </div>

                  <button
                    v-if="isAuthenticated"
                    type="button"
                    class="border border-[var(--sgs-line-strong)] px-3 py-2 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)]"
                    @click="openReport(comment.id)"
                  >
                    Report
                  </button>
                </div>

                <p class="whitespace-pre-line text-sm text-[color:var(--sgs-ink)] text-pretty">
                  {{ comment.body }}
                </p>

                <div
                  v-if="reportingId === comment.id"
                  class="grid gap-3 border-t border-[var(--sgs-line)] pt-4"
                >
                  <label
                    :for="`report-reason-${comment.id}`"
                    class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]"
                  >
                    report reason
                  </label>
                  <textarea
                    :id="`report-reason-${comment.id}`"
                    v-model="reportReason"
                    rows="3"
                    class="w-full border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] px-3 py-3 text-sm outline-none focus:border-[color:var(--sgs-accent)]"
                    placeholder="Explain why this comment should be reviewed."
                  />
                  <div class="flex flex-wrap gap-3">
                    <button
                      type="button"
                      class="border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-accent)] px-4 py-3 text-sm font-semibold uppercase text-[color:var(--sgs-panel)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="reportPending"
                      @click="submitReport"
                    >
                      {{ reportPending ? 'Reporting' : 'Submit Report' }}
                    </button>
                    <button
                      type="button"
                      class="border border-[var(--sgs-line-strong)] px-4 py-3 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)]"
                      @click="reportingId = null"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </FramePanel>
          </div>
        </template>
      </div>
    </FramePanel>

    <FramePanel tone="accent">
      <div class="grid gap-4">
        <SectionHeading
          label="comment composer"
          title="Post A Moderated Note"
          summary="Submission requires a site session and server-side Turnstile validation. Normal users land in pending review by default."
        />

        <AuthActions v-if="!isAuthenticated" mode="stacked" />

        <FramePanel v-else-if="!canPost">
          <p class="text-sm text-[color:var(--sgs-accent)] text-pretty">
            This account can read the thread but is currently blocked from posting new comments.
          </p>
        </FramePanel>

        <div v-else class="grid gap-4">
          <label
            for="comment-body"
            class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]"
          >
            comment body
          </label>
          <textarea
            id="comment-body"
            v-model="composer.body"
            rows="6"
            class="w-full border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] px-3 py-3 text-sm outline-none focus:border-[color:var(--sgs-accent)]"
            placeholder="Write a plain-text comment. Markdown and HTML are intentionally disabled."
          />

          <TurnstileTokenField ref="turnstileField" v-model="composer.turnstileToken" :site-key="turnstileSiteKey" />

          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-accent)] px-4 py-3 text-sm font-semibold uppercase text-[color:var(--sgs-panel)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="submitting"
              @click="submitComment"
            >
              {{ submitting ? 'Submitting' : 'Submit Comment' }}
            </button>
          </div>

          <p v-if="composer.success" class="text-sm text-[color:var(--sgs-ink)] text-pretty">
            {{ composer.success }}
          </p>
          <p v-if="composer.error" class="text-sm text-[color:var(--sgs-accent)] text-pretty">
            {{ composer.error }}
          </p>
          <p v-if="reportSuccess" class="text-sm text-[color:var(--sgs-ink)] text-pretty">
            {{ reportSuccess }}
          </p>
          <p v-if="reportError" class="text-sm text-[color:var(--sgs-accent)] text-pretty">
            {{ reportError }}
          </p>
        </div>
      </div>
    </FramePanel>
  </div>
</template>
