# Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Scores tab leaderboard (This week | All time) backed by a new `GET /leaderboard` endpoint, with live refresh and shimmer, empty and error states.

**Architecture:** One shared SQL ranking (participants only) feeds both `/leaderboard` and the existing `/me/standing`. The web screen loads both scopes through `useApiResource`, refreshes them quietly with a new `useAutoRefresh` hook, and is built from small shared components the Sightings log will reuse.

**Tech Stack:** FastAPI + psycopg (Python 3.12, uv, pytest), Postgres via local Supabase, React 19 + TypeScript + Vite, CSS Modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-leaderboard-design.md`

## Global Constraints

- React: function components, named exports, one component per file with a matching `ComponentName.module.css`, props typed as `ComponentNameProps`, props alphabetized in interfaces, destructuring and JSX (perfectionist lint enforces this).
- No multi-line inline JSX handlers; use named `handleX` functions.
- CSS references only `var(--...)` tokens. No raw colors, sizes or spacing. Sizes that should scale use type or tap tokens so large-text mode works.
- No `any` in TypeScript.
- No em dashes or en dashes anywhere, including copy. Week ranges use a hyphen ("Nov 9-15"), as `weekRange` already does.
- Kicker strings are written in normal case; `ScreenTitle` uppercases them in CSS.
- Code comments only for non-obvious logic.
- Every commit is GPG signed (`git commit -S`), one-line conventional message, no body.
- After every task: `make lint` and the relevant tests pass. DB tests need `make db-start` first and run with `make db-api-test`.

## Review Focus

- A player with an adjustment but no sightings: listed on the board and ranked on Home (Task 1, `test_standing_ranks_adjustment_only_player`).
- A background refresh that fails after data loaded: the list stays, no error box appears (Task 4, `keeps old data when a refresh fails`).
- The app sent to the background: no polling while hidden, one refetch on return (Task 5).
- A long display name (20 characters) at 390px in large-text mode: name truncates with an ellipsis, score stays visible (Task 8, CSS `min-width: 0` and `text-overflow: ellipsis`; checked in the Task 9 screenshot).
- Ties at the top: every rank-1 row gets the 1st-place style, and the you-row style still wins (Task 8, `LeaderboardRow` tests).

---

### Task 1: Shared participant ranking, `week_at`, and `standing()` on the new rule

**Files:**
- Modify: `api/app/sightings/repo.py`
- Test: `api/tests/sightings/test_sightings_repo_db.py`

**Interfaces:**
- Produces: `PgSightingsRepo.week_at(at: datetime) -> Period` (always `kind="week"`); module function `_ranked_cte(where: str) -> str` returning SQL for CTEs ending in `ranked(id, display_name, points, count, rank)`, where `where` is a SQL predicate on `sightings`/`score_adjustments` rows that may use the `%(period)s` param. `SightingsRepo` Protocol gains `week_at`.

- [ ] **Step 1: Write the failing tests**

```python
def test_week_at_ignores_running_challenge(db_conn):
    repo = PgSightingsRepo(db_conn)
    add_challenge(db_conn, {"regular": 1, "special": 2, "false_call": -1, "bonuses": {}})
    week = repo.week_at(AT)
    assert (week.kind, week.starts_at) == ("week", WEEK_START)


def test_standing_ranks_adjustment_only_player(db_conn):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    add_sighting(db_conn, ALICE, week.id, points=3)
    add_adjustment(db_conn, BOB, week.id, change=1)
    standing = repo.standing(BOB, week)
    assert (standing.points, standing.count, standing.rank) == (1, 0, 2)


def test_standing_ranks_false_call_player_among_participants_only(db_conn):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    add_sighting(db_conn, ALICE, week.id)
    add_sighting(db_conn, BOB, week.id, points=-1)
    assert repo.standing(BOB, week).rank == 2
