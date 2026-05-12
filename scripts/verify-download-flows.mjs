import BetterSqlite3 from 'better-sqlite3'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const slug = 'subtitle-assistant-cli'
const fileId = 'universal-package'
const localRelativePath = 'subtitle-assistant-cli/0.8.0/subtitle-assistant-cli-0.8.0.tgz'
const localFileContent = `local-download-${Date.now()}`
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const databasePath = resolve(projectRoot, '.data', 'site.db')
const serverPath = resolve(projectRoot, '.output', 'server', 'index.mjs')
const localRoot = resolve(projectRoot, '.data', 'local-downloads')

const checks = []

function recordCheck(name, ok, detail) {
  checks.push({ name, ok, detail })
}

async function sleep(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function waitForServer(baseUrl, serverProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Server exited early with code ${serverProcess.exitCode}.`)
    }

    try {
      const response = await fetch(`${baseUrl}/api/downloads`, {
        signal: AbortSignal.timeout(1000),
      })

      if (response.ok) {
        return
      }
    } catch {
      // Retry until ready.
    }

    await sleep(250)
  }

  throw new Error('Timed out waiting for the server to start.')
}

async function requestJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
  })

  return {
    status: response.status,
    headers: response.headers,
    json: await response.json(),
  }
}

async function requestText(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
  })

  return {
    status: response.status,
    headers: response.headers,
    text: await response.text(),
  }
}

function startServer({ deployMode, port }) {
  const baseUrl = `http://127.0.0.1:${port}`
  const serverProcess = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DEPLOY_MODE: deployMode,
      SITE_BASE_URL: baseUrl,
      AUTH_SESSION_SECRET: 'verify-download-session-secret',
      LOCAL_STORAGE_ENABLE: 'true',
      LOCAL_STORAGE_ROOT: localRoot,
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const logs = {
    stdout: '',
    stderr: '',
  }

  serverProcess.stdout.on('data', (chunk) => {
    logs.stdout += chunk.toString()
  })
  serverProcess.stderr.on('data', (chunk) => {
    logs.stderr += chunk.toString()
  })

  return {
    baseUrl,
    serverProcess,
    logs,
  }
}

async function stopServer(serverProcess) {
  serverProcess.kill()
  await Promise.race([
    new Promise((resolvePromise) => serverProcess.once('exit', resolvePromise)),
    sleep(2000),
  ])

  if (serverProcess.exitCode === null) {
    serverProcess.kill('SIGKILL')
  }
}

function getClickTotal(database, linkType) {
  const row = database
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM download_clicks
        WHERE download_slug = ? AND file_id = ? AND link_type = ?
      `,
    )
    .get(slug, fileId, linkType)

  return Number(row?.total || 0)
}

function findFileLinks(items) {
  return items.versions.flatMap((version) => version.files).find((file) => file.id === fileId)?.links || []
}

async function runLocalPhase(database) {
  await mkdir(resolve(localRoot, dirname(localRelativePath)), { recursive: true })
  await writeFile(resolve(localRoot, localRelativePath), localFileContent)

  const beforeLocalClicks = getClickTotal(database, 'local')
  const beforeRemoteClicks = getClickTotal(database, 'r2')
  const { baseUrl, serverProcess, logs } = startServer({
    deployMode: 'local',
    port: 3002,
  })

  try {
    await waitForServer(baseUrl, serverProcess)

    const downloadsList = await requestJson(baseUrl, '/api/downloads')
    const listPayload = JSON.stringify(downloadsList.json)
    recordCheck(
      'download list stays path-safe',
      downloadsList.status === 200 && listPayload.includes(slug) && !listPayload.includes(localRelativePath) && !listPayload.includes(localRoot),
      listPayload,
    )

    const detail = await requestJson(baseUrl, `/api/downloads/${slug}`)
    const detailPayload = JSON.stringify(detail.json)
    const detailLinks = findFileLinks(detail.json.data)
    recordCheck(
      'local detail exposes tracked links without local path leakage',
      detail.status === 200
        && detailLinks.some((link) => link.type === 'local' && link.href.startsWith(`/dl/${slug}/${fileId}/`))
        && !detailPayload.includes(localRelativePath)
        && !detailPayload.includes(localRoot),
      detailPayload,
    )

    const linksResponse = await requestJson(baseUrl, `/api/downloads/${slug}/links?fileId=${fileId}`)
    const linksPayload = JSON.stringify(linksResponse.json)
    const links = linksResponse.json.data.items
    const localLink = links.find((link) => link.type === 'local')
    const remoteLink = links.find((link) => link.type === 'r2')
    recordCheck(
      'local links API includes local source but never exposes path',
      linksResponse.status === 200
        && Array.isArray(links)
        && localLink
        && remoteLink
        && !linksPayload.includes(localRelativePath)
        && !linksPayload.includes(localRoot),
      linksPayload,
    )

    const localDownload = await requestText(baseUrl, localLink.href)
    recordCheck(
      'local access route streams file content',
      localDownload.status === 200 && localDownload.text === localFileContent,
      `status=${localDownload.status} body=${localDownload.text}`,
    )

    const remoteDownload = await fetch(`${baseUrl}${remoteLink.href}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    })
    recordCheck(
      'remote access route redirects to the real upstream URL',
      remoteDownload.status === 302
        && remoteDownload.headers.get('location') === 'https://downloads.example.com/subtitle-assistant-cli/0.8.0/subtitle-assistant-cli-0.8.0.tgz',
      `status=${remoteDownload.status} location=${remoteDownload.headers.get('location')}`,
    )

    recordCheck(
      'download clicks are recorded per link type',
      getClickTotal(database, 'local') >= beforeLocalClicks + 1
        && getClickTotal(database, 'r2') >= beforeRemoteClicks + 1,
      JSON.stringify({
        beforeLocalClicks,
        afterLocalClicks: getClickTotal(database, 'local'),
        beforeRemoteClicks,
        afterRemoteClicks: getClickTotal(database, 'r2'),
      }),
    )

    const detailPage = await requestText(baseUrl, `/downloads/${slug}`)
    recordCheck(
      'download page renders tracked links without leaking local paths',
      detailPage.status === 200
        && (detailPage.text.includes(`/dl/${slug}/${fileId}/`) || detailPage.text.includes(`\\u002Fdl\\u002F${slug}\\u002F${fileId}\\u002F`))
        && !detailPage.text.includes(localRelativePath)
        && !detailPage.text.includes(localRoot),
      `status=${detailPage.status}`,
    )
  } finally {
    await stopServer(serverProcess)
  }

  return logs
}

