# Family OS Deployment Runbook

本文件記錄 MVP 階段的部署、環境檢查、備份與驗證流程。

## Required Environment

| Key | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Runtime PostgreSQL connection string for Prisma. In Supabase production, use the pooled Supavisor URL. |
| `DIRECT_URL` | Yes | Direct or session-pooler PostgreSQL connection string for Prisma migrations and schema operations. |
| `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` | Production | Browser Web Push subscribe public key. Missing local/test values make delivery skip gracefully. |
| `WEB_PUSH_PRIVATE_KEY` | Production | Server-side Web Push private key. Missing local/test values make delivery skip gracefully. |
| `WEB_PUSH_VAPID_SUBJECT` | Production | VAPID subject, usually `mailto:admin@example.com` or an HTTPS origin controlled by the app owner. |
| `FAMILY_OS_BASE_URL` | No | Base URL used by smoke tests. Defaults to `http://localhost:3000`. |

Run:

```bash
npm run env:check
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:check
npm run db:smoke:money
```

## Verification Gate

Local MVP verification:

```bash
npm run env:check
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
npm run test
npm run audit
npm run build
npm run smoke
npm run e2e
```

CI runs the same core gate plus Prisma validation, Prisma Client generation, `prisma migrate deploy`, MVP fixture seeding, a Prisma connectivity check, and a DB-backed personal-money smoke test against PostgreSQL. E2E uses Chromium through Playwright.

## Render Blueprint

`render.yaml` defines:

- `family-os-web`: Next.js web service
- External Supabase PostgreSQL through `DATABASE_URL` and `DIRECT_URL`
- Health check: `/api/v1/health`

The Blueprint no longer creates a Render PostgreSQL database. Set `DATABASE_URL`
and `DIRECT_URL` in the Render dashboard from the Supabase project's connection
strings.

The Render build command runs:

```bash
npm ci && npm run db:generate && npm run db:check && npm run build
```

This makes DB connectivity part of the release gate. Supabase production
migrations are applied through the Supabase MCP/CLI migration flow before
deploying. Do not run `prisma migrate deploy` against a Supabase schema that was
already created through Supabase migrations unless the Prisma migration history
has been baselined.

Use `npm run db:seed` only for MVP/dev fixture environments. It creates a deterministic family, owner, child account, personal accounts, shared fund, task, wish, budget, and notification using UUID ids shared with the in-memory MVP fixture.

## Backup

When production data is DB-backed, run:

```bash
npm run db:backup
```

This calls `pg_dump` against `DATABASE_URL` and writes a timestamped dump under `backups/`.

## Supabase Database

Use Supabase as the production PostgreSQL provider. Family OS should still read
and write data through server-side Prisma and Next.js API routes.

Current Supabase production project:

- Project name: `family-os`
- Project ref: `heeosbikdepxuiftgarb`
- Region: `ap-southeast-1`
- API URL: `https://heeosbikdepxuiftgarb.supabase.co`

Recommended Supabase environment shape:

```env
DATABASE_URL="postgresql://prisma.<PROJECT_REF>:<PASSWORD>@<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://prisma.<PROJECT_REF>:<PASSWORD>@<REGION>.pooler.supabase.com:5432/postgres"
```

Create a dedicated `prisma` database role with public-schema privileges before
running migrations. See `docs/SUPABASE_SETUP.md` for the SQL and operational
notes.

Family OS uses server-side Prisma only. The Supabase production schema should
not be directly queried from the browser. The RLS hardening migration enables
RLS and revokes direct `anon` / `authenticated` table access; all application
reads/writes should go through Next.js API routes.

## Known MVP Gaps

- Some non-critical hardening remains after the MVP DB-backed runtime path, including production account recovery and broader admin operations.
- CI and Render verify migration deployment and database connectivity.
- Billing checkout is a mock session, not a payment provider webhook.
- Web Push now has a real VAPID-backed sender path from app notification creation to saved subscriptions. Browser permission E2E and durable retry/background queueing are still future hardening work.
- Backups become meaningful after DB-backed repositories are enabled.

## Web Push Delivery

Use a VAPID key pair for production:

```bash
npx web-push generate-vapid-keys
```

Set `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and `WEB_PUSH_VAPID_SUBJECT`. `npm run env:check` warns in local/test when they are missing and fails in `NODE_ENV=production`, so deployments do not silently ship without push delivery.
