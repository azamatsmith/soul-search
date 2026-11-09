# Email Code Auth API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR A of issue #5: FastAPI endpoints to send and check email sign-in codes with a per-email lockout, JWT validation, `GET /me` and `PUT /me/display-name`.

**Architecture:** Thin FastAPI routers over three seams that tests replace through `app.dependency_overrides`: a Supabase Auth client (httpx), repositories over a psycopg connection, and a clock. Lockout rules are pure functions on an `AttemptState` dataclass. Postgres repositories get their own tests marked `db`, which run in the CI `db` job against local Supabase.

**Tech Stack:** Python 3.12, FastAPI, httpx, psycopg 3, PyJWT with `cryptography`, pytest, pgTAP, Supabase CLI 3.

**Spec:** `docs/superpowers/specs/2026-11-09-email-code-auth-design.md`

## Global Constraints

- Code length 6 digits. Code expiry 600 s. Lockout after 5 wrong codes, lasting 15 minutes from when it starts, never extended. Wrong count starts over when the previous wrong code is more than 15 minutes old.
- Error bodies are `{"error": "<code>", ...extra}`. Codes: `not_allowed`, `locked` (+ `locked_until` ISO 8601), `too_soon`, `expired`, `auth_unavailable` (502), `wrong_code` (+ `tries_left`), `unauthenticated`, `too_short`, `invalid`, `name_taken`.
- Emails are trimmed and lowercased before every lookup and every Supabase call.
- Display name: trimmed, 2 to 20 characters matching `^[A-Za-z0-9 .'-]{2,20}$`, unique ignoring case.
- RLS on, no policies. FastAPI is the only writer.
- Ruff config in `api/pyproject.toml` (line length 100). Single-line conventional commit messages, signed (`git commit -S`). No code comments unless the logic is non-obvious.
- Run `make lint` and `make test` after every task.

## Review Focus

- **Parallel wrong guesses.** Two verify requests for the same email at once must not both read `failed_count = 4` and skip the lock. Task 5 takes a row lock (`select ... for update`) in `load_for_update`; Task 5 adds `test_load_for_update_blocks_second_transaction`.
- **Email case and spaces.** `" Bob@Example.test "` must be treated as `bob@example.test` for the allowlist, the lockout row and Supabase. Task 6 adds `test_send_code_normalizes_email`; Task 7 adds `test_verify_code_normalizes_email`.
- **Verify with no code ever sent.** `code_sent_at` is null: treat a rejection as `wrong_code`, never `expired`, and never crash on the null. Task 7 adds `test_verify_without_code_sent_counts_as_wrong`.
- **Supabase down or 5xx.** Must return 502 `{"error": "auth_unavailable"}` without counting a wrong try. Task 4 adds `test_server_error_raises_unavailable`; Task 7 adds `test_verify_auth_unavailable_does_not_count`.
- **Token from another project or with no `sub`.** Wrong signature, wrong audience, expired or missing `sub` all return 401 `unauthenticated`. Task 8 covers each case.

---

### Task 1: sign_in_attempts table, OTP expiry and code emails

**Files:**
- Create: `supabase/migrations/<timestamp>_sign_in_attempts.sql` (generate with `npx supabase migration new sign_in_attempts`)
- Create: `supabase/tests/09_sign_in_attempts.test.sql`
- Create: `supabase/templates/code.html`
- Modify: `supabase/config.toml` (`[auth.email]` block)

**Interfaces:**
- Produces: table `public.sign_in_attempts(email text pk check (email = lower(btrim(email))), failed_count integer not null default 0 check (failed_count >= 0), locked_until timestamptz, code_sent_at timestamptz, last_failed_at timestamptz, updated_at timestamptz not null default now())`, RLS enabled.

