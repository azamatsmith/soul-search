# Soul Search

A web app with a React frontend and a FastAPI backend.

## Prerequisites

- Node 26 via nvm: run `nvm install` in the repo root
- uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- A Docker runtime for local Supabase, such as [OrbStack](https://orbstack.dev)

## First-time setup

```sh
make install
```

Local settings live in the committed `web/.env.development` and `api/.env.development` files, so no copying is needed. Put personal overrides or local secrets in `web/.env.development.local` or `api/.env.local`; both are git-ignored.

## Run it

Run `make api` and `make web` in separate terminals, then open http://localhost:5173, which should show `API: ok`.

## Local Supabase

With your Docker runtime running, `make db-start` starts the local Supabase stack and prints its URLs and keys:

- API: http://localhost:54321
- Studio (database UI): http://localhost:54323
- Mail catcher for auth emails: http://localhost:54324

### Signing in locally

The API needs two keys from the local stack and a Claude API key for photo checks. Run `npx supabase status` and copy the first two into `api/.env.local`, then add your own Anthropic API key:

```sh
SUPABASE_SECRET_KEY=<SECRET_KEY from supabase status>
SUPABASE_JWT_SECRET=<JWT_SECRET from supabase status>
ANTHROPIC_API_KEY=<your Anthropic API key>
```

Sign in with a seeded email such as `bob@example.test`, then read the 6-digit code in the mail catcher at http://localhost:54324.

`make db-reset` rebuilds the local database from the migrations and seed data in `supabase/`. The seed adds three test players: Alice (an admin), Bob and Carol, with the emails `alice@example.test`, `bob@example.test` and `carol@example.test`. `make db-test` runs the database tests. `make db-stop` stops the stack.

## Environments

| Variable | App | Local (`.env.development`) | Staging and production |
| --- | --- | --- | --- |
| `VITE_API_URL` | web | `http://localhost:8000` | Set in the Netlify dashboard |
| `VITE_SUPABASE_URL` | web | `http://127.0.0.1:54321` | Set in the Netlify dashboard |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | web | local stack's publishable key | Set in the Netlify dashboard (the project's publishable key, safe for browsers) |
| `CORS_ORIGINS` | api | `http://localhost:5173` | Set in the Render dashboard |
| `CORS_ORIGIN_REGEX` | api | unset | Optional, set in the Render dashboard to allow origins by pattern, such as Netlify previews: `^https://deploy-preview-\d+--soulsearchapp\.netlify\.app$` |
| `SUPABASE_URL` | api | `http://127.0.0.1:54321` | Set in the Render dashboard |
| `SUPABASE_SECRET_KEY` | api | `api/.env.local` | Set in the Render dashboard |
| `SUPABASE_JWT_SECRET` | api | `api/.env.local` | Set in the Render dashboard, only if the project still uses the legacy JWT secret |
| `DATABASE_URL` | api | local stack | Set in the Render dashboard, using the transaction pooler connection string |
| `ANTHROPIC_API_KEY` | api | `api/.env.local` | Set in the Render dashboard |
| `CLOSE_OUT_SECRET` | api | `local-close-out-secret` | Set in the Render dashboard to a long random value, and store the same value in the project's Vault as `close_out_secret` (see Weekly close-out) |

Staging and production values are configured on each host, never committed.

## Deployment

