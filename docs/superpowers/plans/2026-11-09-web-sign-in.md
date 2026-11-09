# Web Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players sign in to the PWA with an emailed 6-digit code, pick a display name on first sign-in, and stay signed in.

**Architecture:** The browser talks to FastAPI for every auth step (`/auth/send-code`, `/auth/verify-code`, `/me`, `/me/display-name`). supabase-js is used only to hold, persist and refresh the session (`setSession`). A `RequireAuth` route element gates the app: no session goes to `/sign-in`, a session without a display name goes to `/welcome`.

**Tech Stack:** React 19, react-router 8, TypeScript, CSS Modules, Vitest + Testing Library, `@supabase/supabase-js` v2.

**Spec:** `docs/superpowers/specs/2026-11-09-email-code-auth-design.md` (section "Web sign-in (PR B)" and the API tables). Visuals: `design/Soul Search Sign In.dc.html` (screens 01 to 03c). Open the design file in a browser for layout; this plan pins behavior and copy.

## Global Constraints

- All commands run from `web/`. After every task: `npm run lint && npm run typecheck && npm test && npm run format:check` must pass.
- Function components, named exports, one component per file, filename = component name, under ~150 lines. Props typed with `interface ComponentNameProps`.
- No `any`; parse JSON as `unknown` and narrow.
- No multi-line inline handlers in JSX; use named `handleX` functions.
- CSS Modules next to each component; only `var(--...)` tokens from `src/styles/theme.css`, no raw colors, sizes or spacing. Sizes must scale under `data-text="large"`.
- Reusable logic goes in `src/hooks/useSomething.ts`.
- Code expiry 10 minutes (600 s). Lockout 15 minutes after 5 wrong codes (server-enforced; client only displays).
- Display name: trimmed, 2 to 20 characters, letters, numbers, spaces and `. ' -`.
- No em dashes or en dashes in copy, code or commits. Commits are single-line conventional commits, GPG signed.
- No code comments unless the logic is genuinely non-obvious.

## Review Focus

1. API unreachable (network error or 502 `auth_unavailable`) during send, verify or `/me`: the player sees a readable message and can retry, never a stuck "Checking" or blank screen. Tests in Tasks 5 and 8.
2. Autofill or paste delivering 6 digits fires completion more than once (StrictMode, autofill plus input event): exactly one `verifyCode` request per code. Tests in Tasks 3 and 5.
3. Pasted code with spaces, dashes or extra text (`"482 913"`, `"Code: 482913."`): digits are stripped and the first 6 used. Test in Task 3.
4. Phone sleeps during a lockout: the countdown is computed from `locked_until` on each tick, so it shows the true time left after waking, and never goes below 0:00. Test in Task 4.
5. Signed-in player removed from the allowlist (`/me` returns 403 `not_allowed`) or token rejected (401): the app signs out and lands on `/sign-in`, no loop. Test in Task 8.

---

### Task 1: Supabase client and typed API wrapper

**Files:**
- Modify: `web/package.json` (add `@supabase/supabase-js`)
- Modify: `web/.env.development`
- Create: `web/src/lib/supabase.ts`
- Create: `web/src/lib/api.ts`
- Test: `web/src/lib/api.test.ts`

**Interfaces:**
- Produces:
  - `supabase: SupabaseClient` from `src/lib/supabase.ts`, created with `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })`.
  - From `src/lib/api.ts`:
    ```ts
    export type TextSize = 'standard' | 'large' // re-export from hooks/useTextSize
    export interface Me { id: string; email: string; display_name: string | null; is_admin: boolean; text_size: TextSize; flagged_count: number | null }
    export interface SessionTokens { access_token: string; refresh_token: string; expires_in: number; expires_at: number }
    export type ApiErrorCode = 'not_allowed' | 'locked' | 'too_soon' | 'auth_unavailable' | 'expired' | 'wrong_code' | 'unauthenticated' | 'too_short' | 'invalid' | 'name_taken' | 'invalid_request' | 'network' | 'unknown'
    export interface ApiFailure { ok: false; status: number; error: ApiErrorCode; locked_until?: string; tries_left?: number }
    export type ApiResult<T> = { ok: true; data: T } | ApiFailure
    export const sendCode: (email: string) => Promise<ApiResult<null>>
    export const verifyCode: (email: string, code: string) => Promise<ApiResult<SessionTokens>>
    export const getMe: () => Promise<ApiResult<Me>>
    export const putDisplayName: (displayName: string) => Promise<ApiResult<Me>>
    ```

