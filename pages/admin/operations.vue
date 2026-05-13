<script setup lang="ts">
import { extractApiErrorMessage } from '~/utils/request'

const route = useRoute()

const hours = computed(() => {
  const raw = typeof route.query.hours === 'string' ? Number.parseInt(route.query.hours, 10) : 72
  return [24, 72, 168].includes(raw) ? raw : 72
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

const { data, pending, error, refresh } = await useFetch('/api/admin/observability', {
  key: () => `admin-observability:${hours.value}`,
  query: computed(() => ({
    hours: String(hours.value),
  })),
  immediate: isAdmin.value,
  default: () => ({
    ok: true,
    data: {
      windowHours: 72,
      since: '',
      totals: {
        downloadClicks: 0,
        searchRequests: 0,
        commentFailures: 0,
      },
      downloadClicks: [],
      searchTopQueries: [],
      recentSearches: [],
      commentFailureSummary: [],
      recentCommentFailures: [],
    },
  }),
})

const snapshot = computed(() => data.value?.data)
const hasLoadedSnapshot = computed(() => Boolean(snapshot.value?.since))
const hasTelemetry = computed(() => Boolean(
  snapshot.value?.totals.downloadClicks
  || snapshot.value?.totals.searchRequests
  || snapshot.value?.totals.commentFailures,
))
const boardErrorMessage = computed(() => (
  error.value
    ? extractApiErrorMessage(error.value, 'Observability board failed to load.')
    : ''
))

function linkForHours(nextHours: number) {
  return {
    path: '/admin/operations',
    query: {
      hours: String(nextHours),
    },
  }
}

async function refreshBoard() {
  await refresh()
}

useSeoMeta({
  title: 'Operations Board',
  description: 'Admin observability surface for downloads, search traffic, and comment failure signals.',
})
</script>

<template>
  <section class="grid gap-6">
    <SectionHeading
      label="admin / observability"
      title="Operations Board"
      summary="One view for download click telemetry, search request flow, and comment submission failures. The board is tuned for short-run operational visibility instead of long-horizon BI."
    />

    <AuthActions v-if="!session?.data.authenticated" mode="stacked" />

    <FramePanel v-else-if="!isAdmin" tone="accent">
      <div class="grid gap-3">
        <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
          access denied
        </p>
        <p class="text-sm text-pretty">
          This account can sign in, but only configured admin identities can open the operations surface.
        </p>
      </div>
    </FramePanel>

    <template v-else>
      <AdminNav />

      <FramePanel tone="muted" class="accent-strip">
        <div class="grid gap-5">
          <div class="flex flex-col gap-3 border-b border-[var(--sgs-line)] pb-5 md:flex-row md:items-end md:justify-between">
            <div class="grid gap-2">
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                active window
              </p>
              <h2 class="brand-display text-3xl font-black uppercase text-balance md:text-4xl">
                Last {{ snapshot?.windowHours || hours }} Hours
              </h2>
              <p class="max-w-3xl text-sm text-[color:var(--sgs-muted)] text-pretty">
                Use a short window for live moderation or a longer window when auditing operational drift.
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="windowHours in [24, 72, 168]"
                :key="windowHours"
                :to="linkForHours(windowHours)"
                class="border border-[var(--sgs-line-strong)] px-3 py-2 text-sm font-semibold uppercase"
                :class="hours === windowHours ? 'bg-[color:var(--sgs-accent)] text-[color:var(--sgs-panel)]' : 'bg-[color:var(--sgs-panel)] hover:bg-[color:var(--sgs-accent-soft)]'"
              >
                {{ windowHours }}h
              </NuxtLink>
              <button
                type="button"
                class="border border-[var(--sgs-line-strong)] px-3 py-2 text-sm font-semibold uppercase hover:bg-[color:var(--sgs-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="pending"
                @click="refreshBoard"
              >
                {{ pending ? 'Refreshing' : 'Refresh' }}
              </button>
            </div>
          </div>

          <p v-if="boardErrorMessage" class="text-sm text-[color:var(--sgs-accent)] text-pretty">
            {{ boardErrorMessage }}
          </p>

          <div
            v-if="hasLoadedSnapshot"
            class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] xl:grid-cols-[1.2fr_1fr_1fr]"
          >
            <div class="bg-[color:var(--sgs-panel)] p-4">
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">download clicks</p>
              <p class="mt-3 text-4xl font-black uppercase tabular-nums">{{ snapshot?.totals.downloadClicks || 0 }}</p>
            </div>
            <div class="bg-[color:var(--sgs-panel)] p-4">
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">search requests</p>
              <p class="mt-3 text-4xl font-black uppercase tabular-nums">{{ snapshot?.totals.searchRequests || 0 }}</p>
            </div>
            <div class="bg-[color:var(--sgs-panel)] p-4">
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">comment failures</p>
              <p class="mt-3 text-4xl font-black uppercase tabular-nums">{{ snapshot?.totals.commentFailures || 0 }}</p>
            </div>
          </div>
        </div>
      </FramePanel>

      <FramePanel v-if="pending && !hasLoadedSnapshot">
        <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
          Loading recent telemetry slices.
        </p>
      </FramePanel>

      <FramePanel v-else-if="boardErrorMessage && !hasLoadedSnapshot" tone="accent">
        <div class="grid gap-3">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            request failed
          </p>
          <h2 class="brand-display text-2xl font-black uppercase text-balance">
            The board could not load
          </h2>
          <p class="text-sm text-pretty">
            {{ boardErrorMessage }}
          </p>
        </div>
      </FramePanel>

      <FramePanel
        v-else-if="!hasTelemetry"
      >
        <div class="grid gap-3">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            empty window
          </p>
          <h2 class="brand-display text-2xl font-black uppercase text-balance">
            No telemetry in this range
          </h2>
          <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">
            Trigger a search, open a download link, or attempt a comment submission to populate the board.
          </p>
        </div>
      </FramePanel>

      <template v-else>
        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <FramePanel>
            <div class="grid gap-4">
              <div class="grid gap-2 border-b border-[var(--sgs-line)] pb-4">
                <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">download distribution</p>
                <h2 class="brand-display text-2xl font-black uppercase text-balance">Link pressure by file and source</h2>
              </div>

              <div class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)]">
                <div class="grid grid-cols-[1.5fr_1fr_0.9fr_0.7fr] gap-px bg-[color:var(--sgs-line-strong)]">
                  <p class="bg-[color:var(--sgs-accent-soft)] px-3 py-2 text-xs font-semibold uppercase">download</p>
                  <p class="bg-[color:var(--sgs-accent-soft)] px-3 py-2 text-xs font-semibold uppercase">file</p>
                  <p class="bg-[color:var(--sgs-accent-soft)] px-3 py-2 text-xs font-semibold uppercase">link type</p>
                  <p class="bg-[color:var(--sgs-accent-soft)] px-3 py-2 text-xs font-semibold uppercase">hits</p>
                </div>

                <div
                  v-for="entry in snapshot?.downloadClicks || []"
                  :key="`${entry.downloadSlug}-${entry.fileId}-${entry.linkType}`"
                  class="grid grid-cols-[1.5fr_1fr_0.9fr_0.7fr] gap-px bg-[color:var(--sgs-line-strong)]"
                >
                  <p class="bg-[color:var(--sgs-panel)] px-3 py-3 text-sm font-semibold text-pretty">{{ entry.downloadSlug }}</p>
                  <p class="bg-[color:var(--sgs-panel)] px-3 py-3 text-sm text-pretty">{{ entry.fileId }}</p>
                  <p class="bg-[color:var(--sgs-panel)] px-3 py-3 text-sm font-semibold uppercase">{{ entry.linkType }}</p>
                  <p class="bg-[color:var(--sgs-panel)] px-3 py-3 text-sm font-semibold tabular-nums">{{ entry.total }}</p>
                </div>
              </div>
            </div>
          </FramePanel>

          <FramePanel tone="accent">
            <div class="grid gap-4">
              <div class="grid gap-2 border-b border-[var(--sgs-line)] pb-4">
                <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">search pressure</p>
                <h2 class="brand-display text-2xl font-black uppercase text-balance">Top search terms</h2>
              </div>

              <div class="grid gap-3">
                <div
                  v-for="entry in snapshot?.searchTopQueries || []"
                  :key="`${entry.searchType}-${entry.queryText}`"
                  class="grid gap-2 border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] px-4 py-4"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-semibold text-pretty">{{ entry.queryText }}</p>
                    <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                      {{ entry.searchType }} / {{ entry.total }} hits
                    </p>
                  </div>
                  <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                    avg results {{ entry.averageResults }} / latest {{ entry.lastSeenAt }}
                  </p>
                </div>
              </div>
            </div>
          </FramePanel>
        </div>

        <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <FramePanel>
            <div class="grid gap-4">
              <div class="grid gap-2 border-b border-[var(--sgs-line)] pb-4">
                <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">recent search flow</p>
                <h2 class="brand-display text-2xl font-black uppercase text-balance">Latest search requests</h2>
              </div>

              <div class="grid gap-3">
                <div
                  v-for="entry in snapshot?.recentSearches || []"
                  :key="`${entry.createdAt}-${entry.queryText}-${entry.searchType}`"
                  class="grid gap-2 border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] px-4 py-4"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-semibold text-pretty">{{ entry.queryText }}</p>
                    <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                      {{ entry.searchType }}
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-3 text-xs text-[color:var(--sgs-muted)]">
                    <span class="brand-mono uppercase tabular-nums">page {{ entry.page }}</span>
                    <span class="brand-mono uppercase tabular-nums">size {{ entry.pageSize }}</span>
                    <span class="brand-mono uppercase tabular-nums">total {{ entry.totalResults }}</span>
                    <span class="brand-mono uppercase tabular-nums">returned {{ entry.returnedItems }}</span>
                  </div>
                  <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                    {{ entry.createdAt }}
                  </p>
                </div>
              </div>
            </div>
          </FramePanel>

          <FramePanel>
            <div class="grid gap-4">
              <div class="grid gap-2 border-b border-[var(--sgs-line)] pb-4">
                <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">comment fault map</p>
                <h2 class="brand-display text-2xl font-black uppercase text-balance">Failure clusters by code and article</h2>
              </div>

              <div class="grid gap-3">
                <div
                  v-for="entry in snapshot?.commentFailureSummary || []"
                  :key="`${entry.errorCode}-${entry.articleSlug}`"
                  class="grid gap-2 border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] px-4 py-4"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-semibold text-pretty">{{ entry.errorCode }}</p>
                    <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                      {{ entry.total }} events
                    </p>
                  </div>
                  <p class="text-xs text-[color:var(--sgs-muted)] text-pretty">{{ entry.articleSlug }}</p>
                  <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                    latest {{ entry.lastSeenAt }}
                  </p>
                </div>
              </div>
            </div>
          </FramePanel>
        </div>

        <FramePanel tone="muted">
          <div class="grid gap-4">
            <div class="grid gap-2 border-b border-[var(--sgs-line)] pb-4">
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">recent failure feed</p>
              <h2 class="brand-display text-2xl font-black uppercase text-balance">Last rejected comment submissions</h2>
            </div>

            <div class="grid gap-3">
              <div
                v-for="entry in snapshot?.recentCommentFailures || []"
                :key="`${entry.createdAt}-${entry.errorCode}-${entry.articleSlug}`"
                class="grid gap-2 border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-panel)] px-4 py-4"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-pretty">{{ entry.errorCode }}</p>
                  <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                    {{ entry.authenticated ? 'signed-in' : 'guest' }}
                  </p>
                </div>
                <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">{{ entry.errorMessage }}</p>
                <div class="flex flex-wrap gap-3 text-xs text-[color:var(--sgs-muted)]">
                  <span class="brand-mono uppercase tabular-nums">{{ entry.articleSlug }}</span>
                  <span class="brand-mono uppercase tabular-nums">{{ entry.createdAt }}</span>
                </div>
              </div>
            </div>
          </div>
        </FramePanel>
      </template>
    </template>
  </section>
</template>
