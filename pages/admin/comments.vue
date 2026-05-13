<script setup lang="ts">
import { extractApiErrorMessage } from '~/utils/request'

const route = useRoute()

const status = computed(() => {
  const raw = typeof route.query.status === 'string' ? route.query.status : 'pending'
  return ['pending', 'approved', 'rejected', 'spam', 'all'].includes(raw) ? raw : 'pending'
})

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

const isAdmin = computed(() => session.value?.data.user?.role === 'admin')

const { data, pending, refresh } = await useFetch('/api/admin/comments', {
  key: () => `admin-comments:${status.value}`,
  query: computed(() => ({
    status: status.value,
    page: '1',
    pageSize: '25',
  })),
  immediate: isAdmin.value,
  default: () => ({
    ok: true,
    data: {
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
      items: [],
    },
  }),
})

const actionPendingId = ref<number | null>(null)
const actionError = ref('')
const actionSuccess = ref('')
const noteByComment = reactive<Record<number, string>>({})

async function runModeration(commentId: number, action: 'approve' | 'reject' | 'spam') {
  actionPendingId.value = commentId
  actionError.value = ''
  actionSuccess.value = ''

  try {
    await $fetch(`/api/admin/comments/${commentId}/moderate`, {
      method: 'POST',
      body: {
        action,
        note: noteByComment[commentId] || '',
      },
    })
    actionSuccess.value = `Moderation action "${action}" completed.`
    await refresh()
  } catch (error) {
    actionError.value = extractApiErrorMessage(error, 'Moderation action failed.')
  } finally {
    actionPendingId.value = null
  }
}

async function deleteComment(commentId: number) {
  actionPendingId.value = commentId
  actionError.value = ''
  actionSuccess.value = ''

  try {
    await $fetch(`/api/admin/comments/${commentId}`, {
      method: 'DELETE',
      body: {
        note: noteByComment[commentId] || '',
      },
    })
    actionSuccess.value = 'Comment deleted.'
    await refresh()
  } catch (error) {
    actionError.value = extractApiErrorMessage(error, 'Comment deletion failed.')
  } finally {
    actionPendingId.value = null
  }
}

async function banUser(userId: number) {
  actionPendingId.value = userId
  actionError.value = ''
  actionSuccess.value = ''

  try {
    await $fetch(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      body: {
        note: 'Manual moderation ban.',
      },
    })
    actionSuccess.value = 'User comment access revoked.'
    await refresh()
  } catch (error) {
    actionError.value = extractApiErrorMessage(error, 'User ban failed.')
  } finally {
    actionPendingId.value = null
  }
}

useSeoMeta({
  title: '评论审核',
  description: '评论审核后台与 moderation workflow。',
})
</script>

