# Repo Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A monorepo where `web/` and `api/` each run with one command, are linted, formatted and tested, and CI checks every PR (issue #1).

**Architecture:** Two independent app folders with their own tooling. A root Makefile calls into each. The web placeholder page calls the api's `/health` to prove the two run together.

**Tech Stack:** React + Vite + TypeScript (npm, Node 26), Vitest + Testing Library, ESLint + Prettier; FastAPI on Python 3.12 (uv), pytest, Ruff; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-08-repo-scaffolding-design.md`

## Global Constraints

- Node 26 (`.nvmrc` contains `26`); Python 3.12 (`api/.python-version` contains `3.12`, `requires-python = ">=3.12,<3.13"`).
- uv is the only Python tool. Install it with `brew install uv`.
- React rules: function components with hooks, named exports only, one component per file with the filename matching the component, props typed as `ComponentNameProps` interfaces, no `any`, reusable logic in `src/hooks/useSomething.ts`, no multi-line inline JSX handlers.
- Env vars: web uses only `VITE_API_URL` (example `http://localhost:8000`); api uses only `CORS_ORIGINS` (comma-separated, default `http://localhost:5173`).
- Ports: api 8000, web 5173.
- Status copy is exactly `API: checking...`, `API: ok`, `API: unreachable`.
- Commits: single-line conventional subject, GPG-signed (`git commit -S`), no body, no AI attribution.
- Near-zero code comments.

## Review Focus

1. `CORS_ORIGINS` written with spaces or a trailing comma (`"http://a, http://b,"`) should still allow both origins and nothing else. Test in Task 1.
2. `VITE_API_URL` with a trailing slash (`http://localhost:8000/`) should call `http://localhost:8000/health`, not `//health`. Test in Task 2.
3. `VITE_API_URL` unset (no `web/.env`) should show `API: unreachable` without calling `fetch`. Test in Task 2.
4. The api answering with a non-200 status (e.g. 500) should show `API: unreachable`, not `API: ok`. Test in Task 2.
5. Running `make api` without an `api/.env` file should still start with the default CORS origin. Covered by the Makefile's optional `--env-file` in Task 3 and verified by hand there.

---

### Task 1: api app with `/health` and CORS

**Files:**
- Create: `.gitignore`, `api/.python-version`, `api/pyproject.toml`, `api/uv.lock`, `api/.env.example`, `api/app/__init__.py`, `api/app/config.py`, `api/app/main.py`
- Test: `api/tests/__init__.py`, `api/tests/test_health.py`

**Interfaces:**
- Produces: `app.config.get_cors_origins() -> list[str]`; `app.main.create_app() -> FastAPI`; module-level `app = create_app()` for `fastapi dev app/main.py`.

- [ ] **Step 1: Install uv and set up the project**

Run `brew install uv`. In `api/`: `uv init --app --name soul-search-api --python 3.12 --no-readme`, delete any generated `main.py`/`hello.py`, then `uv add "fastapi[standard]"` and `uv add --dev pytest ruff`.
In `pyproject.toml` set `requires-python = ">=3.12,<3.13"`, add `[tool.ruff] line-length = 100`, `[tool.ruff.lint] select = ["E", "F", "I", "UP", "B"]`, and `[tool.pytest.ini_options] testpaths = ["tests"]`.
Root `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `.env`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `.DS_Store`.
`api/.env.example`: `CORS_ORIGINS=http://localhost:5173`.

- [ ] **Step 2: Write the failing tests in `api/tests/test_health.py`**

Each test builds the app with `TestClient(create_app())` after setting `CORS_ORIGINS` via `monkeypatch.setenv` (or `delenv` for the default case).

