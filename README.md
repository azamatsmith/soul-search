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

`make db-reset` rebuilds the local database from the migrations and seed data in `supabase/`. The seed adds three test players: Alice (an admin), Bob and Carol, with the emails `alice@example.test`, `bob@example.test` and `carol@example.test`. `make db-test` runs the database tests. `make db-stop` stops the stack.

## Environments

| Variable | App | Local (`.env.development`) | Staging and production |
| --- | --- | --- | --- |
| `VITE_API_URL` | web | `http://localhost:8000` | Set in the Netlify dashboard |
| `CORS_ORIGINS` | api | `http://localhost:5173` | Set in the Render dashboard |

Staging and production values are configured on each host, never committed.

## Deployment

The web app runs on Netlify, configured by `netlify.toml`. Netlify builds `web/` and deploys `main` to production, and builds a preview for every pull request. Previews don't call the production API. `VITE_API_URL` is set in the Netlify dashboard.

The web app installs to the iPhone home screen as a PWA. Its icon is `web/public/icon.svg`. After changing it, run `npm run icons` in `web/` to regenerate the PNG sizes.

The API runs on Render as a Docker service defined in `render.yaml`. Render deploys each commit to `main` once its CI checks pass, and only switches over when `/health` responds. Environment variables such as `CORS_ORIGINS` are set in the Render dashboard, never committed.

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
| `make lint` | Lint, format check and typecheck both apps |
| `make fmt` | Auto-format both apps |
| `make test` | Run web and api tests |

## Repo layout

- `web/`: React + Vite frontend
- `api/`: FastAPI backend
- `supabase/`: local Supabase config, and later migrations and seed data
- `design/`: design documents
- `docs/`: plans, specs and the [architecture overview](docs/architecture.md)