async function runWorkersPhase() {
  const { baseUrl, serverProcess, logs } = startServer({
    deployMode: 'workers',
    port: 3003,
  })

  try {
    await waitForServer(baseUrl, serverProcess)

    const detail = await requestJson(baseUrl, `/api/downloads/${slug}`)
    const detailLinks = findFileLinks(detail.json.data)
    recordCheck(
      'workers detail filters out local links',
      detail.status === 200 && detailLinks.every((link) => link.type !== 'local'),
      JSON.stringify(detailLinks),
    )

    const linksResponse = await requestJson(baseUrl, `/api/downloads/${slug}/links?fileId=${fileId}`)
    recordCheck(
      'workers links API filters out local sources',
      linksResponse.status === 200 && linksResponse.json.data.items.every((link) => link.type !== 'local'),
      JSON.stringify(linksResponse.json.data.items),
    )

    const detailPage = await requestText(baseUrl, `/downloads/${slug}`)
    recordCheck(
      'workers page does not render local paths or local links',
      detailPage.status === 200
        && !detailPage.text.includes(localRelativePath)
        && !detailPage.text.includes(localRoot),
      `status=${detailPage.status}`,
    )
  } finally {
    await stopServer(serverProcess)
  }

  return logs
}

async function main() {
  const database = new BetterSqlite3(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.exec(`
    CREATE TABLE IF NOT EXISTS download_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      download_slug TEXT NOT NULL,
      file_id TEXT NOT NULL,
      link_index INTEGER NOT NULL,
      link_type TEXT NOT NULL,
      link_label TEXT NOT NULL,
      target_url TEXT,
      created_at TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT
    )
  `)

  let localLogs
  let workerLogs

  try {
    localLogs = await runLocalPhase(database)
    workerLogs = await runWorkersPhase()
  } finally {
    database.close()
  }

  const failedChecks = checks.filter((entry) => !entry.ok)

  if (failedChecks.length) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          failedChecks,
          checks,
          localLogs: {
            stdoutTail: localLogs?.stdout.trim().split('\n').slice(-20),
            stderrTail: localLogs?.stderr.trim().split('\n').slice(-20),
          },
          workerLogs: {
            stdoutTail: workerLogs?.stdout.trim().split('\n').slice(-20),
            stderrTail: workerLogs?.stderr.trim().split('\n').slice(-20),
          },
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        fatal: error instanceof Error ? error.message : String(error),
        checks,
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