```

Add helper `add_adjustment(conn, player_id, period_id, *, change, kind="week")` that inserts into `score_adjustments` with `admin_id=ALICE`, `reason='test'`. Refactor the inline insert in `test_standing_ranks_players_and_counts_adjustments` to use it. `test_standing_without_sightings_has_no_rank` must keep passing unchanged.

- [ ] **Step 2: Run to verify they fail**

Run: `cd api && uv run pytest -m db tests/sightings/test_sightings_repo_db.py -v`
Expected: the three new tests FAIL (`week_at` missing; Bob's ranks come out higher because non-players count).

- [ ] **Step 3: Implement**

Split the week lookup out of `period_at()` into `week_at()`. Add `_ranked_cte(where)`:

```sql
s as (
  select player_id, sum(points) as points,
    count(*) filter (where status <> 'false_call') as count
  from public.sightings where {where} group by player_id
),
a as (
  select player_id, sum(change) as points
  from public.score_adjustments where {where} group by player_id
),
totals as (
  select p.id, p.display_name,
    coalesce(s.points, 0) + coalesce(a.points, 0) as points,
    coalesce(s.count, 0) as count
  from public.players p
  left join s on s.player_id = p.id
  left join a on a.player_id = p.id
  where s.player_id is not null or a.player_id is not null
),
ranked as (select *, rank() over (order by points desc) as rank from totals)
```

Rewrite `standing()` to use it with `where = f"{column} = %(period)s"`. A player missing from `ranked` gets points 0, count 0, rank None, next_rank None, behind None. Drop the old "rank only if they have a sighting" rule; rank comes straight from `ranked`. `total_players` stays `select count(*) from public.players`; `last_photo_path` query is unchanged.

- [ ] **Step 4: Run the whole repo DB file**

Run: `cd api && uv run pytest -m db tests/sightings/test_sightings_repo_db.py -v`
Expected: all PASS, including the existing standing tests.

- [ ] **Step 5: Commit**

```bash
git add api/app/sightings/repo.py api/tests/sightings/test_sightings_repo_db.py
git commit -S -m "refactor: rank standings among players who played"
```

### Task 2: `leaderboard()` repo method

**Files:**
- Modify: `api/app/sightings/repo.py`
- Test: `api/tests/sightings/test_sightings_repo_db.py`

**Interfaces:**
- Consumes: `_ranked_cte`, `week_at` from Task 1.
- Produces:
  ```python
  @dataclass(frozen=True)
  class LeaderboardEntry:
      player_id: UUID
      display_name: str
      points: int
      count: int
      rank: int

  @dataclass(frozen=True)
  class Leaderboard:
      rows: tuple[LeaderboardEntry, ...]
      total_players: int
  ```
  `SightingsRepo.leaderboard(week: Period | None) -> Leaderboard`. `None` means all time.

- [ ] **Step 1: Write the failing tests**

```python
def test_leaderboard_week_excludes_challenge_points(db_conn):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    challenge_id = add_challenge(db_conn, {"regular": 1, "special": 2, "false_call": -1, "bonuses": {}})
    add_sighting(db_conn, ALICE, week.id)
    add_sighting(db_conn, BOB, challenge_id, kind="challenge", points=5)
    add_adjustment(db_conn, BOB, challenge_id, change=2, kind="challenge")
    board = repo.leaderboard(week)
    assert [(r.player_id, r.points, r.rank) for r in board.rows] == [(ALICE, 1, 1)]


def test_leaderboard_all_time_includes_weeks_challenges_and_adjustments(db_conn):
    # same setup: Alice 1 week point; Bob 5 challenge + 2 challenge adjustment
    # expect [(BOB, 7, 1), (ALICE, 1, 2)]


def test_leaderboard_ties_share_rank_and_sort_by_name(db_conn):
    # Alice and Bob 1 point each -> ranks [1, 1], order by lower(display_name)


def test_leaderboard_false_call_lowers_points_not_count(db_conn):
    # Bob: one counted +1, one false_call -1 -> points 0, count 1


def test_leaderboard_lists_only_participants_and_counts_everyone(db_conn):
    # only Alice plays -> rows == [ALICE]; total_players >= 3


