# Soul Search

A web app with a React frontend and a FastAPI backend.

## Prerequisites

- Homebrew
- Node 26 via nvm: run `nvm use` in the repo root
- uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`

## First-time setup

```sh
make install
cp web/.env.example web/.env
cp api/.env.example api/.env
```

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