- [ ] **Step 1: Install and configure**

`npm install @supabase/supabase-js`. Add to `web/.env.development`: `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from npx supabase status>` (public by design, safe to commit).

- [ ] **Step 2: Write the failing tests** in `src/lib/api.test.ts`

Mock `./supabase` with `vi.mock('./supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }))`. Stub `fetch` and `VITE_API_URL=http://localhost:8000/` (trailing slash on purpose). Tests:
- `sendCode posts the email and returns ok on 204`: asserts `fetch` called with `'http://localhost:8000/auth/send-code'`, method `POST`, JSON body `{ email: 'a@b.c' }`, `Content-Type: application/json`; result `{ ok: true, data: null }`.
- `verifyCode returns the session tokens on 200`.
- `returns the error code and extras from the error body`: 401 `{ error: 'wrong_code', tries_left: 3 }` gives `{ ok: false, status: 401, error: 'wrong_code', tries_left: 3 }`; 423 with `locked_until` passes it through.
- `maps an unrecognized error body to unknown`: 500 with body `'oops'` (not JSON) gives `error: 'unknown'`.
- `maps a rejected fetch to network with status 0`.
- `getMe sends the bearer token from the current session`: `getSession` resolves `{ data: { session: { access_token: 'tok' } } }`; header `Authorization: Bearer tok`.
- `getMe returns unauthenticated without calling fetch when there is no session`.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/lib/api.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 4: Implement** `src/lib/supabase.ts` and `src/lib/api.ts`

One private `request<T>(path, init, auth: boolean): Promise<ApiResult<T>>`. Trim trailing slashes from `VITE_API_URL` (as `useApiHealth` does). 204 returns `data: null`. Narrow the error body: keep `error` only if it is one of the known codes, else `'unknown'`; copy `locked_until` (string) and `tries_left` (number) when present. Move the `TextSize` type so `api.ts` imports it from `../hooks/useTextSize`.

- [ ] **Step 5: Run tests, lint, typecheck.** Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/.env.development web/src/lib
git commit -S -m "feat: add supabase session client and typed api wrapper"
```

---

### Task 2: Shared form components

**Files:**
- Create: `web/src/components/Button.tsx`, `Button.module.css`
- Create: `web/src/components/TextField.tsx`, `TextField.module.css`
- Create: `web/src/components/FormError.tsx`, `FormError.module.css`
- Test: `web/src/components/TextField.test.tsx`

**Interfaces:**
- Produces (Settings in PR C reuses these):
  - `Button` with `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'link' }`. Primary is full width, `min-height: var(--tap-lg)`, forest fill; link is a text button with `min-height: var(--tap-min)`. Default `type="button"`.
  - `TextField` with `interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> { label: string; hint?: string; error?: string }`. Renders `<label>` tied to the input by `useId`; when `error` is set it replaces the hint, is linked through `aria-describedby`, and sets `aria-invalid="true"`.
  - `FormError` with `interface FormErrorProps { title: string; children?: ReactNode }`: the orange "!" box from 01b, 02c, 02d, 02e, `role="alert"`.

- [ ] **Step 1: Write the failing tests**: `TextField` `shows the hint when there is no error`, `shows the error instead of the hint and marks the input invalid` (asserts `toHaveAccessibleDescription(error)` and `toHaveAttribute('aria-invalid', 'true')`), `labels the input` (`getByLabelText('Your email')`).
- [ ] **Step 2: Run to verify they fail.** `npx vitest run src/components/TextField.test.tsx`
- [ ] **Step 3: Implement the three components** to the design file's styling.
- [ ] **Step 4: Run tests, lint, typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -S -m "feat: add shared button, text field and form error components"`

---

### Task 3: CodeInput

**Files:**
- Create: `web/src/components/CodeInput.tsx`, `CodeInput.module.css`
- Test: `web/src/components/CodeInput.test.tsx`