```python
def test_health_returns_ok(): ...
    # GET /health -> 200, json == {"status": "ok"}

def test_cors_allows_default_origin(monkeypatch): ...
    # CORS_ORIGINS unset; GET /health with Origin: http://localhost:5173
    # -> headers["access-control-allow-origin"] == "http://localhost:5173"

def test_cors_blocks_unlisted_origin(monkeypatch): ...
    # CORS_ORIGINS unset; Origin: http://evil.example
    # -> "access-control-allow-origin" not in headers

def test_cors_origins_tolerate_spaces_and_trailing_comma(monkeypatch): ...
    # CORS_ORIGINS="http://a.example, http://b.example,"
    # both origins get the header echoed back; "" is not an allowed origin
    # get_cors_origins() == ["http://a.example", "http://b.example"]
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd api && uv run pytest -v`
Expected: FAIL with `ModuleNotFoundError` / `ImportError` for `app.main`.

- [ ] **Step 4: Implement `get_cors_origins()` and `create_app()`**

`get_cors_origins` reads `os.environ.get("CORS_ORIGINS", "http://localhost:5173")`, splits on commas, strips each part, drops empties. `create_app` adds `CORSMiddleware(allow_origins=get_cors_origins(), allow_methods=["GET"], allow_headers=["*"])` and a `GET /health` route returning `{"status": "ok"}`.

- [ ] **Step 5: Run tests and lint**

Run: `cd api && uv run pytest -v && uv run ruff check . && uv run ruff format --check .`
Expected: 4 passed; Ruff reports no issues.

- [ ] **Step 6: Commit**

```bash
git add .gitignore api
git commit -S -m "feat: add fastapi app with health check"
```

---

### Task 2: web app with API status page

**Files:**
- Create: `.nvmrc`, `web/` (Vite react-ts scaffold), `web/.env.example`, `web/.prettierrc`, `web/.prettierignore`, `web/src/test/setup.ts`, `web/src/hooks/useApiHealth.ts`, `web/src/App.tsx`
- Modify: `web/vite.config.ts`, `web/eslint.config.js`, `web/package.json`, `web/src/main.tsx`, `web/index.html` (title `Soul Search`)
- Delete: template boilerplate (`src/App.css`, `src/index.css`, `src/assets/`, `public/vite.svg`) and its imports
- Test: `web/src/App.test.tsx`

**Interfaces:**
- Produces: `export type ApiHealthStatus = 'checking' | 'ok' | 'unreachable'` and `export const useApiHealth = (baseUrl: string | undefined): ApiHealthStatus` in `src/hooks/useApiHealth.ts`; `export const App = () => JSX.Element` in `src/App.tsx`.
- npm scripts later tasks call: `dev`, `build`, `lint`, `typecheck`, `format`, `format:check`, `test`.

- [ ] **Step 1: Scaffold and add tooling**

`.nvmrc`: `26`. From repo root: `npm create vite@latest web -- --template react-ts`, then in `web/`: `npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom prettier eslint-config-prettier`.
Scripts: `"lint": "eslint ."`, `"typecheck": "tsc -b"`, `"format": "prettier --write ."`, `"format:check": "prettier --check ."`, `"test": "vitest run"`.
`vite.config.ts`: `server.port 5173`, `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }` (import `defineConfig` from `vitest/config`). `setup.ts` imports `@testing-library/jest-dom/vitest`.
`eslint.config.js`: keep the template's typescript-eslint, react-hooks and react-refresh configs, add `eslint-config-prettier` last and `'@typescript-eslint/no-explicit-any': 'error'`.
`.prettierrc`: `{ "singleQuote": true, "semi": false }`. `.prettierignore`: `dist`, `coverage`, `package-lock.json`.
`web/.env.example`: `VITE_API_URL=http://localhost:8000`.
Remove the boilerplate listed above; `main.tsx` renders `<App />` via the named import.

- [ ] **Step 2: Write the failing tests in `web/src/App.test.tsx`**

Mock with `vi.stubGlobal('fetch', vi.fn(...))` and `vi.stubEnv('VITE_API_URL', ...)`; `afterEach` calls `vi.unstubAllGlobals()` and `vi.unstubAllEnvs()`.

