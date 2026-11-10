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

The API needs two keys from the local stack. Run `npx supabase status` and copy them into `api/.env.local`:

```sh
SUPABASE_SECRET_KEY=<SECRET_KEY from supabase status>
SUPABASE_JWT_SECRET=<JWT_SECRET from supabase status>
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

Staging and production values are configured on each host, never committed.

## Deployment

The web app runs on Netlify, configured by `netlify.toml`. Netlify builds `web/` and deploys `main` to production, and builds a preview for every pull request. Previews call the production API, which accepts them through `CORS_ORIGIN_REGEX` on Render. Previews for pull requests from forks only build after approval in Netlify. `VITE_API_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in the Netlify dashboard.

The web app installs to the home screen on iPhone (Safari) and Android (Chrome) as a PWA. Its icon is `web/public/icon.svg`. After changing it, run `npm run icons` in `web/` to regenerate the PNG sizes.

The API runs on Render as a Docker service defined in `render.yaml`. Render deploys each commit to `main` once its CI checks pass, and only switches over when `/health` responds. Environment variables such as `CORS_ORIGINS` are set in the Render dashboard, never committed.

### Sign-in emails

Production sign-in codes are sent through [Resend](https://resend.com) as custom SMTP, because Supabase's built-in sender is heavily rate-limited. In the Supabase dashboard for the production project:

1. In Resend, verify the sending domain and create an SMTP API key.
2. Under Authentication, SMTP Settings, enable custom SMTP with host `smtp.resend.com`, port `465`, user `resend` and the API key as the password.
3. Under Authentication, Sign In / Providers, turn off "Allow new users to sign up". The API creates users itself after checking the allowlist, so direct signups must stay off.
4. Under Authentication, Providers, Email, set the email OTP expiry to `600` seconds and the OTP length to `6`.
5. Under Authentication, Email Templates, set both "Magic Link" and "Confirm signup" to the contents of `supabase/templates/code.html`, with the subject "Your Soul Search code". The template shows the code (`{{ .Token }}`), not a link.
6. Under Authentication, Rate Limits, keep "Token verifications" at 30 per 5 minutes per IP or lower. The API locks an email after 5 wrong codes, but Supabase's own verify endpoint is public, so this per-IP limit is the backstop for anyone calling Supabase directly.

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
