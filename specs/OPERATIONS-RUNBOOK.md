# Operations Runbook

## 1. Scope

This runbook closes the first-pass operational items for:

- Workers deployment
- D1 export / restore
- local SQLite backup notes

## 2. Workers Deploy Checklist

Before a Workers deploy, verify all of the following:

- `wrangler.jsonc` keeps the D1 binding name fixed as `DB`
- `database_id` has been replaced with the real D1 database ID
- `SITE_BASE_URL` points at the real public URL
- `DEPLOY_MODE=workers`
- non-secret config is present:
  - `TURNSTILE_SITE_KEY`
  - `GITHUB_OAUTH_CLIENT_ID`
  - `TELEGRAM_BOT_NAME`
- required secrets are present:
  - `AUTH_SESSION_SECRET`
  - `TURNSTILE_SECRET_KEY`
  - `GITHUB_OAUTH_CLIENT_SECRET`
  - `TELEGRAM_BOT_TOKEN`
- optional secrets are added when those sources are enabled:
  - `GITHUB_TOKEN`
  - `WEBDAV_USERNAME`
  - `WEBDAV_PASSWORD`

## 3. Secret Bootstrap

### 3.1 Manual setup

```bash
npx wrangler secret put AUTH_SESSION_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

Optional:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put WEBDAV_USERNAME
npx wrangler secret put WEBDAV_PASSWORD
```

### 3.2 CI setup

```bash
npx wrangler deploy --secrets-file .env.production
```

Do not commit `.env.production`.

## 4. Build And Deploy

Build:

```bash
npm run build:workers
```

Deploy:

```bash
npx wrangler deploy
```

Post-deploy smoke checks:

- `GET /api/me`
- `GET /api/downloads`
- `GET /api/downloads/:slug`
- `GET /api/downloads/:slug/links?fileId=...`
- guest article page login entry
- admin moderation page access

## 5. D1 Export

Write exports outside Git or into an ignored directory such as `backups/`.

```bash
npx wrangler d1 export subtitle-group-site --remote --output backups/d1-2026-05-12.sql
```

Recommended export timing:

- before schema changes
- before moderation backfills or bulk deletes
- before auth / comment migrations
- on a regular ops cadence

## 6. D1 Restore From SQL Export

```bash
npx wrangler d1 execute subtitle-group-site --remote --file backups/d1-2026-05-12.sql
```

Safer restore order:

1. export the current production database again
2. replay the SQL file into a disposable database first
3. confirm row counts for `users`, `sessions`, `comments`, `comment_reports`, `comment_moderation_logs`, and `download_clicks`
4. replay into production only after the test import matches expectations

## 7. D1 Time Travel Restore

Get the current bookmark:

```bash
npx wrangler d1 time-travel info subtitle-group-site
```

Get the bookmark for a timestamp:

```bash
npx wrangler d1 time-travel info subtitle-group-site --timestamp="2026-05-12T22:00:00+08:00"
```

Restore by timestamp:

```bash
npx wrangler d1 time-travel restore subtitle-group-site --timestamp="2026-05-12T22:00:00+08:00"
```

Restore by bookmark:

```bash
npx wrangler d1 time-travel restore subtitle-group-site --bookmark=<bookmark>
```

Notes:

- Time Travel restore overwrites the database in place
- save the previous bookmark from the command output so the restore itself can be undone
- Cloudflare documents a 30-day Time Travel window for paid Workers plans and a 7-day window for free plans

## 8. Local SQLite Note

The local deployment path uses `.data/site.db`.

Simple local backup flow:

1. stop the Node server
2. copy `.data/site.db`
3. copy the matching `-wal` / `-shm` files if they exist
4. restart the server

## 9. References

Checked against official Cloudflare docs on May 12, 2026:

- D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- Wrangler configuration / `secrets.required`: https://developers.cloudflare.com/workers/wrangler/configuration/
- Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