The web app runs on Netlify, configured by `netlify.toml`. Netlify builds `web/` and deploys `main` to production, and builds a preview for every pull request. Previews call the production API, which accepts them through `CORS_ORIGIN_REGEX` on Render. Previews for pull requests from forks only build after approval in Netlify. `VITE_API_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in the Netlify dashboard.

The web app installs to the home screen on iPhone (Safari) and Android (Chrome) as a PWA. Its icon is `web/public/icon.svg`. After changing it, run `npm run icons` in `web/` to regenerate the PNG sizes.

The API runs on Render as a Docker service defined in `render.yaml`. Render deploys each commit to `main` once its CI checks pass, and only switches over when `/health` responds.

Database migrations reach production through the `migrate` job in CI. On every push to `main`, after the web, api and db checks pass, it runs `supabase db push` against the production database, applying any migrations in `supabase/migrations` that production doesn't have yet. Render waits for this job too, so the schema is always in place before the API code that needs it. If the job fails, Render keeps the previous version running. The job reads the connection string from the `PRODUCTION_DB_URL` secret on the `production` environment in GitHub (Settings, Environments). Use the session pooler connection string from the Supabase dashboard (Connect, Session pooler), because GitHub runners can't reach the direct connection over IPv6. Under that environment's deployment branches, allow only `main`, so a workflow run from any other branch can't read the secret. The job passes `--skip-vault`, so it never touches the Vault secrets used by the weekly close-out. The API checks `SUPABASE_URL` and `DATABASE_URL` when it starts and refuses to start if either is malformed, so a bad value fails the deploy and the previous version keeps running. Environment variables such as `CORS_ORIGINS` are set in the Render dashboard, never committed.

### Sign-in emails

Production sign-in codes are sent through [Resend](https://resend.com) as custom SMTP, because Supabase's built-in sender is heavily rate-limited. In the Supabase dashboard for the production project:

1. In Resend, verify the sending domain and create an SMTP API key.
2. Under Authentication, SMTP Settings, enable custom SMTP with host `smtp.resend.com`, port `465`, user `resend` and the API key as the password. Set the sender email to `noreply@soulsearch.cc` and the sender name to "Soul Search".
3. Under Authentication, Sign In / Providers, turn off "Allow new users to sign up". The API creates users itself after checking the allowlist, so direct signups must stay off.
4. Under Authentication, Providers, Email, set the email OTP expiry to `600` seconds and the OTP length to `6`.
5. Under Authentication, Email Templates, set both "Magic Link" and "Confirm signup" to the contents of `supabase/templates/sign-in-code.html`, with the subject `Your Soul Search code: {{ .Token }}`. The template shows the code (`{{ .Token }}`) as text, not a link, so iOS can offer it above the keyboard. The design is in `design/Soul Search Emails.dc.html`.
6. Under Authentication, Rate Limits, keep "Token verifications" at 30 per 5 minutes per IP or lower. The API locks an email after 5 wrong codes, but Supabase's own verify endpoint is public, so this per-IP limit is the backstop for anyone calling Supabase directly.

### Weekly close-out

A pg_cron job runs every hour at :05 and calls the API's `POST /close-out`, which closes every week that has ended, saves its final standings and opens the current week. It does nothing until the URL and shared secret are stored in the project's Vault. Set them once per Supabase project in the SQL editor, using the same secret as `CLOSE_OUT_SECRET` on Render:

```sql
select vault.create_secret('https://soul-search-api.onrender.com/close-out', 'close_out_url');
select vault.create_secret('<CLOSE_OUT_SECRET>', 'close_out_secret');
```

Check recent calls with `select status_code, content from net._http_response order by created desc limit 5;`.

Production web app: https://soulsearchapp.netlify.app

Production API: https://soul-search-api.onrender.com (health check at `/health`).

## Make targets

| Target | What it does |
| --- | --- |
| `make install` | Install the Supabase CLI and web (`npm ci`) and api (`uv sync`) dependencies |
| `make web` | Run the web dev server on http://localhost:5173 |
| `make api` | Run the API dev server on http://localhost:8000 |
| `make db-start` | Start the local Supabase stack |
| `make db-stop` | Stop the local Supabase stack |
| `make db-reset` | Rebuild the local database from migrations and seed data |
| `make db-test` | Run the database tests against the local stack |
| `make db-api-test` | Run the API tests that need the local database |
| `make lint` | Lint, format check and typecheck both apps |
| `make fmt` | Auto-format both apps |
| `make test` | Run web and api tests |

## Repo layout

- `web/`: React + Vite frontend
- `api/`: FastAPI backend
- `supabase/`: local Supabase config, and later migrations and seed data
- `design/`: design documents
- `docs/`: plans, specs and the [architecture overview](docs/architecture.md)