def test_leaderboard_false_call_only_player_is_last(db_conn):
    # Alice +1, Bob -1 -> [(ALICE, 1), (BOB, 2)] by rank


def test_leaderboard_rank_matches_standing(db_conn):
    # Alice 3, Bob 1, Carol 1; for each player: standing(p, week).rank == row.rank
```

Name order uses the seeded display names for ALICE, BOB, CAROL; read them from `players` in the test rather than hard-coding if the seed names do not sort as A, B, C.

- [ ] **Step 2: Run to verify they fail**

Run: `cd api && uv run pytest -m db tests/sightings/test_sightings_repo_db.py -k leaderboard -v`
Expected: FAIL with `AttributeError: 'PgSightingsRepo' object has no attribute 'leaderboard'`.

- [ ] **Step 3: Implement `leaderboard(week: Period | None) -> Leaderboard`**

`where` is `"week_id = %(period)s"` for a week and `"true"` for all time. Select from `ranked` ordered by `rank, lower(display_name)`, plus `total_players` as in `standing()`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd api && uv run pytest -m db tests/sightings/test_sightings_repo_db.py -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/sightings/repo.py api/tests/sightings/test_sightings_repo_db.py
git commit -S -m "feat: add weekly and all-time leaderboard query"
```

### Task 3: `GET /leaderboard` route

**Files:**
- Modify: `api/app/sightings/routes.py`, `api/tests/fakes.py`
- Test: `api/tests/sightings/test_sightings_routes.py`

**Interfaces:**
- Consumes: `week_at`, `leaderboard`, `Leaderboard`, `LeaderboardEntry` from Tasks 1 and 2.
- Produces: `GET /leaderboard?scope=week|all` (required) returning
  `LeaderboardOut { scope: Literal["week","all"], starts_at: datetime | None, ends_at: datetime | None, total_players: int, rows: list[LeaderboardRowOut] }` and
  `LeaderboardRowOut { player_id: UUID, display_name: str, points: int, count: int, rank: int, is_me: bool }`.
- Fake: `FakeSightingsRepo.week: Period | None = None` (`week_at` returns `self.week or self.period`), `FakeSightingsRepo.leaderboards: dict[UUID | None, Leaderboard]` keyed by week id or `None`; `leaderboard(week)` returns the entry or `Leaderboard(rows=(), total_players=3)`.

- [ ] **Step 1: Write the failing tests**

- `test_leaderboard_week_returns_rows_and_bounds`: fake board for `WEEK.id` with Alice rank 1, Bob rank 2. Response 200; `starts_at`/`ends_at` equal `WEEK`'s; `rows[1]["is_me"] is True`, `rows[0]["is_me"] is False`.
- `test_leaderboard_week_uses_week_even_during_challenge`: `repo.period` is a challenge, `repo.week = WEEK`; response bounds are `WEEK`'s.
- `test_leaderboard_all_has_no_bounds`: `scope=all` returns `starts_at is None and ends_at is None` and the `None`-keyed rows.
- `test_leaderboard_rejects_unknown_scope`: `scope=month` gives 422 `{"error": "invalid_request"}`; missing scope gives the same.
- `test_leaderboard_requires_sign_in`: follow the existing unauthenticated pattern in this file; expect 401.

- [ ] **Step 2: Run to verify they fail**

Run: `cd api && uv run pytest tests/sightings/test_sightings_routes.py -k leaderboard -v`
Expected: FAIL with 404.

- [ ] **Step 3: Implement the route**

`scope: Annotated[Literal["week", "all"], Query()]`. For `week`, call `repo.week_at(now)` and pass it; for `all`, pass `None`. `is_me` is `row.player_id == user.id`.

- [ ] **Step 4: Run all API tests and lint**

Run: `cd api && uv run pytest && uv run ruff check . && uv run ruff format --check .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/sightings/routes.py api/tests/fakes.py api/tests/sightings/test_sightings_routes.py
git commit -S -m "feat: add leaderboard endpoint"
```