<template>
  <section class="grid gap-6">
    <SectionHeading
      label="admin / comments"
      title="评论审核后台"
      summary="这里收口待审评论、举报线索、状态切换、删除和封禁动作，满足首期自建评论系统的审核闭环。"
    />

    <AuthActions v-if="!session?.data.authenticated" mode="stacked" />

    <FramePanel v-else-if="!isAdmin" tone="accent">
      <div class="grid gap-3">
        <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
          access denied
        </p>
        <p class="text-sm text-pretty">
          This account is signed in, but moderation access is reserved for configured admin identities only.
        </p>
      </div>
    </FramePanel>

    <template v-else>
      <AdminNav />

      <div class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] md:grid-cols-5">
        <NuxtLink
          v-for="entry in ['pending', 'approved', 'rejected', 'spam', 'all']"
          :key="entry"
          :to="{ path: '/admin/comments', query: { status: entry } }"
          class="px-4 py-3 text-center text-sm font-semibold uppercase"
          :class="status === entry ? 'bg-[color:var(--sgs-accent)] text-[color:var(--sgs-panel)]' : 'bg-[color:var(--sgs-panel)] hover:bg-[color:var(--sgs-accent-soft)]'"
        >
          {{ entry }}
        </NuxtLink>
      </div>

      <FramePanel>
        <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div class="grid gap-1">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
              moderation queue
            </p>
            <h2 class="brand-display text-2xl font-black uppercase text-balance">
              {{ data?.data.total || 0 }} Item<span v-if="(data?.data.total || 0) !== 1">s</span>
            </h2>
          </div>
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            status {{ status }}
          </p>
        </div>
      </FramePanel>

      <FramePanel v-if="pending">
        <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
          Loading moderation queue.
        </p>
      </FramePanel>

      <FramePanel v-else-if="!(data?.data.items.length)">
        <div class="grid gap-3">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            empty queue
          </p>
          <h2 class="brand-display text-2xl font-black uppercase text-balance">
            No comments in this state
          </h2>
          <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
            Switch to another moderation status or wait for the next inbound report.
          </p>
        </div>
      </FramePanel>

      <div v-else class="grid gap-4">
        <FramePanel
          v-for="comment in data?.data.items || []"
          :key="comment.id"
          class="accent-strip"
        >
          <div class="grid gap-4">
            <div class="grid gap-3 border-b border-[var(--sgs-line)] pb-4">
              <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div class="grid gap-1">
                  <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                    {{ comment.status }} / {{ comment.provider }} / user {{ comment.userId }}
                  </p>
                  <h3 class="brand-display text-2xl font-black uppercase text-balance">
                    {{ comment.articleTitle }}
                  </h3>
                </div>
                <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                  reports {{ comment.reportCount }}
                </p>
              </div>

              <div class="grid gap-1 text-sm text-[color:var(--sgs-muted)] text-pretty">
                <p>{{ comment.displayName }}<span v-if="comment.username"> / {{ comment.username }}</span></p>
                <p>Created {{ comment.createdAt }}</p>
                <p v-if="comment.latestReportReason">Latest report: {{ comment.latestReportReason }}</p>
                <p v-if="comment.commentBanned">This user is already blocked from posting.</p>
              </div>
            </div>

            <p class="whitespace-pre-line text-sm text-[color:var(--sgs-ink)] text-pretty">
              {{ comment.body }}
            </p>

            <div class="grid gap-2">
              <label
                :for="`comment-note-${comment.id}`"
                class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]"
              >
                moderation note
              </label>
              <textarea
                :id="`comment-note-${comment.id}`"
                v-model="noteByComment[comment.id]"
                rows="2"
                class="w-full border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] px-3 py-3 text-sm outline-none focus:border-[color:var(--sgs-accent)]"
                placeholder="Optional audit note for approve, reject, spam, delete, or ban."
              />
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-accent)] px-4 py-3 text-sm font-semibold uppercase text-[color:var(--sgs-panel)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="actionPendingId === comment.id"
                @click="runModeration(comment.id, 'approve')"
              >
                Approve
              </button>
              <button
                type="button"
                class="border border-[var(--sgs-line-strong)] px-4 py-3 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="actionPendingId === comment.id"
                @click="runModeration(comment.id, 'reject')"
              >
                Reject
              </button>
              <button
                type="button"
                class="border border-[var(--sgs-line-strong)] px-4 py-3 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="actionPendingId === comment.id"
                @click="runModeration(comment.id, 'spam')"
              >
                Mark Spam
              </button>
              <button
                type="button"
                class="border border-[var(--sgs-line-strong)] px-4 py-3 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="actionPendingId === comment.id"
                @click="deleteComment(comment.id)"
              >
                Delete
              </button>
              <button
                type="button"
                class="border border-[var(--sgs-line-strong)] px-4 py-3 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="actionPendingId === comment.userId || comment.commentBanned"
                @click="banUser(comment.userId)"
              >
                {{ comment.commentBanned ? 'User Banned' : 'Ban User' }}
              </button>
            </div>
          </div>
        </FramePanel>
      </div>

      <p v-if="actionSuccess" class="text-sm text-[color:var(--sgs-ink)] text-pretty">
        {{ actionSuccess }}
      </p>
      <p v-if="actionError" class="text-sm text-[color:var(--sgs-accent)] text-pretty">
        {{ actionError }}
      </p>
    </template>
  </section>
</template>