- [ ] **Step 1: Write the pgTAP test** following `supabase/tests/02_allowed_emails.test.sql`. `plan(8)`: `has_table`; `col_is_pk(... 'email')`; RLS enabled; `lives_ok` insert `'bob@example.test'`; `throws_ok` insert `'Bob@Example.test'` with `23514`; `throws_ok` insert with `failed_count = -1` with `23514`; as `anon`, `is_empty('select * from public.sign_in_attempts')`; as `authenticated`, insert throws `42501`.
- [ ] **Step 2: Run** `make db-test`. Expected: FAIL, `09_sign_in_attempts` reports the missing table.
- [ ] **Step 3: Write the migration** with the columns above and `alter table public.sign_in_attempts enable row level security;`.
- [ ] **Step 4: Set config.** In `[auth.email]`: `otp_expiry = 600`. Add `[auth.email.template.magic_link]` and `[auth.email.template.confirmation]`, each with `subject = "Your Soul Search code"` and `content_path = "./supabase/templates/code.html"`. Confirmation is the email Supabase sends to a first-time user. `code.html` is a short email: "Your Soul Search code is {{ .Token }}. It works for 10 minutes." No link.
- [ ] **Step 5: Run** `npx supabase stop && npx supabase start && make db-reset && make db-test`. Expected: all files PASS.
- [ ] **Step 6: Commit** `feat: add sign in attempts table and code email`.

### Task 2: API settings, error type and CORS

**Files:**
- Modify: `api/app/config.py`, `api/app/main.py`, `api/pyproject.toml`, `api/.env.development`, `api/tests/test_health.py`
- Create: `api/app/errors.py`, `api/app/clock.py`, `api/app/db.py`, `api/tests/conftest.py`, `api/tests/test_errors.py`

**Interfaces:**
- Produces:
  - `Settings` frozen dataclass with `supabase_url: str`, `supabase_secret_key: str`, `supabase_jwt_secret: str | None`, `database_url: str`; `get_settings() -> Settings`, reading `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL` and raising `RuntimeError` naming the missing variable. Not cached, so tests can monkeypatch the env.
  - `class ApiError(Exception): __init__(self, status: int, code: str, **extra: object)`, and `register_error_handler(app: FastAPI) -> None`, which renders `{"error": code, **extra}` with `status`.
  - `get_now() -> datetime` (UTC aware) in `app/clock.py`.
  - `get_conn() -> Iterator[psycopg.Connection]` in `app/db.py`: `with psycopg.connect(settings.database_url, prepare_threshold=None) as conn: yield conn`. `prepare_threshold=None` keeps it working behind the Supabase transaction pooler.
  - `api/tests/conftest.py`: an autouse fixture setting the four env vars to test values (`SUPABASE_URL=http://supabase.test`, and so on).

- [ ] **Step 1: Add dependencies:** `cd api && uv add httpx "psycopg[binary]" "pyjwt[crypto]"`. In `[tool.pytest.ini_options]` add `markers = ["db: needs the local Supabase database"]` and `addopts = "-m 'not db'"`.
- [ ] **Step 2: Write failing tests.** In `test_errors.py`, `test_api_error_renders_code_and_extra`: an app with a route raising `ApiError(423, "locked", locked_until="2026-11-09T10:00:00Z")` returns 423 and `{"error": "locked", "locked_until": "2026-11-09T10:00:00Z"}`. Also `test_get_settings_names_missing_variable` (`delenv("DATABASE_URL")` makes it raise with `"DATABASE_URL"` in the message). In `test_health.py`, `test_cors_preflight_allows_post_with_authorization`: an `OPTIONS /health` request with `Access-Control-Request-Method: POST` and `Access-Control-Request-Headers: authorization,content-type` returns `access-control-allow-methods` containing `POST` and `PUT`.
- [ ] **Step 3: Run** `cd api && uv run pytest`. Expected: the new tests FAIL.
- [ ] **Step 4: Implement** the interfaces above. CORS: `allow_methods=["GET", "POST", "PUT"]`, `allow_headers=["Authorization", "Content-Type"]`. Call `register_error_handler` in `create_app`. Add `SUPABASE_URL=http://127.0.0.1:54321` and `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` to `api/.env.development`.
- [ ] **Step 5: Run** `make lint && make test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: add api settings, error responses and cors for auth`.

### Task 3: Lockout rules

**Files:**
- Create: `api/app/auth/__init__.py`, `api/app/auth/lockout.py`, `api/tests/auth/__init__.py`, `api/tests/auth/test_lockout.py`

**Interfaces:**
- Produces in `app/auth/lockout.py`:
  - `MAX_WRONG = 5`, `LOCK_DURATION = timedelta(minutes=15)`, `FAIL_WINDOW = timedelta(minutes=15)`, `CODE_LIFETIME = timedelta(seconds=600)`
  - `@dataclass(frozen=True) class AttemptState: failed_count: int = 0; locked_until: datetime | None = None; code_sent_at: datetime | None = None; last_failed_at: datetime | None = None`
  - `is_locked(state, now) -> bool`
  - `register_failure(state, now) -> AttemptState`
  - `register_success(state) -> AttemptState`
  - `tries_left(state) -> int` (`MAX_WRONG - failed_count`)
  - `code_expired(state, now) -> bool` (`code_sent_at` is not None and `now - code_sent_at > CODE_LIFETIME`)