### Task 4: Web client and quiet refresh in `useApiResource`

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/hooks/useApiResource.ts`
- Test: `web/src/lib/api.test.ts`, `web/src/hooks/useApiResource.test.tsx`

**Interfaces:**
- Produces in `lib/api.ts`:
  ```ts
  export type LeaderboardScope = 'all' | 'week'
  export interface LeaderboardEntry { count: number; display_name: string; is_me: boolean; player_id: string; points: number; rank: number }
  export interface Leaderboard { ends_at: string | null; rows: LeaderboardEntry[]; scope: LeaderboardScope; starts_at: string | null; total_players: number }
  export const getLeaderboard: (scope: LeaderboardScope) => Promise<ApiResult<Leaderboard>>
  ```
- Produces: `ApiResource<T>` gains `refresh: () => void`.

- [ ] **Step 1: Write the failing tests**

- `api.test.ts`, `getLeaderboard calls /leaderboard with the scope`: follow the file's existing fetch-mock pattern; assert the URL ends with `/leaderboard?scope=all` and method GET.
- `useApiResource.test.tsx`:
  - `keeps showing data while a refresh loads`: after ready, `act(() => result.current.refresh())`; status stays `'ready'` and data is unchanged until the new result lands, then data updates.
  - `keeps old data when a refresh fails`: second load resolves `failed`; status stays `'ready'`, data unchanged, `error` null.
  - `refresh after a failed first load behaves like retry`: first load fails, `refresh()` moves to `'loading'` then `'ready'`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/lib/api.test.ts src/hooks/useApiResource.test.tsx`
Expected: FAIL (`getLeaderboard` / `refresh` not a function).

- [ ] **Step 3: Implement**