**Interfaces:**
- Produces: `CodeInput` with `interface CodeInputProps { value: string; onChange: (value: string) => void; onComplete: (code: string) => void; disabled?: boolean; invalid?: boolean }`. Controlled. One real `<input>` (`aria-label="6-digit code"`, `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength` not set so long pastes arrive whole) positioned transparently over six visual boxes (`aria-hidden`). Autofocuses.

- [ ] **Step 1: Write the failing tests** (render with a small stateful wrapper so `value` updates):
- `shows each typed digit in its own box`
- `strips non-digits and keeps the first six`: change to `'Code: 482 913.'` gives `onChange('482913')`.
- `calls onComplete once when the sixth digit arrives`: type `48291`, assert not called; type `3`, assert called once with `'482913'`.
- `accepts a full code pasted or autofilled in one change` (single `fireEvent.change` to `'482913'`): `onComplete` called once.
- `does not call onComplete again when the value is unchanged`: rerender with the same `'482913'` value; still called once.
- `marks boxes invalid` when `invalid` (assert a data attribute such as `data-invalid="true"` on the wrapper).

- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Call `onComplete` from the change handler (not an effect) when the cleaned value reaches length 6 and differs from the previous `value`.
- [ ] **Step 4: Run tests, lint, typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -S -m "feat: add six box code input"`

---

### Task 4: Lockout countdown

**Files:**
- Create: `web/src/hooks/useCountdown.ts`
- Create: `web/src/components/LockoutCountdown.tsx`, `LockoutCountdown.module.css`
- Test: `web/src/hooks/useCountdown.test.tsx`, `web/src/components/LockoutCountdown.test.tsx`

**Interfaces:**
- Produces:
  - `useCountdown(until: string): number`: whole seconds left until the ISO time, recomputed from `Date.now()` every second, floored at 0. Stops its interval at 0.
  - `formatCountdown(seconds: number): string` in the same file: `872 -> '14:32'`, `65 -> '1:05'`, `0 -> '0:00'`.
  - `LockoutCountdown` with `interface LockoutCountdownProps { lockedUntil: string; onRetry: () => void }`. While seconds > 0 renders a disabled primary `Button` "Try again in {mm:ss}". At 0 renders an enabled primary `Button` "Email me a new code" that calls `onRetry`.

- [ ] **Step 1: Write the failing tests** with `vi.useFakeTimers()` and `vi.setSystemTime`:
- `formatCountdown` cases above.
- `counts down each second`: until = now + 872 s gives 872, advance 1 s gives 871.
- `jumps to the true time left after a long pause`: set system time forward 600 s without running intervals, then advance 1 s; value is 271 (Review Focus 4).
- `never goes below zero`: until in the past gives 0.
- `LockoutCountdown shows a disabled button with the time left` (`'Try again in 14:32'`), and `enables Email me a new code when time is up` and clicking it calls `onRetry`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests, lint, typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -S -m "feat: add lockout countdown"`

---

### Task 5: useSignIn state machine

**Files:**
- Create: `web/src/hooks/useSignIn.ts`
- Test: `web/src/hooks/useSignIn.test.tsx`

**Interfaces:**
- Consumes: `sendCode`, `verifyCode`, `ApiFailure` (Task 1); `supabase.auth.setSession` (Task 1).
- Produces:
  ```ts
  export type EmailError = 'not_allowed' | 'invalid_email' | 'unavailable'
  export type CodeStatus = 'idle' | 'sending' | 'checking' | 'wrong' | 'expired' | 'locked' | 'too_soon' | 'unavailable'
  export type SignInState =
    | { step: 'email'; sending: boolean; error: EmailError | null }
    | { step: 'code'; email: string; status: CodeStatus; triesLeft: number | null; lockedUntil: string | null }
  export const PENDING_KEY = 'soul-search.pending-sign-in'
  export const useSignIn: (now?: () => number) => {
    state: SignInState
    submitEmail: (email: string) => Promise<void>
    submitCode: (code: string) => Promise<void>
    resendCode: () => Promise<void>
    useAnotherEmail: () => void
  }
  ```