- [ ] **Step 1: Write failing tests**, all using a fixed `T0 = datetime(2026, 11, 9, 10, tzinfo=UTC)`:
  - `test_fifth_failure_locks_for_15_minutes`: five `register_failure` at `T0` give `locked_until == T0 + 15 min` and `failed_count == 0`.
  - `test_fourth_failure_leaves_one_try`: `tries_left == 1`, `is_locked` is False.
  - `test_lock_ends_exactly_after_15_minutes`: `is_locked(s, T0 + 15min - 1s)` is True and `is_locked(s, T0 + 15min)` is False.
  - `test_failure_after_quiet_window_starts_over`: 4 failures at `T0`, one at `T0 + 15min + 1s` gives `failed_count == 1`.
  - `test_failure_within_window_accumulates`: failures at `T0` and `T0 + 14min` give `failed_count == 2`.
  - `test_first_failure_after_lock_counts_as_one`: lock at `T0`, failure at `T0 + 16min` gives `failed_count == 1`.
  - `test_success_clears_count_and_lock`.
  - `test_code_expired_after_600_seconds`: sent at `T0`, not expired at `T0 + 600s`, expired at `T0 + 601s`, not expired when `code_sent_at` is None.
- [ ] **Step 2: Run** `uv run pytest tests/auth/test_lockout.py`. Expected: FAIL, import error.
- [ ] **Step 3: Implement** `register_failure` as: count = 1 if `last_failed_at` is None or `now - last_failed_at > FAIL_WINDOW`, else `failed_count + 1`. If count >= `MAX_WRONG`, return `failed_count=0, locked_until=now + LOCK_DURATION, last_failed_at=now`; otherwise `failed_count=count, last_failed_at=now`. `register_success` zeroes the count and clears `locked_until` and `last_failed_at`, keeping `code_sent_at`.
- [ ] **Step 4: Run** `make lint && make test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add sign in lockout rules`.

### Task 4: Supabase Auth client

**Files:**
- Create: `api/app/auth/supabase_auth.py`, `api/tests/auth/test_supabase_auth.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class AuthSession: access_token: str; refresh_token: str; expires_in: int; expires_at: int`
  - Exceptions `TooSoon(Exception)` and `AuthUnavailable(Exception)`.
  - `class SupabaseAuth: __init__(self, base_url: str, secret_key: str, transport: httpx.BaseTransport | None = None)`
    - `send_code(email: str) -> None`: `POST {base_url}/auth/v1/otp`, json `{"email": email, "create_user": True}`, header `apikey: <secret_key>`. A 429 raises `TooSoon`; 5xx or a connection error raises `AuthUnavailable`.
    - `verify_code(email: str, code: str) -> AuthSession | None`: `POST {base_url}/auth/v1/verify`, json `{"type": "email", "email": email, "token": code}`. 200 returns `AuthSession`; 400, 401 or 403 return None; 5xx or a connection error raises `AuthUnavailable`.
  - `get_supabase_auth() -> SupabaseAuth` FastAPI dependency built from `get_settings()`.

- [ ] **Step 1: Write failing tests** using `httpx.MockTransport` handlers that record the request:
  - `test_send_code_posts_email_with_apikey` (asserts path, json body and `apikey` header)
  - `test_send_code_429_raises_too_soon`
  - `test_verify_code_success_returns_session`
  - `test_verify_code_rejected_returns_none` (403 `{"error_code": "otp_expired"}`)
  - `test_server_error_raises_unavailable` (500 on verify)
  - `test_connection_error_raises_unavailable` (handler raises `httpx.ConnectError`)
- [ ] **Step 2: Run** them. Expected: FAIL, import error.
- [ ] **Step 3: Implement** with one `httpx.Client(timeout=10)` per instance.
- [ ] **Step 4: Run** `make lint && make test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add supabase auth client for email codes`.

### Task 5: Attempts repository

