# Email code auth

Issue: 3. Email code auth (#5).

## Decisions

- Invite-only sign-in with a 6-digit email code from Supabase Auth. No magic links: a tapped link opens the browser, not the installed home-screen app, and they don't share a session.
- FastAPI handles both sending and checking codes. It is the only place that reads `allowed_emails`, counts wrong codes per email and enforces the lockout. The browser never talks to Supabase Auth directly except to store and refresh the session.
- FastAPI calls the Supabase Auth REST API (`/auth/v1/otp`, `/auth/v1/verify`) with `httpx` and the server key. No `supabase-py`.
- FastAPI reads and writes Postgres with `psycopg` over `DATABASE_URL`, consistent with the schema decision that RLS has no policies and FastAPI enforces access.
- Codes expire after 10 minutes (`otp_expiry = 600`). 5 wrong codes per email locks sign-in for 15 minutes.
- Sessions are long-lived: supabase-js persists the session and refreshes it automatically. Refresh tokens do not expire by default.
- Production email goes through Resend as custom SMTP, configured in the Supabase dashboard. Locally, Mailpit catches emails.
- Shipped as three PRs: A (backend), B (web sign-in), C (Settings).

## Data

### sign_in_attempts

| Column | Type | Notes |
| --- | --- | --- |
| email | text | primary key, stored lowercase and trimmed |
| failed_count | integer | default 0, `>= 0` |
| locked_until | timestamptz | nullable |
| code_sent_at | timestamptz | nullable, when the latest code was sent |
| last_failed_at | timestamptz | nullable, when the latest wrong code was entered |
| updated_at | timestamptz | default now() |

RLS enabled with no policies, like every other table.

`failed_count` counts wrong codes within a 15-minute window, the same length as the lockout. It goes back to 0 when any of these happen:

- a successful sign-in
- a lockout starts
- the next wrong code comes more than 15 minutes after `last_failed_at`, so that guess counts as the first of a new window

Sending a new code does not reset it, so asking for fresh codes can't dodge the lockout.

## API (PR A)

All error bodies are `{"error": "<code>", ...}`.

### POST /auth/send-code

Body `{email}`. The email is trimmed and lowercased.

| Case | Status | Body |
| --- | --- | --- |
| Not in `allowed_emails` | 403 | `not_allowed` |
| `locked_until` in the future | 423 | `locked`, `locked_until` |
| Supabase resend throttle | 429 | `too_soon` |
| Sent | 204 | |

On success it upserts `sign_in_attempts.code_sent_at = now()`. Supabase is asked to create the auth user if missing, since the allowlist was already checked.

### POST /auth/verify-code

Body `{email, code}`. `code` must be 6 digits (422 otherwise).

| Case | Status | Body |
| --- | --- | --- |
| Locked | 423 | `locked`, `locked_until` |
| Supabase accepts | 200 | `access_token`, `refresh_token`, `expires_in`, `expires_at` |
| Rejected and `code_sent_at` older than 600 s | 410 | `expired` |
| Rejected, fewer than 5 wrong | 401 | `wrong_code`, `tries_left` |
| Rejected, 5th wrong | 423 | `locked`, `locked_until` |

Success resets `failed_count` and `locked_until`. A wrong code sets `last_failed_at = now()`, and starts the count over at 1 if the previous wrong code was more than 15 minutes ago. A lockout sets `locked_until = now() + 15 min` and resets `failed_count` to 0. Expired codes don't count as wrong tries.

Supabase returns the same `otp_expired` error for a wrong code and an expired one, which is why FastAPI uses `code_sent_at` to tell them apart.

Lock checks and counter updates happen in one transaction with `select ... for update` on the email row, so parallel guesses can't exceed 5.

### Auth dependency

`get_current_player` reads `Authorization: Bearer <jwt>` and validates it with PyJWT: signature against the project's JWKS (`/auth/v1/.well-known/jwks.json`, cached), with an HS256 fallback using `SUPABASE_JWT_SECRET` when the project still signs with the legacy shared secret. Checks `exp` and `aud = authenticated`. Missing or bad token: 401 `unauthenticated`.

### GET /me

`{id, email, display_name, is_admin, text_size, flagged_count}`. `display_name` is null until the first-run name step. `flagged_count` is the number of sightings with `flagged = true`, included only for admins (null otherwise).

### PUT /me/display-name

Body `{display_name}`. Trimmed, then the same rules as the `players` check: 2 to 20 of letters, numbers, spaces and `. ' -`.

| Case | Status | Body |
| --- | --- | --- |
| Under 2 characters | 422 | `too_short` |
| Over 20 or bad characters | 422 | `invalid` |
| Taken ignoring case | 409 | `name_taken` |
| Saved | 200 | the `/me` body |

Creates the `players` row on first use (`is_admin = false`), updates it after.

### PUT /me/text-size (PR C)

Body `{text_size}`, `standard` or `large`. Returns the `/me` body. 404 `no_player` if the name step isn't done.

### Config

- New env vars: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET` (optional), `DATABASE_URL`. Local values for the URL and database go in `api/.env.development`; keys go in the gitignored `api/.env.local`, copied from `supabase status`. Production values are set on Render (`sync: false` in `render.yaml`).
- CORS allows `GET`, `POST`, `PUT` and the `Authorization` and `Content-Type` headers.
- `supabase/config.toml`: `otp_expiry = 600`.
- The README documents the Resend and Supabase dashboard setup: SMTP credentials, OTP expiry 600 s, and an email template showing `{{ .Token }}`.

## Web sign-in (PR B)

- `@supabase/supabase-js` client in `src/lib/supabase.ts`, used only for the session: `setSession()` after verify, `persistSession` and `autoRefreshToken` on, `signOut()`.
- `src/lib/api.ts`: `fetch` wrapper that adds the bearer token and returns typed results with the error code.
- `src/lib/validateDisplayName.ts`: mirrors the server rules for instant feedback. The server stays the source of truth.
- Hooks in `src/hooks`:
  - `useSession`: current session via `onAuthStateChange`.
  - `useMe`: `GET /me`; passes `text_size` to `useTextSize`.
  - `useSignIn`: email and code steps, error states, and the pending email plus `code_sent_at` kept in `localStorage`. If iOS reloads the app while the player reads the code in Mail, they return to the code step while the code is under 10 minutes old.
- Routes: `RequireAuth` wraps `AppShell`. No session goes to `/sign-in`; a session without a display name goes to `/welcome`.
- Components, one per file with a CSS module and tokens only:
  - `SignInScreen`: 01 and 01b.
  - `CodeScreen`: 02 to 02e, including "Send a new code" and "Use another email".
  - `CodeInput`: six boxes drawn over one hidden input (`inputmode="numeric"`, `autocomplete="one-time-code"`). Strips non-digits, accepts paste and autofill, submits after the 6th digit.
  - `LockoutCountdown`: live mm:ss until `locked_until`.
  - `WelcomeScreen`: 03 to 03c.

## Settings (PR C)

- `SettingsScreen` at `/settings`: profile card (initial, name, email), "Your name" row, Large text toggle, Admin tools row with the flagged badge (admins only), Sign out, version.
- `ChangeNameScreen` at `/settings/name`: same validation and errors as Welcome.
- Large text saves through `PUT /me/text-size` and applies right away through `useTextSize`.
- `/admin`: an admin-only placeholder until issue 11.
- A minimal avatar button on the Take photo header opens Settings. Issue 6 restyles it as part of Home.

## Tests

- pgTAP: `sign_in_attempts` constraints, and that `anon` and `authenticated` can't read or write it.
- pytest unit tests with Supabase Auth faked and a controllable clock: allowlist, lockout after 5, count starting over after 15 quiet minutes, expiry vs wrong code, reset on success, JWT validation (good, expired, wrong audience, bad signature).
- pytest DB tests marked `db` for the SQL in the attempts and players repositories, run in the CI `db` job against local Supabase. The `api` job skips them.
- Vitest and Testing Library: `CodeInput` (typing, paste, autofill, auto-submit), each sign-in error state against a mocked `api`, `RequireAuth` redirects, `validateDisplayName`, Settings toggles and admin row visibility.