Keep the last successful data in state alongside the attempt result. `retry()` keeps today's behavior (drops to loading). `refresh()` triggers a reload but, while it is pending or if it fails, returns the last successful data with status `'ready'`. With no successful data yet, `refresh()` behaves like `retry()`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npm test`
Expected: PASS (existing `useApiResource` tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api.ts web/src/lib/api.test.ts web/src/hooks/useApiResource.ts web/src/hooks/useApiResource.test.tsx
git commit -S -m "feat: add leaderboard client and quiet resource refresh"
```

### Task 5: `useAutoRefresh` hook

**Files:**
- Create: `web/src/hooks/useAutoRefresh.ts`
- Test: `web/src/hooks/useAutoRefresh.test.tsx`

**Interfaces:**
- Produces: `export const useAutoRefresh = (refresh: () => void, intervalMs = 30_000): void`

- [ ] **Step 1: Write the failing tests** (fake timers; set `document.visibilityState` with `Object.defineProperty(document, 'visibilityState', { configurable: true, value })`)

- `calls refresh every interval while visible`: advance 30_000 twice, expect 2 calls.
- `does not call refresh while hidden`: set hidden, dispatch `visibilitychange`, advance 90_000, expect 0 calls.
- `refreshes once when the app becomes visible`: hidden, then visible + `visibilitychange`, expect 1 call immediately.
- `uses the latest refresh callback`: rerender with a new function; the next tick calls the new one only.
- `stops after unmount`: unmount, advance 60_000, expect 0 calls.

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/hooks/useAutoRefresh.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Store `refresh` in a ref. One effect: start an interval only while visible; on `visibilitychange` to visible call refresh and restart the interval; to hidden clear it. Clean up listener and interval on unmount.

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npx vitest run src/hooks/useAutoRefresh.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useAutoRefresh.ts web/src/hooks/useAutoRefresh.test.tsx
git commit -S -m "feat: add auto refresh hook for live lists"
```

### Task 6: `SegmentedControl` and `PlayerAvatar`

**Files:**
- Create: `web/src/components/SegmentedControl.tsx`, `.module.css`, `.test.tsx`
- Create: `web/src/components/PlayerAvatar.tsx`, `.module.css`, `.test.tsx`
- Create: `web/src/lib/avatarTone.ts`, `web/src/lib/avatarTone.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SegmentedControlOption<T extends string> { label: string; value: T }
  export interface SegmentedControlProps<T extends string> { label: string; onChange: (value: T) => void; options: SegmentedControlOption<T>[]; value: T }
  export const SegmentedControl: <T extends string>(props: SegmentedControlProps<T>) => JSX.Element

  export type AvatarTone = 'forest' | 'ink' | 'inkMuted' | 'orange'
  export const avatarTone: (id: string) => AvatarTone

  export interface PlayerAvatarProps { id: string; name: string }
  export const PlayerAvatar: (props: PlayerAvatarProps) => JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

- `SegmentedControl`: renders a `role="group"` named by `label`; each option is a `button` with `aria-pressed` true only for `value`; clicking the other option calls `onChange('all')`; options are reachable by Tab (native buttons).
- `avatarTone`: same id gives the same tone; across ids `'a'`, `'b'`, `'c'`, `'d'` all four tones appear (pick ids that make this true for your hash and assert explicitly).
- `PlayerAvatar`: renders the initial via `initialOf(name)`, is `aria-hidden`, and carries a class for its tone.

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/components/SegmentedControl.test.tsx src/components/PlayerAvatar.test.tsx src/lib/avatarTone.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`avatarTone`: sum of char codes mod 4 over `['forest', 'orange', 'inkMuted', 'ink']`. Segmented control styles from the design README "Segmented control" (track `--c-cream-deep`, radius `--r-md`, padding `--s-1`, segment min-height `--tap-min`, selected `--c-surface` with forest text). Avatar 40px (express with tokens, e.g. `calc(var(--s-6) + var(--s-2))`), serif initial, `--c-on-dark` text on the tone background.

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npm test && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SegmentedControl.* web/src/components/PlayerAvatar.* web/src/lib/avatarTone.*
git commit -S -m "feat: add segmented control and player avatar"
```

### Task 7: `EmptyState` and `LoadError`, with Home switched over

**Files:**
- Create: `web/src/components/EmptyState.tsx`, `.module.css`, `.test.tsx`
- Create: `web/src/components/LoadError.tsx`, `.module.css`, `.test.tsx`
- Modify: `web/src/screens/TakePhotoScreen.tsx`, `web/src/screens/TakePhotoScreen.module.css`

**Interfaces:**
- Produces:
  ```ts
  export interface EmptyStateProps { body: string; title: string }
  export interface LoadErrorProps { onRetry: () => void; thing: string }
  ```
  `LoadError` renders `FormError` titled `Couldn't load ${thing}` with body "Check your Wi-Fi or signal, then try again. Your photos are safe." and a primary `Button` "Try again". `EmptyState` renders the dashed gold circle with a serif "S" (`aria-hidden`), an `h2` title, the body, and a `Link` to `/capture` labeled "Take a photo".

- [ ] **Step 1: Write the failing tests**

- `LoadError`: alert text "Couldn't load the scores"; clicking "Try again" calls `onRetry` once.
- `EmptyState`: heading with the title; body text; link "Take a photo" has `href="/capture"` (render inside a memory router).
- `TakePhotoScreen.test.tsx`: existing error tests still pass with title "Couldn't load your points".

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/components/EmptyState.test.tsx src/components/LoadError.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement both components and replace Home's inline error block with `<LoadError onRetry={handleRetry} thing="your points" />`**

Remove the now-unused `.error` rule from `TakePhotoScreen.module.css` if `LoadError` owns that layout.

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npm test && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/EmptyState.* web/src/components/LoadError.* web/src/screens/TakePhotoScreen.*
git commit -S -m "feat: add shared empty and load error states"
```

### Task 8: `LeaderboardRow` and `LeaderboardPlaceholder`

**Files:**
- Create: `web/src/components/LeaderboardRow.tsx`, `.module.css`, `.test.tsx`
- Create: `web/src/components/LeaderboardPlaceholder.tsx`, `.module.css`

**Interfaces:**
- Consumes: `LeaderboardEntry` (Task 4), `PlayerAvatar` (Task 6), `Shimmer`.
- Produces: `LeaderboardRowProps { entry: LeaderboardEntry }`; `LeaderboardPlaceholder` takes no props.

- [ ] **Step 1: Write the failing tests**

- Renders rank, name, "12 Souls" and points; `count: 1` renders "1 Soul".
- `is_me` row shows "Mom (you)" and has `data-variant="me"`.
- Rank 1, not me: `data-variant="first"`. Rank 1 and me: `data-variant="me"`. Rank 1 tie (two rows) both `"first"`.
- Others: `data-variant="default"`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/components/LeaderboardRow.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Row is an `li`. Styles from the design README Leaderboard section, via tokens: min-height `--tap-min`, radius `--r-md`, rank serif `--t-h3` ink-muted, name `--t-body` 700 with `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, souls line `--t-small` ink-muted, score serif `--t-h2` forest. Variants: `me` forest-tint bg + 2px forest border; `first` gold-soft bg + 2px gold border; `default` surface bg + transparent border. Placeholder: `aria-busy="true"`, `aria-label="Loading the scores"`, six rows in the same layout with `Shimmer` blocks for rank, avatar, name, souls and score.

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npm test && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/LeaderboardRow.* web/src/components/LeaderboardPlaceholder.*
git commit -S -m "feat: add leaderboard row and loading placeholder"
```

### Task 9: `ScoresScreen`

**Files:**
- Create: `web/src/lib/leaderboardCopy.ts`, `web/src/lib/leaderboardCopy.test.ts`
- Modify: `web/src/screens/ScoresScreen.tsx`
- Create: `web/src/screens/ScoresScreen.module.css`, `web/src/screens/ScoresScreen.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4 to 8; `weekRange` from `lib/homeCopy`.
- Produces: `leaderboardKicker(board: Leaderboard): string`.

- [ ] **Step 1: Write the failing tests**

- `leaderboardCopy`:
  - week board `starts_at: 2026-11-09T08:00:00Z`, `ends_at: 2026-11-16T08:00:00Z`, 23 players gives `"Nov 9-15 · 23 players · Resets Monday"`.
  - all-time with 1 player gives `"Since you joined · 1 player"`.
- `ScoresScreen` (mock `getLeaderboard`, render in a memory router):
  - first load shows the "Loading the scores" busy region.
  - ready week board shows rows and the week kicker; title "Leaderboard".
  - tapping "All time" shows the all-time rows and kicker; tapping "This week" shows the week rows again without a loading state.
  - empty week: "No scores yet this week" and "Nobody has spotted a Soul since Monday. The first photo puts you on top."
  - empty all time: "No scores yet" and "The first photo puts you on top."
  - error: "Couldn't load the scores"; "Try again" calls `getLeaderboard` again and then shows rows.
  - while loading, kicker reads "This week" / "All time".

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run src/lib/leaderboardCopy.test.ts src/screens/ScoresScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Module-level `loadWeek = () => getLeaderboard('week')` and `loadAll = () => getLeaderboard('all')`, each through `useApiResource`, so both load on mount and switching is instant. `useAutoRefresh` calls `refresh()` on both. Local state `scope: LeaderboardScope`, default `'week'`. Render `ScreenTitle` (kicker from `leaderboardKicker` when data is present), `SegmentedControl` labeled "Leaderboard period", then placeholder, `LoadError thing="the scores"`, `EmptyState`, or an `ol` of `LeaderboardRow`. Screen scrolls within the app shell.

- [ ] **Step 4: Run all checks**

Run: `make lint && make test && make db-api-test`
Expected: PASS.

- [ ] **Step 5: Visual check at 390px, standard and large text**

Run the app (`make db-start`, `make api`, `make web`), sign in as a seed player, add a few sightings, and take Playwright screenshots of the Scores tab at 390x844, deviceScaleFactor 2, with and without `data-text="large"` on `<html>`, including a 20-character name. Confirm names truncate and scores stay visible.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/leaderboardCopy.* web/src/screens/ScoresScreen.*
git commit -S -m "feat: show the weekly and all-time leaderboard"
```