**Files:**
- Create: `api/app/auth/attempts_repo.py`, `api/tests/fakes.py`, `api/tests/auth/test_attempts_repo_db.py`, `api/tests/db_conftest.py` (imported from `api/tests/conftest.py`)
- Modify: `.github/workflows/ci.yml` (`db` job)

**Interfaces:**
- Produces:
  - `class AttemptsRepo(Protocol)` with:
    - `is_allowed(email: str) -> bool`
    - `load_for_update(email: str) -> AttemptState`: locks the row, inserting a default row first if missing (`insert ... on conflict do nothing` then `select ... for update`).
    - `save(email: str, state: AttemptState, now: datetime) -> None`: writes all four state fields and `updated_at = now`.
  - `class PgAttemptsRepo(AttemptsRepo): __init__(self, conn: psycopg.Connection)`
  - `get_attempts_repo(conn = Depends(get_conn)) -> AttemptsRepo`
  - `tests/fakes.py`: `FakeAttemptsRepo(allowed: set[str])` keeping states in a dict, with `.states` exposed for assertions.
  - `db_conn` fixture: connects to `DATABASE_URL` (default local), yields, then `rollback()`.

- [ ] **Step 1: Write failing tests marked `@pytest.mark.db`:**
  - `test_is_allowed_matches_seeded_email` (`bob@example.test` True, `nobody@example.test` False)
  - `test_load_for_update_creates_default_state`
  - `test_save_round_trips_state`
  - `test_load_for_update_blocks_second_transaction`: open a second connection with `lock_timeout = '200ms'` while the first holds the row; its `load_for_update` raises `psycopg.errors.LockNotAvailable`.
