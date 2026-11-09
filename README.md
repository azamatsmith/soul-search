# Soul Search

A web app with a React frontend and a FastAPI backend.

## Prerequisites

- Node 26 via nvm: run `nvm install` in the repo root
- uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`

## First-time setup

```sh
make install
```

Local settings live in the committed `web/.env.development` and `api/.env.development` files, so no copying is needed. Put personal overrides or local secrets in `web/.env.development.local` or `api/.env.local`; both are git-ignored.

## Run it

Run `make api` and `make web` in separate terminals, then open http://localhost:5173, which should show `API: ok`.

## Environments

| Variable | App | Local (`.env.development`) | Staging and production |
| --- | --- | --- | --- |
| `VITE_API_URL` | web | `http://localhost:8000` | Set in the Netlify dashboard |
| `CORS_ORIGINS` | api | `http://localhost:5173` | Set in the API host dashboard |

Staging and production values are configured on each host, never committed.

## Make targets

| Target | What it does |
| --- | --- |
| `make install` | Install web (`npm ci`) and api (`uv sync`) dependencies |
| `make web` | Run the web dev server on http://localhost:5173 |
| `make api` | Run the API dev server on http://localhost:8000 |
| `make lint` | Lint, format check and typecheck both apps |
| `make fmt` | Auto-format both apps |
| `make test` | Run web and api tests |

## Repo layout

- `web/`: React + Vite frontend
- `api/`: FastAPI backend
- `design/`: design documents
- `docs/`: plans and specs
