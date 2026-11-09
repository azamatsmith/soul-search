# Local Supabase environment

Issue: 1b (local half). Staging wiring and the promote flow are split into a separate issue that depends on the schema, Netlify deploy and API deploy issues.

## Goal

A developer can run the full local stack: the Supabase CLI stack in Docker alongside the existing FastAPI and Vite apps, started and stopped with Make targets.

## Decisions

- Docker runtime: OrbStack (any Docker runtime works).
- Supabase CLI: an exact-pinned `supabase` devDependency in a private root `package.json`, with a committed root `package-lock.json`. Every developer and later CI gets the same CLI version.
- Supabase env vars (URL, anon key, service role key) are not added yet. The issue whose code first reads them adds them to the committed `.env.development` files.
- No migrations and no seed data yet. Both arrive with the schema issue, including the three test players.

## Layout

```
package.json, package-lock.json   supabase CLI devDependency
supabase/
  config.toml                     from supabase init, with the changes below
  .gitignore                      from supabase init
```

## config.toml changes from the defaults

- `project_id = "soul-search"`
- `[auth] site_url = "http://localhost:5173"` and `additional_redirect_urls = ["http://localhost:5173"]`, matching the web dev server.
- `[analytics] enabled = false`. The log analytics containers are heavy, need extra Docker socket setup on macOS and are unused.

Everything else stays at the defaults: Postgres, Auth, Storage, the API gateway on port 54321, Studio on 54323 and the local mail catcher on 54324, which is the local test email sender.

## Makefile

- `install` also runs `npm ci` at the repo root.
- `db-start`: `npx supabase start`
- `db-stop`: `npx supabase stop`
- `db-reset`: `npx supabase db reset`

## README

- Prerequisites add OrbStack or another Docker runtime.
- A "Local Supabase" section covers `make db-start`, the API, Studio and mail catcher URLs, `make db-reset` and `make db-stop`.
- The Make targets table adds the three new targets.

## Out of scope

Staging and production Supabase projects, deploys, the promote flow, CI running Supabase, migrations, seed data and Supabase env vars.

## Verification

1. `make install` on a clean tree installs a working CLI; `npx supabase --version` prints the pinned version.
2. `make db-start` starts the stack and prints the API, Studio and mail catcher URLs.
3. `curl -s localhost:54321/rest/v1/` gets a PostgREST response; Studio and the mail catcher load.
4. `make db-reset` completes without errors.
5. `make db-stop` leaves no Supabase containers running.
6. `make lint` and `make test` still pass.