- [ ] **Step 2: Run** `uv run --env-file .env.development pytest -m db tests/auth/test_attempts_repo_db.py` with local Supabase up. Expected: FAIL, import error.
- [ ] **Step 3: Implement** `PgAttemptsRepo` and `FakeAttemptsRepo`.
- [ ] **Step 4: Run** the db tests (expected: PASS), then `make lint && make test` (expected: PASS, db tests deselected).
- [ ] **Step 5: CI.** In the `db` job, after `npx supabase test db`, add `astral-sh/setup-uv@v10.3.3` and `cd api && uv sync --locked && uv run pytest -m db` with env `DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Add a `db-api-test` Makefile target running the same command.
- [ ] **Step 6: Commit** `feat: add sign in attempts repository`.

### Task 6: POST /auth/send-code

**Files:**
- Create: `api/app/auth/routes.py`, `api/tests/auth/test_send_code.py`
- Modify: `api/app/main.py` (include the router)

**Interfaces:**
- Consumes: `AttemptsRepo`, `SupabaseAuth`, `get_now`, `is_locked`, `ApiError`.
- Produces: `router = APIRouter(prefix="/auth")`; request model `SendCodeBody(email: EmailStr)`; `normalize_email(raw: str) -> str` (exported for Task 7).
- Test helper in `tests/fakes.py`: `FakeSupabaseAuth` with `sent: list[str]`, `next_verify: AuthSession | None | Exception`, `next_send: None | Exception`. A `client(...)` fixture in `tests/conftest.py` builds `create_app()` with overrides for `get_attempts_repo`, `get_supabase_auth` and `get_now` (fixed `T0`).

- [ ] **Step 1: Write failing tests:**
  - `test_send_code_unknown_email_403` (`{"error": "not_allowed"}`, nothing sent)
  - `test_send_code_sends_and_stamps` (204, `sent == ["bob@example.test"]`, `code_sent_at == T0`)
  - `test_send_code_normalizes_email` (`" Bob@Example.TEST "` gives the same results)
  - `test_send_code_while_locked_423` (`locked_until` returned as ISO; state unchanged, nothing sent)
  - `test_send_code_too_soon_429` (`{"error": "too_soon"}`, `code_sent_at` not stamped)
  - `test_send_code_auth_unavailable_502`
- [ ] **Step 2: Run.** Expected: FAIL, 404s.
- [ ] **Step 3: Implement** in this order: normalize, allowlist check, `load_for_update`, lock check, `send_code`, then save with `code_sent_at=now`. Map `AuthUnavailable` to `ApiError(502, "auth_unavailable")` here and in Task 7.
- [ ] **Step 4: Run** `make lint && make test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add send code endpoint`.

### Task 7: POST /auth/verify-code

**Files:**
- Modify: `api/app/auth/routes.py`
- Create: `api/tests/auth/test_verify_code.py`

**Interfaces:**
- Produces: request model `VerifyCodeBody(email: EmailStr, code: constr(pattern=r"^\d{6}$"))`. The 200 body is `{access_token, refresh_token, expires_in, expires_at}`.

- [ ] **Step 1: Write failing tests:**
  - `test_verify_success_returns_session_and_resets` (prior `failed_count=3` ends at 0)
  - `test_verify_wrong_code_401_with_tries_left` (`{"error": "wrong_code", "tries_left": 4}`)
  - `test_verify_fifth_wrong_locks_423` (`locked_until == T0 + 15min`)
  - `test_verify_while_locked_423_does_not_extend` (`locked_until` unchanged and `verify` not called)
  - `test_verify_expired_410_not_counted` (`code_sent_at = T0 - 601s`; `failed_count` unchanged)
  - `test_verify_without_code_sent_counts_as_wrong`
  - `test_verify_code_normalizes_email`
  - `test_verify_rejects_non_six_digit_code_422` (`"12345"`, `"12a456"`)
  - `test_verify_auth_unavailable_does_not_count` (502, state unchanged)
  - `test_verify_unknown_email_403` (not on the allowlist: `not_allowed`, so a locked row can't be created for arbitrary emails)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** in this order: normalize, allowlist, `load_for_update`, lock check, `verify_code`. On a session, call `register_success` and save. On None: if `code_expired` return 410 without saving changes; otherwise `register_failure` and save, then return 423 if now locked, else 401 with `tries_left`.
- [ ] **Step 4: Run** `make lint && make test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add verify code endpoint with lockout`.

### Task 8: JWT validation

**Files:**
- Create: `api/app/auth/tokens.py`, `api/tests/auth/test_tokens.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class CurrentUser: id: UUID; email: str`
  - `class TokenVerifier: __init__(self, resolve_key: Callable[[str], object], hs256_secret: str | None)`. `verify(token: str) -> CurrentUser` reads the unverified header `alg`. For `HS256` it uses `hs256_secret` (a None secret means reject); for `ES256` or `RS256` it uses `resolve_key(token)`. It decodes with `audience="authenticated"`, requires `exp` and `sub`, and raises `ApiError(401, "unauthenticated")` on any failure.
  - `get_token_verifier() -> TokenVerifier`: module-level cached `jwt.PyJWKClient(f"{supabase_url}/auth/v1/.well-known/jwks.json")`, using `lambda t: client.get_signing_key_from_jwt(t).key`.
  - `get_current_user(authorization: str | None = Header(None), verifier = Depends(get_token_verifier)) -> CurrentUser`

- [ ] **Step 1: Write failing tests** with an ES256 key generated in a fixture and tokens built with `jwt.encode`:
  - `test_valid_es256_token`
  - `test_valid_hs256_token_with_secret`
  - `test_hs256_rejected_without_secret`
  - `test_expired_token_401`
  - `test_wrong_audience_401`
  - `test_bad_signature_401` (signed by a different key)
  - `test_missing_sub_401`
  - `test_missing_or_malformed_header_401`: no header, `"Token abc"`, `"Bearer "`. Exercise this through a tiny app with one route depending on `get_current_user`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `make lint && make test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: validate supabase jwts`.

### Task 9: Display name rules and players repository

**Files:**
- Create: `api/app/me/__init__.py`, `api/app/me/display_name.py`, `api/app/me/players_repo.py`, `api/tests/me/__init__.py`, `api/tests/me/test_display_name.py`, `api/tests/me/test_players_repo_db.py`
- Modify: `api/tests/fakes.py`

**Interfaces:**
- Produces:
  - `class DisplayNameError(Exception): code: Literal["too_short", "invalid"]`
  - `validate_display_name(raw: str) -> str`: trims, then fewer than 2 characters raises `too_short`; otherwise a mismatch with `^[A-Za-z0-9 .'-]{2,20}$` raises `invalid`.
  - `@dataclass(frozen=True) class Player: id: UUID; display_name: str; is_admin: bool; text_size: str`
  - `class NameTaken(Exception)`
  - `class PlayersRepo(Protocol)` with `get(id) -> Player | None`, `save_display_name(id, name) -> Player` (upsert on `id`; raises `NameTaken` on unique violation of `players_display_name_lower_key`) and `flagged_count() -> int` (`count(*) from sightings where flagged`).
  - `PgPlayersRepo(conn)`, `get_players_repo(conn = Depends(get_conn))`, and `FakePlayersRepo` in `tests/fakes.py`.

- [ ] **Step 1: Write failing unit tests:**
  - `test_trims_and_accepts` (`"  Mom K. "` gives `"Mom K."`)
  - `test_one_char_too_short`
  - `test_blank_too_short`
  - `test_21_chars_invalid`
  - `test_emoji_invalid`
  - `test_allows_apostrophe_and_hyphen` (`"O'Neil-Smith"`)
- [ ] **Step 2: Write failing db tests** (`@pytest.mark.db`; insert an `auth.users` row for a new uuid inside the rolled-back transaction):
  - `test_get_seeded_admin` (Alice `is_admin`)
  - `test_save_creates_player`
  - `test_save_renames_existing`
  - `test_save_taken_ignoring_case_raises` (`"alice"`)
  - `test_flagged_count_counts_flagged_sightings`
- [ ] **Step 3: Run** both sets. Expected: FAIL.
- [ ] **Step 4: Implement.** Catch `psycopg.errors.UniqueViolation` where `diag.constraint_name == "players_display_name_lower_key"`.
- [ ] **Step 5: Run** the db tests, then `make lint && make test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: add display name rules and players repository`.

### Task 10: GET /me and PUT /me/display-name

**Files:**
- Create: `api/app/me/routes.py`, `api/tests/me/test_me_routes.py`
- Modify: `api/app/main.py`, `api/tests/conftest.py` (override `get_current_user` and `get_players_repo`)

**Interfaces:**
- Consumes: `CurrentUser`, `PlayersRepo`, `validate_display_name`.
- Produces: `router = APIRouter(prefix="/me")`. Body: `{id, email, display_name: str | null, is_admin, text_size, flagged_count: int | null}`. PR C adds `PUT /me/text-size` to this router.

- [ ] **Step 1: Write failing tests:**
  - `test_me_before_name_step` (`display_name` None, `is_admin` False, `text_size` `"standard"`, `flagged_count` None)
  - `test_me_admin_gets_flagged_count`
  - `test_me_player_flagged_count_null`
  - `test_put_name_creates_and_returns_me`
  - `test_put_name_too_short_422` (`{"error": "too_short"}`)
  - `test_put_name_invalid_422`
  - `test_put_name_taken_409`
  - `test_me_requires_auth_401` (no override of `get_current_user`)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `make lint && make test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add me and display name endpoints`.

### Task 11: Deploy config, docs and end-to-end check

**Files:**
- Modify: `render.yaml`, `README.md`, `docs/architecture.md`

- [ ] **Step 1:** In `render.yaml` add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET` and `DATABASE_URL`, each `sync: false`.
- [ ] **Step 2:** README, local dev: copy `SUPABASE_SECRET_KEY` and `SUPABASE_JWT_SECRET` from `npx supabase status` into `api/.env.local`. Read codes in Mailpit at `http://127.0.0.1:54324`. Production: Resend domain and SMTP credentials in Supabase Auth settings, OTP expiry 600 s, magic link and confirm signup templates showing `{{ .Token }}` (copy `supabase/templates/code.html`), the four Render env vars, and `DATABASE_URL` set to the transaction pooler string.
- [ ] **Step 3:** In `docs/architecture.md`, update the login flow so the PWA calls FastAPI `/auth/send-code` and `/auth/verify-code`, and FastAPI calls Supabase Auth.
- [ ] **Step 4: End-to-end, local.** Run `make db-reset` and `make api`, then:
  - `curl -X POST localhost:8000/auth/send-code -H 'content-type: application/json' -d '{"email":"bob@example.test"}'` returns 204, and the code shows in Mailpit.
  - Verify with a wrong code: 401 `tries_left: 4`. Verify with the right code: 200 with tokens.
  - `curl localhost:8000/me -H "authorization: Bearer <access_token>"` returns Bob.
  - `nobody@example.test` returns 403.
  - Five wrong codes return 423.
- [ ] **Step 5: Run** `make lint && make test && make db-test && make db-api-test`. Expected: PASS.
- [ ] **Step 6: Commit** `docs: document email code auth setup`.
- [ ] **Step 7:** Run `/security-review` on the branch diff, then ask before pushing and opening the PR.