Behavior (the spec's API tables mapped to states):
- `submitEmail`: trims and lowercases. 204 saves `{ email, codeSentAt: ISO }` to `localStorage[PENDING_KEY]` and moves to `code`/`idle`. 403 gives `not_allowed`. 422 gives `invalid_email`. 423 moves to `code`/`locked` with `lockedUntil`. 429 moves to `code`/`idle` (a code was sent recently). 502 or network gives `unavailable`.
- `submitCode`: ignored unless status is `idle`, `wrong`, `too_soon` or `unavailable` (so a second completion while `checking` sends nothing). Sets `checking`. 200 calls `supabase.auth.setSession({ access_token, refresh_token })` and removes `PENDING_KEY`. 401 gives `wrong` with `triesLeft`. 410 gives `expired`. 423 gives `locked` with `lockedUntil`. 502 or network gives `unavailable`.
- `resendCode`: sets `sending`, calls `sendCode(email)`. 204 resets to `idle` and refreshes `codeSentAt`. 429 gives `too_soon`. 423 gives `locked`. 502 or network gives `unavailable`.
- `useAnotherEmail`: removes `PENDING_KEY`, back to `email` with no error.
- Initial state: if `PENDING_KEY` holds a `codeSentAt` under 600 s old, start at `code`/`idle` for that email; otherwise `email`. All `localStorage` access wrapped in try/catch.

- [ ] **Step 1: Write the failing tests** (`renderHook`, `vi.mock('../lib/api')`, `vi.mock('../lib/supabase')`, `localStorage.clear()` in `beforeEach`). One test per bullet above, named for the case, for example:
- `moves to the code step and remembers the email when the code is sent` (asserts email `heathyr@example.com` from input `'  Heathyr@Example.com '` and the stored JSON).
- `shows not_allowed when the email is not on the list`
- `moves to the locked code state when sending while locked`
- `shows unavailable when the api cannot be reached` (send and verify both)
- `sets the session and clears the pending email on a right code`
- `shows wrong with tries left`, `shows expired`, `shows locked after the fifth wrong code`
- `sends only one verify request when the code is submitted twice while checking` (Review Focus 2): `verifyCode` returns a pending promise; call `submitCode` twice; expect one call.
- `shows too_soon when a new code is asked for too soon`
- `resumes at the code step when a code was sent under 10 minutes ago`, `starts at the email step when the pending code is older than 10 minutes` (inject `now`).
- `useAnotherEmail returns to the email step and forgets the email`
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** Keep state in `useState`; use a ref for the in-flight guard since state updates are async.
- [ ] **Step 4: Run tests, lint, typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -S -m "feat: add sign-in state hook"`

---

### Task 6: Sign-in and code screens

**Files:**
- Create: `web/src/screens/SignInScreen.tsx`, `SignInScreen.module.css`
- Create: `web/src/screens/CodeScreen.tsx`, `CodeScreen.module.css`
- Create: `web/src/screens/SignInPage.tsx`
- Test: `web/src/screens/SignInScreen.test.tsx`, `web/src/screens/CodeScreen.test.tsx`

**Interfaces:**
- Consumes: `useSignIn` and its types (Task 5); `Button`, `TextField`, `FormError` (Task 2); `CodeInput` (Task 3); `LockoutCountdown` (Task 4).
- Produces:
  - `SignInScreen` with `interface SignInScreenProps { sending: boolean; error: EmailError | null; onSubmit: (email: string) => void }`. Holds the email field in local state.
  - `CodeScreen` with `interface CodeScreenProps { state: Extract<SignInState, { step: 'code' }>; onSubmitCode: (code: string) => void; onResend: () => void; onUseAnotherEmail: () => void }`. Holds the code value in local state; clears it when status becomes `expired` or after a resend succeeds.
  - `SignInPage`: calls `useSignIn()` and renders one of the two screens. Used as the `/sign-in` route element in Task 8.

Exact copy (from the design file):
- 01: brand "Soul Search", tagline "A new Kia Soul challenge every week.", field label "Your email" (`type="email"`, `autoComplete="email"`), hint "We'll email you a 6-digit code. Type it in here to sign in. No password to remember.", button "Email me a code" (disabled while `sending` or until the trimmed value contains `@`), footnote "Soul Search is invite-only."
- 01b (`not_allowed`): `FormError` title "This email isn't on the list." body "Ask Matthew or Heathyr to add you, then try again."
- `invalid_email`: title "That doesn't look like an email address."
- `unavailable` (both screens): title "We couldn't reach Soul Search." body "Check your connection and try again."
- 02: kicker "Step 2 of 2", title "Check your email", "We sent a 6-digit code to **{email}**.", hint "The code works for 10 minutes. Check spam if you don't see it.", link "Use another email".
- 02b (`checking`): `CodeInput` disabled, text "Checking your code…" (`role="status"`).
- 02c (`wrong`): `CodeInput` invalid, `FormError` "That code isn't right." body "Check the email and try again. {n} tries left." ("1 try left" when n is 1), links "Send a new code" and "Use another email".
- 02d (`expired`): title "That code expired", no boxes, `FormError` "Codes only work for 10 minutes." body "Get a new one and we'll email it right away.", primary "Email me a new code", link "Use another email".
- 02e (`locked`): title "Too many tries", no boxes, `FormError` "Please wait 15 minutes." body "For safety, sign-in is paused after 5 wrong codes. Then ask for a new code.", `LockoutCountdown` (its retry calls `onResend`), link "Use another email".
- `too_soon`: `FormError` "A code is already on its way." body "Wait a minute before asking for another one."

- [ ] **Step 1: Write the failing tests** (screens are presentational, so pass props and spies):
- SignInScreen: `disables Email me a code until the email has an @`, `submits the typed email`, `shows the not-on-the-list error`, `shows the could-not-reach error`, `disables the button while sending`.
- CodeScreen: one test per status 02 to 02e plus `too_soon` and `unavailable`, asserting the copy above; `submits the code after the sixth digit`; `says 1 try left`; `calls onResend from Send a new code`; `calls onUseAnotherEmail`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement** the three files to the design file's layout. If `CodeScreen` passes ~150 lines, move the status-to-message mapping into `src/components/CodeStatusMessage.tsx`.
- [ ] **Step 4: Run tests, lint, typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -S -m "feat: add sign-in and code screens"`

---

### Task 7: Display name step

**Files:**
- Create: `web/src/lib/validateDisplayName.ts`
- Create: `web/src/hooks/useMeContext.ts`
- Create: `web/src/screens/WelcomeScreen.tsx`, `WelcomeScreen.module.css`
- Test: `web/src/lib/validateDisplayName.test.ts`, `web/src/screens/WelcomeScreen.test.tsx`

**Interfaces:**
- Consumes: `putDisplayName`, `Me` (Task 1); `Button`, `TextField`, `FormError` (Task 2).
- Produces:
  - `validateDisplayName(raw: string): { ok: true; name: string } | { ok: false; error: 'too_short' | 'too_long' | 'invalid' }`, mirroring `api/app/me/display_name.py` (pattern `^[A-Za-z0-9 .'-]+$` after trim; under 2 is `too_short`, over 20 is `too_long`).
  - `interface MeOutletContext { me: Me; setMe: (me: Me) => void }` and `useMeContext(): MeOutletContext` (wraps `useOutletContext`). Task 8's `RequireAuth` provides it.
  - `WelcomeScreen`: no props. On submit validates locally, then `putDisplayName(name)`; on 200 calls `setMe(data)` (the redirect to `/` happens in `RequireAuth`).

Copy (03 to 03c): kicker "Welcome!", title "What should we call you?", lead "This is how other players see you on the leaderboard.", label "Your name", hint "2 to 20 characters. You can change it later in Settings.", button "Let's go".
Errors (shown in the `TextField` error slot after submit, cleared on edit): `too_short` "Names need at least 2 characters." `too_long` "Names can be up to 20 characters." `invalid` "Use only letters, numbers, spaces and . ' -" `name_taken` "Someone already goes by “{name}”. Try adding a last initial, like “{name} K.”" Network or other failure: `FormError` "We couldn't reach Soul Search." "Check your connection and try again."

- [ ] **Step 1: Write the failing tests**:
- `validateDisplayName`: `'  Mom K. '` ok as `'Mom K.'`; `"O'Neil-Smith"` ok; `'H'` too_short; `'   '` too_short; 21 chars too_long; `'Mom!'` invalid; `'Zoë'` invalid (server pattern is ASCII).
- WelcomeScreen (render under `createMemoryRouter` with a parent route element `<Outlet context={{ me, setMe }} />`): `saves the trimmed name and updates me`; `shows too short without calling the api`; `shows the name taken message with the typed name` (409); `shows the could-not-reach error on network failure`; `disables Let's go while saving`; `clears the error when the name is edited`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests, lint, typecheck.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -S -m "feat: add first sign-in display name step"`

---

### Task 8: Session, RequireAuth and routes

**Files:**
- Create: `web/src/hooks/useSession.ts`, `web/src/hooks/useMe.ts`
- Create: `web/src/components/RequireAuth.tsx`, `RequireAuth.module.css`
- Create: `web/src/components/RedirectIfSignedIn.tsx`
- Modify: `web/src/routes.tsx`, `web/src/components/AppShell.tsx` (remove `useTextSize('standard')`)
- Test: `web/src/components/RequireAuth.test.tsx`, modify `web/src/routes.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 1), `getMe`/`Me` (Task 1), `MeOutletContext` (Task 7), `SignInPage` (Task 6), `WelcomeScreen` (Task 7), `useTextSize`.
- Produces:
  - `useSession(): { status: 'loading' } | { status: 'signed_out' } | { status: 'signed_in'; session: Session }`, subscribed through `supabase.auth.onAuthStateChange` (its `INITIAL_SESSION` event ends `loading`), unsubscribing on unmount.
  - `useMe(enabled: boolean): { status: 'loading' | 'ready' | 'error'; me: Me | null; error: ApiErrorCode | null; setMe: (me: Me) => void; retry: () => void }`.
  - `RequireAuth`: loading session or me renders an empty shell. Signed out navigates to `/sign-in` (replace). `/me` error `not_allowed` or `unauthenticated` calls `supabase.auth.signOut()`. Other `/me` errors render `FormError` "We couldn't reach Soul Search." with a "Try again" `Button` calling `retry`. `display_name === null` and not on `/welcome` navigates to `/welcome`; a name set while on `/welcome` navigates to `/`. Calls `useTextSize(me?.text_size ?? 'standard')`. Renders `<Outlet context={{ me, setMe }} />`.
  - `RedirectIfSignedIn`: wraps `/sign-in`; a signed-in session navigates to `/`.
  - Routes:
    ```
    /sign-in        RedirectIfSignedIn > SignInPage
    RequireAuth (pathless)
      /welcome      WelcomeScreen
      /             AppShell > (index TakePhoto, sightings, scores)
    ```

