# Repo and project scaffolding (issue #1)

## Goal

Set up the soul-search monorepo so that `web/` and `api/` each run locally with one command, both are linted, formatted and tested, and CI checks every PR.

## Decisions

- **Layout:** two plain app folders plus a root Makefile. No npm workspaces, Turborepo or Nx.
- **web:** React + Vite + TypeScript, npm, Node 26 (pinned in `.nvmrc`).
- **api:** FastAPI on Python 3.12, managed by uv (installed with the standalone installer). uv downloads and pins Python 3.12 via `api/.python-version`.
- **web quality:** ESLint (typescript-eslint, react-hooks, `@typescript-eslint/no-explicit-any` as an error), Prettier, `tsc` type check, Vitest + Testing Library.
- **api quality:** Ruff for lint and format, pytest.
- **CI:** GitHub Actions, two jobs, no path filters.

## Layout

```
.github/workflows/ci.yml
.nvmrc
.gitignore
Makefile
README.md
web/
  .env.development
  package.json, vite.config.ts, tsconfig*.json, eslint.config.js, .prettierrc
  index.html
  src/main.tsx
  src/App.tsx
  src/App.test.tsx
  src/hooks/useApiHealth.ts
api/
  .env.development
  .python-version
  pyproject.toml, uv.lock
  app/__init__.py
  app/main.py
  app/config.py
  tests/test_health.py
```

## Behavior

### api

- `GET /health` returns `200 {"status": "ok"}`.
- CORS allows the origins in `CORS_ORIGINS`, a comma-separated list read from the environment (default `http://localhost:5173`).
- `make api` runs `uv run fastapi dev app/main.py` on port 8000.

### web

- A placeholder page shows "Soul Search" and the API status: "API: ok", "API: unreachable" or "API: checking...".
- The status comes from a `useApiHealth` hook that fetches `${VITE_API_URL}/health`.
- Follows the project React rules: function components, named exports, one component per file, props typed with `ComponentNameProps`, no `any`.
- `make web` runs `npm run dev` on port 5173.

### Env files

| File | Variable | Value |
| --- | --- | --- |
| `web/.env.development` | `VITE_API_URL` | `http://localhost:8000` |
| `api/.env.development` | `CORS_ORIGINS` | `http://localhost:5173` |

Committed local development values; personal overrides and secrets go in git-ignored `*.local` files. Staging and production values are set on each host. Only variables the code uses today; later issues add their own.

## Makefile targets

| Target | Does |
| --- | --- |
| `make install` | `npm ci` in web, `uv sync` in api |
| `make web` | Start the web dev server |
| `make api` | Start the api dev server |
| `make lint` | ESLint, Prettier check and `tsc` for web; `ruff check` and `ruff format --check` for api |
| `make fmt` | Prettier write for web; `ruff format` and `ruff check --fix` for api |
| `make test` | Vitest for web; pytest for api |

## CI

- Triggers: `pull_request` and `push` to `main`.
- **web job:** setup-node from `.nvmrc` with npm cache, `npm ci`, lint, Prettier check, type check, tests.
- **api job:** setup-uv, `uv sync --locked`, `ruff check`, `ruff format --check`, pytest.
- Both jobs always run, so they can be made required checks later.

## Testing

- **api:** `tests/test_health.py` checks the `/health` response, and that a request from an allowed origin gets the CORS header while a disallowed origin doesn't.
- **web:** `App.test.tsx` mocks `fetch` and checks the page shows "API: ok" on success and "API: unreachable" on failure.

## README

Prerequisites (nvm or Node 26, uv via `curl -LsSf https://astral.sh/uv/install.sh | sh`), first-time setup (`make install`, copying the env files), the Makefile targets, and the repo layout.

## Out of scope

Supabase (#2, #4), PWA and Netlify (#6), API deploy (#7), design tokens (#6), and pre-commit hooks.