```tsx
it('shows the app name')                         // heading "Soul Search"
it('shows checking while the request is pending') // fetch never resolves -> "API: checking..."
it('shows ok when /health responds 200')          // findByText("API: ok")
it('shows unreachable when fetch rejects')        // findByText("API: unreachable")
it('shows unreachable on a non-200 response')     // { ok: false, status: 500 } -> "API: unreachable"
it('calls /health without a double slash')        // VITE_API_URL "http://localhost:8000/" -> fetch called with "http://localhost:8000/health"
it('shows unreachable without calling fetch when VITE_API_URL is unset') // stubEnv('VITE_API_URL', '') -> fetch not called
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd web && npm test`
Expected: FAIL (App has no status text yet / `useApiHealth` missing).

- [ ] **Step 4: Implement `useApiHealth` and `App`**

`useApiHealth` returns `'unreachable'` immediately for an empty or undefined `baseUrl`; otherwise fetches `${baseUrl.replace(/\/+$/, '')}/health` in a `useEffect` with an `AbortController` aborted on cleanup, setting `'ok'` only when `response.ok`. `App` reads `import.meta.env.VITE_API_URL`, renders an `h1` "Soul Search" and a paragraph `API: {status}` (with `checking` shown as `API: checking...`).

- [ ] **Step 5: Run every web check**

Run: `cd web && npm test && npm run lint && npm run typecheck && npm run format:check && npm run build`
Expected: 7 tests pass; lint, typecheck, format check and build all succeed.

- [ ] **Step 6: Commit**

```bash
git add .nvmrc web
git commit -S -m "feat: add web app with api status page"
```

---

### Task 3: Makefile and README

**Files:**
- Create: `Makefile`, `README.md`

**Interfaces:**
- Consumes: web npm scripts from Task 2; `uv run` commands from Task 1.
- Produces: targets `install`, `web`, `api`, `lint`, `fmt`, `test` (all `.PHONY`).

- [ ] **Step 1: Write the Makefile**

| Target | Recipe |
| --- | --- |
| `install` | `cd web && npm ci` ; `cd api && uv sync` |
| `web` | `cd web && npm run dev` |
| `api` | `cd api && uv run $(if $(wildcard api/.env),--env-file .env) fastapi dev app/main.py --port 8000` |
| `lint` | web: `npm run lint && npm run format:check && npm run typecheck`; api: `uv run ruff check . && uv run ruff format --check .` |
| `fmt` | web: `npm run format`; api: `uv run ruff format . && uv run ruff check --fix .` |
| `test` | web: `npm test`; api: `uv run pytest` |

- [ ] **Step 2: Write README.md**

Sections: what Soul Search is (one line), prerequisites (Homebrew, Node 26 via nvm with `nvm use`, `brew install uv`), first-time setup (`make install`, `cp web/.env.example web/.env`, `cp api/.env.example api/.env`), the target table above, and the repo layout (`web/`, `api/`, `design/`, `docs/`).

- [ ] **Step 3: Verify from the repo root**

Run: `make install && make lint && make test`
Expected: all succeed.
Then, with no `api/.env`: `make api` starts on :8000 and `curl -s localhost:8000/health` prints `{"status":"ok"}`. With both servers running and `web/.env` copied, `http://localhost:5173` shows `API: ok`. Stop both.

- [ ] **Step 4: Commit**

```bash
git add Makefile README.md
git commit -S -m "chore: add makefile and readme"
```

---

### Task 4: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

`on: pull_request` and `push: branches: [main]`. `permissions: contents: read`. No path filters.
- **web** job (`defaults.run.working-directory: web`): `actions/checkout@v4`; `actions/setup-node@v4` with `node-version-file: .nvmrc`, `cache: npm`, `cache-dependency-path: web/package-lock.json`; `npm ci`; `npm run lint`; `npm run format:check`; `npm run typecheck`; `npm test`.
- **api** job (`working-directory: api`): `actions/checkout@v4`; `astral-sh/setup-uv` (current major) with caching on; `uv sync --locked`; `uv run ruff check .`; `uv run ruff format --check .`; `uv run pytest`.

- [ ] **Step 2: Validate locally**

Run: `npx --yes action-validator .github/workflows/ci.yml` (or `actionlint` if installed).
Expected: no errors. Real verification happens on the PR, where both jobs must go green.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -S -m "ci: run lint and tests for web and api"
```