- [ ] **Step 1: Write the failing tests** in `RequireAuth.test.tsx` (`vi.mock('../hooks/useSession')`, `vi.mock('../lib/api')`, `vi.mock('../lib/supabase')`, memory router with the real `routes`):
- `sends a signed-out player to sign in`
- `sends a player without a display name to welcome`
- `shows the app to a player with a name`
- `leaves welcome for the app once the name is saved`
- `signs out when the player is no longer allowed` (403 `not_allowed`; asserts `signOut` called) and the same for 401 `unauthenticated` (Review Focus 5)
- `shows try again when me cannot be loaded and retries` (network error, then success after clicking "Try again"; Review Focus 1)
- `applies the player's large text setting` (`document.documentElement.dataset.text === 'large'`)
- `sends a signed-in player away from sign in`
- Update `routes.test.tsx`: mock a signed-in session and a named `me` so the existing tab tests keep passing.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement**, then remove the now-unused `useTextSize('standard')` call from `AppShell`.
- [ ] **Step 4: Run tests, lint, typecheck.** Expected: PASS.
- [ ] **Step 5: Manual check against local Supabase**: `make db-start`, start api and web, sign in as `bob@example.test` (code from Mailpit at `http://127.0.0.1:54324`), set a name, reload: still signed in. Try an unknown email, a wrong code, and reload during the code step (returns to step 2).
- [ ] **Step 6: Commit** `git commit -S -m "feat: gate the app behind sign-in"`

---

### Task 9: Docs and env

**Files:**
- Modify: `README.md` (Environments table and Netlify setup)
- Modify: `docs/architecture.md` only if it does not already show the browser storing the session through supabase-js after FastAPI verifies the code.

- [ ] **Step 1:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` rows (app `web`, local value in `web/.env.development`, staging and production set in the Netlify dashboard) to the README Environments table.
- [ ] **Step 2:** Run the full suite once more: `npm run lint && npm run typecheck && npm test && npm run format:check && npm run build`. Expected: all pass.
- [ ] **Step 3: Commit** `git commit -S -m "docs: document web supabase env vars"`
