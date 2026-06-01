# Supabase Setup

Family OS uses Prisma with PostgreSQL. Supabase should be used as a managed
Postgres host first; the app should continue to access data through Next.js API
routes, not directly from browser clients.

## Current Recommendation

- Use Supabase Database as production PostgreSQL.
- Keep Family OS auth/session in the app for MVP because child accounts,
  household roles, resource permissions, and custom point flows are domain
  specific.
- Reserve Supabase Storage for albums/attachments in a later slice.
- Reserve Supabase Realtime for collaborative updates in a later slice.

## Required Environment Variables

Prisma now expects both URLs:

```env
DATABASE_URL="postgresql://prisma.<PROJECT_REF>:<PASSWORD>@<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://prisma.<PROJECT_REF>:<PASSWORD>@<REGION>.pooler.supabase.com:5432/postgres"
```

Use `DATABASE_URL` for runtime traffic. Use `DIRECT_URL` for Prisma migration
and schema operations. Local development can point both variables to the same
local PostgreSQL connection string.

## Supabase Prisma Role

Create a dedicated Prisma role in the Supabase SQL editor or through the MCP SQL
tool before running migrations:

```sql
create user "prisma" with password '<strong-password>' bypassrls createdb;
grant "prisma" to "postgres";

grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;

alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

The app currently uses server-side Prisma only. Do not expose the Prisma
database password, Supabase service role key, or `DIRECT_URL` to the browser.

## Migration Flow

After `DATABASE_URL` and `DIRECT_URL` are set:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:check
npm run db:smoke:money
```

For the managed Supabase production project, schema migrations can also be
applied through the Supabase MCP/CLI migration flow. In that case, Render should
only run `db:generate`, `db:check`, and `build`; do not also run
`prisma migrate deploy` against the same schema unless Prisma migration history
has been baselined.

Use `npm run db:seed` only for development or demo Supabase projects. Do not run
the seed script against production data unless you intentionally want the MVP
fixture family and users.

## Supabase Security Notes

- Keep tables private behind the app API for MVP.
- If a table is exposed through Supabase Data API later, enable RLS first and
  write policies matching the Family OS permission model.
- Never make authorization decisions from user-editable metadata.
- Prefer app-owned authorization tables (`family_members`,
  `family_role_permissions`, `resource_permissions`) for household access.

## Current Supabase Tool State

The connected Supabase account currently exposes these projects:

| Project | Ref | Region | Status |
|---|---|---|---|
| family-os | `heeosbikdepxuiftgarb` | ap-southeast-1 | active healthy |
| English-learn | `hksocuxqlihbonrjyahf` | ap-southeast-2 | inactive |
| accounting | `itxyfpiagifsozxsnjuj` | ap-southeast-1 | inactive |
| GF motor | `fanoseonkrtwvtugiqcj` | ap-southeast-2 | inactive |

Family OS migrations were applied to the dedicated `family-os` project through
the Supabase MCP migration flow:

- `family_os_20260531000000_init`
- `family_os_20260531010000_auth_sessions`
- `family_os_20260531143000_family_permissions_runtime`
- `family_os_20260531152000_admin_monitoring_mvp`
- `family_os_20260531170000_budget_write_path`
- `family_os_20260531193000_supabase_fk_indexes`

## RLS Decision Point

Supabase advisors report that the Family OS tables in `public` do not have Row
Level Security enabled. This is acceptable only while browser clients do not use
the Supabase Data API and all access goes through the Next.js API with
server-side Prisma.

The `20260531203000_supabase_rls_server_api_only` migration enables RLS and
revokes direct `anon` / `authenticated` access to Family OS tables. This matches
the current architecture: browser clients must not query tables through
Supabase Data API; they must call Family OS Next.js API routes.

Before exposing any table through Supabase client libraries, add RLS policies
matching the Family OS membership/permission model. Do not grant broad
`anon` / `authenticated` table access.

## Credential Rotation

If the Supabase database password is reset:

1. Update local `.env.local`.
2. Update Render `DATABASE_URL` and `DIRECT_URL`.
3. Run:

```bash
npm run db:check
npm run db:smoke:money
```

Do not commit real database passwords. `.env.local` is ignored by git.
