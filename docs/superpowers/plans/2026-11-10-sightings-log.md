# Sightings Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Sightings tab (Everyone | Just mine, grouped by day, status chips) backed by a new `GET /sightings` endpoint, with upload-time thumbnails, live refresh, local "Waiting to send" cards, and shimmer, empty and error states.

**Architecture:** `clean_photo` also makes a 480px thumbnail that the post route stores next to the photo. A new repo query returns the current week's sightings with player names, and the route signs thumbnails in one batch call, falling back to the full photo. The web screen follows the Scores pattern (`useApiResource` per segment plus `useAutoRefresh`) and merges in this phone's upload queue through a new `useQueuedSightings` hook.

**Tech Stack:** FastAPI + psycopg + Pillow (Python 3.12, uv, pytest), Postgres via local Supabase, Supabase Storage REST, React 19 + TypeScript + Vite, CSS Modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-sightings-log-design.md`

## Global Constraints

- React: function components, named exports, one component per file with a matching `ComponentName.module.css`, props typed as `ComponentNameProps`, props alphabetized in interfaces, destructuring and JSX (perfectionist lint enforces this).
- No multi-line inline JSX handlers; use named `handleX` functions.
- CSS references only `var(--...)` tokens. No raw colors, sizes or spacing. Sizes that should scale use type or tap tokens so large-text mode works.
- No `any` in TypeScript.
- No em dashes or en dashes anywhere, including copy. The false-call chip uses the minus sign U+2212 ("−1"), as the design does.
- Kicker strings are written in normal case; `ScreenTitle` uppercases them in CSS.
- All dates and day groups are in `America/Los_Angeles`.
- `verification_notes` is never returned by `GET /sightings`.
- Code comments only for non-obvious logic.
- Every commit is GPG signed (`git commit -S`), one-line conventional message, no body.
- After every task: `make lint` and the relevant tests pass. DB tests need `make db-start` first and run with `make db-api-test`.

## Review Focus

- A photo sent before this change has no thumbnail: its card still shows the full photo (Task 4, `test_sightings_falls_back_to_full_photo_without_thumbnail`).
- A sighting that was just sent but is still in the queue when the log loads: shown once, as the server version (Task 9, `shows a sent sighting once even while it is still queued`).
- A sighting at 11:30 PM Pacific on Sunday (Monday in UTC): grouped under Sunday (Task 6, `groups by Pacific day, not UTC`).
- Storage down while the list loads: cards still render with an empty photo box, no error state (Task 4, `test_sightings_still_load_when_storage_is_down`; Task 8, `renders without a photo url`).
- A special claim with three categories and a 20-character name at 390px in large-text mode: the claim line wraps, the name truncates, the chip stays on screen (Task 8 CSS; checked in the Task 9 screenshot).

---

### Task 1: Thumbnail in `clean_photo`

**Files:**
- Modify: `api/app/sightings/photo_meta.py`
- Test: `api/tests/sightings/test_photo_meta.py`

**Interfaces:**
- Produces: `CleanPhoto.thumbnail: bytes` (JPEG, longest side `THUMB_SIZE = 480`, quality `THUMB_QUALITY = 80`, upright after EXIF transpose). Photos already smaller than 480 are not upscaled.

- [ ] **Step 1: Write the failing tests**

```python
def test_clean_photo_makes_a_small_upright_thumbnail():
    cleaned = clean_photo(jpeg(width=4000, height=3000, orientation=6))
    thumb = Image.open(io.BytesIO(cleaned.thumbnail))
    assert thumb.format == "JPEG"
    assert thumb.size == (360, 480)

def test_clean_photo_does_not_upscale_small_thumbnails():
    cleaned = clean_photo(jpeg(width=300, height=200))
    assert Image.open(io.BytesIO(cleaned.thumbnail)).size == (300, 200)
```

Use the existing `jpeg()` helper in `api/tests/sightings/photos.py`; extend it with `width`, `height` or `orientation` keyword arguments only if it lacks them.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd api && uv run pytest tests/sightings/test_photo_meta.py -v`
Expected: FAIL with `AttributeError: 'CleanPhoto' object has no attribute 'thumbnail'`

- [ ] **Step 3: Add `thumbnail` to `CleanPhoto` and build it from the upright image with `Image.thumbnail((THUMB_SIZE, THUMB_SIZE))` on a copy**

- [ ] **Step 4: Run the photo tests and the route tests (constructors of `CleanPhoto` may need the new field)**

Run: `cd api && uv run pytest tests/sightings -v -k "not db"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/sightings/photo_meta.py api/tests/sightings
git commit -S -m "feat: make a small thumbnail of every sighting photo"
```

### Task 2: Store the thumbnail on upload

**Files:**
- Modify: `api/app/sightings/photo_store.py`, `api/app/sightings/routes.py` (post route, around `store.upload(path, cleaned.data)`)
- Test: `api/tests/sightings/test_photo_store.py`, `api/tests/sightings/test_sightings_routes.py`

**Interfaces:**
- Consumes: `CleanPhoto.thumbnail` (Task 1)
- Produces: `thumb_path(photo_path: str) -> str` in `photo_store.py`: `"{player}/{id}.jpg"` becomes `"{player}/{id}.thumb.jpg"`.

- [ ] **Step 1: Write the failing tests**

```python
def test_thumb_path_sits_next_to_the_photo():
    assert thumb_path("p1/abc.jpg") == "p1/abc.thumb.jpg"

def test_post_uploads_photo_and_thumbnail(harness: Harness):
    # post a regular sighting as in test_post_regular_sighting_uploads_and_scores
    assert set(harness.store.uploads) == {f"{USER_ID}/{SIGHTING_ID}.jpg", f"{USER_ID}/{SIGHTING_ID}.thumb.jpg"}
```

Match the existing fixture names in `test_sightings_routes.py`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd api && uv run pytest tests/sightings/test_photo_store.py tests/sightings/test_sightings_routes.py -v`
Expected: FAIL on the two new tests

- [ ] **Step 3: Add `thumb_path` and upload the thumbnail right after the photo in `post_sighting`**

A failed thumbnail upload raises `StorageUnavailable` and returns 502 like the photo upload, so a sighting never exists without both files.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api && uv run pytest tests/sightings -v -k "not db"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/sightings api/tests/sightings
git commit -S -m "feat: store a thumbnail next to each sighting photo"
```

### Task 3: Batch signed URLs

**Files:**
- Modify: `api/app/sightings/photo_store.py`, `api/tests/fakes.py` (`FakePhotoStore`)
- Test: `api/tests/sightings/test_photo_store.py`

**Interfaces:**
- Produces: `PhotoStore.signed_urls(paths: list[str], expires_in: int) -> dict[str, str | None]`: one `POST /object/sign/photos` with `{"expiresIn": expires_in, "paths": paths}`. Supabase answers a list of `{"path", "signedURL", "error"}`; a path whose object is missing comes back with `signedURL` null and maps to `None`. Full URLs are built as in `signed_url`. An empty `paths` list returns `{}` without a request. Transport or HTTP errors raise `StorageUnavailable`.
- `FakePhotoStore.signed_urls` returns `https://signed.test/{path}?ttl={expires_in}` for paths in `uploads` and `None` for the rest, and raises `fail` when set.

- [ ] **Step 1: Write the failing tests using `httpx.MockTransport`, as the existing store tests do**

```python
def test_signed_urls_signs_many_paths_in_one_call(): ...
    # assert one request, body {"expiresIn": 3600, "paths": ["a.jpg", "b.jpg"]}
    # assert result == {"a.jpg": f"{base}/storage/v1/object/sign/photos/a.jpg?token=1", "b.jpg": None}

def test_signed_urls_with_no_paths_makes_no_request(): ...

def test_signed_urls_raises_when_storage_fails(): ...
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd api && uv run pytest tests/sightings/test_photo_store.py -v`
Expected: FAIL with `AttributeError: 'PhotoStore' object has no attribute 'signed_urls'`

- [ ] **Step 3: Implement `signed_urls` and the fake; widen `_send`'s `json` type to accept the list body**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api && uv run pytest tests/sightings/test_photo_store.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/sightings/photo_store.py api/tests
git commit -S -m "feat: sign many photo urls in one storage call"
```

### Task 4: Week log query and `GET /sightings`

**Files:**
- Modify: `api/app/sightings/repo.py`, `api/app/sightings/routes.py`, `api/tests/fakes.py` (`FakeSightingsRepo`)
- Test: `api/tests/sightings/test_sightings_repo_db.py`, `api/tests/sightings/test_sightings_routes.py`

**Interfaces:**
- Consumes: `thumb_path` (Task 2), `signed_urls` (Task 3), existing `week_at`
- Produces in `repo.py`:

```python
@dataclass(frozen=True)
class LoggedSighting:
    id: UUID
    player_id: UUID
    display_name: str
    photo_path: str
    taken_at: datetime
    claim_type: str
    categories: tuple[str, ...]
    points: int
    status: str
    flagged: bool
    check_note: str | None

# on SightingsRepo and PgSightingsRepo
def week_log(self, week: Period, player_id: UUID | None) -> tuple[LoggedSighting, ...]: ...
```

- Produces the response models in `routes.py`: `LoggedSightingOut` (the fields of `LoggedSighting` minus `photo_path`, plus `is_me: bool` and `thumb_url: str | None`) and `SightingsLogOut(starts_at, ends_at, sightings)`. Route: `GET /sightings?mine=false`.
- `FakeSightingsRepo.logs: list[LoggedSighting]`; `week_log` filters it by `player_id` when given.

- [ ] **Step 1: Write the failing DB tests (reuse `add_sighting`, `add_challenge`)**

```python
def test_week_log_lists_only_this_weeks_sightings_newest_first(db_conn): ...
    # sightings in this week, last week and a challenge; assert ids == [newest, older] for this week only

def test_week_log_filters_to_one_player(db_conn): ...

def test_week_log_includes_display_name_and_check_note(db_conn): ...
    # set check_note and verification_notes on a row; assert check_note returned
    # and that LoggedSighting has no verification_notes field
```

- [ ] **Step 2: Run them to verify they fail**

Run: `make db-api-test`
Expected: FAIL with `AttributeError: 'PgSightingsRepo' object has no attribute 'week_log'`

- [ ] **Step 3: Implement `week_log`**: join `public.players` for `display_name`, `where week_id = %(week)s and (%(player)s is null or player_id = %(player)s)`, `order by taken_at desc, id`

- [ ] **Step 4: Run the DB tests to verify they pass**

Run: `make db-api-test`
Expected: PASS

- [ ] **Step 5: Write the failing route tests**

```python
def test_sightings_lists_the_week_with_thumbnails(harness): ...
    # one log entry whose thumb is in store.uploads; assert thumb_url ends with ".thumb.jpg?ttl=3600",
    # is_me True for the caller, starts_at/ends_at from week_at

def test_sightings_mine_filters_to_the_caller(harness): ...

def test_sightings_falls_back_to_full_photo_without_thumbnail(harness): ...
    # only the .jpg is in uploads; assert thumb_url ends with ".jpg?ttl=3600" and not ".thumb.jpg"

def test_sightings_still_load_when_storage_is_down(harness): ...
    # store.fail set; status 200 and every thumb_url is None

def test_sightings_never_include_admin_notes(harness): ...
    # "verification_notes" not in any item

# add "/sightings" to test_endpoints_require_sign_in
```

- [ ] **Step 6: Run them to verify they fail**

Run: `cd api && uv run pytest tests/sightings/test_sightings_routes.py -v`
Expected: FAIL with 405 on `GET /sightings`

- [ ] **Step 7: Implement `get_sightings(user, repo, store, now, mine: bool = False)`**

Sign all thumb paths with one `signed_urls` call, then sign the full photo paths of any thumb that came back `None` with a second call (skip it when none are missing). On `StorageUnavailable`, every `thumb_url` is `None`. Uses `SIGNED_URL_SECONDS`.

- [ ] **Step 8: Run all API tests**

Run: `cd api && uv run pytest -v -k "not db" && make db-api-test`
Expected: PASS

- [ ] **Step 9: Commit (two commits: repo, then route)**

```bash
git add api/app/sightings/repo.py api/tests/sightings/test_sightings_repo_db.py api/tests/fakes.py
git commit -S -m "feat: add the weekly sightings log query"
git add api/app/sightings/routes.py api/tests/sightings/test_sightings_routes.py
git commit -S -m "feat: add the sightings log endpoint"
```

### Task 5: Web API client

**Files:**
- Modify: `web/src/lib/api.ts`
- Test: `web/src/lib/api.test.ts`

**Interfaces:**
- Produces:

```ts
export type SightingStatus = 'counted' | 'false_call' | 'waiting_review'

export interface LoggedSighting {
  categories: string[]
  check_note: string | null
  claim_type: 'regular' | 'special'
  display_name: string
  flagged: boolean
  id: string
  is_me: boolean
  player_id: string
  points: number
  status: SightingStatus
  taken_at: string
  thumb_url: string | null
}

export interface SightingsLog {
  ends_at: string
  sightings: LoggedSighting[]
  starts_at: string
}

export const getSightings = (mine: boolean) =>
  request<SightingsLog>(`/sightings?mine=${mine}`, 'GET', undefined, true)
```

- [ ] **Step 1: Write the failing test** `getSightings calls /sightings with the mine flag and auth`, following the `getLeaderboard` test.
- [ ] **Step 2: Run it**: `cd web && npx vitest run src/lib/api.test.ts`. Expected: FAIL, `getSightings` not exported.
- [ ] **Step 3: Add the types and function.**
- [ ] **Step 4: Run it**: same command. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -S -m "feat: add the sightings log client"`

### Task 6: Log copy and day grouping

**Files:**
- Create: `web/src/lib/sightingsCopy.ts`
- Test: `web/src/lib/sightingsCopy.test.ts`

**Interfaces:**
- Produces:

```ts
export type CardKind = 'counted' | 'false_call' | 'flagged' | 'special' | 'waiting'

export interface LogCard {
  categories: string[]
  checkNote: string | null
  claimType: 'regular' | 'special'
  id: string
  kind: CardKind
  name: string
  photoUrl: string | null
  points: number
  takenAt: string
}

export const cardKind = (s: { flagged: boolean; status: SightingStatus; claim_type: 'regular' | 'special' }) => CardKind
export const claimLine = (card: LogCard) => string
export const chipText = (card: LogCard) => string
export const timeText = (takenAt: string) => string        // "4:31 PM", Pacific
export const dayHeader = (takenAt: string, now: number) => string
export const groupByDay = (cards: LogCard[], now: number) => { header: string; cards: LogCard[] }[]
```

Rules (from the spec): precedence false call, then flagged, then special/counted (`waiting` is set by the caller for queued items). Claim line: "Regular", "Special · {categories joined by ', '}"; false call shows `checkNote ?? 'Photo check: not a Kia Soul'`. Chips: "+1 Counted", "+2 Special", "+2 · Flagged for a second look", "−1 False call", "Waiting to send", with numbers from `points` (`−` is U+2212, `+` for zero or more). Headers: "Today · Thu", "Yesterday · Wed", otherwise the weekday "Mon". `groupByDay` sorts cards newest first and keeps days newest first.

- [ ] **Step 1: Write the failing tests**

```ts
it('groups by Pacific day, not UTC', ...)          // 2026-11-16T07:30:00Z is Sunday 11:30 PM Pacific
it('labels today, yesterday and older days', ...)
it('keeps day headers right across the DST change', ...)  // now = 2026-11-02, sightings on Nov 1
it('writes each chip from the points', ...)        // +1 Counted, +3 Special, +2 · Flagged..., −1 False call, Waiting to send
it('shows the check note on a false call, with a fallback', ...)
it('lets a false call win over flagged', ...)
```

- [ ] **Step 2: Run them**: `cd web && npx vitest run src/lib/sightingsCopy.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement with `Intl.DateTimeFormat` in `America/Los_Angeles`**; compare Pacific calendar dates (`en-CA` `yyyy-mm-dd` parts), never millisecond offsets.
- [ ] **Step 4: Run them**: same command. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -S -m "feat: add sightings log copy and day grouping"`

### Task 7: Queued sightings hook

**Files:**
- Modify: `web/src/lib/uploadQueue.ts`
- Create: `web/src/hooks/useQueuedSightings.ts`
- Test: `web/src/lib/uploadQueue.test.ts`, `web/src/hooks/useQueuedSightings.test.tsx`

**Interfaces:**
- Produces in `uploadQueue.ts`: `export const UPLOADS_FLUSHED = 'soul-search:uploads-flushed'`; `flushUploads` dispatches `new Event(UPLOADS_FLUSHED)` on `window` after each flush settles.
- Produces `useQueuedSightings(playerId: string, store: QueueStore = deviceQueue): { items: QueuedSighting[]; reload: () => void }`. Reads `store.all()` filtered to `playerId` on mount, on `reload()` and on `UPLOADS_FLUSHED`. A failed read gives `[]`.

- [ ] **Step 1: Write the failing tests**

```ts
it('fires uploads-flushed after a flush', ...)
it('loads only this player\'s queued items', ...)
it('reloads when uploads flush', ...)
it('gives an empty list when the queue cannot be read', ...)
```

- [ ] **Step 2: Run them**: `cd web && npx vitest run src/lib/uploadQueue.test.ts src/hooks/useQueuedSightings.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them**: same command. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -S -m "feat: read queued sightings for the log"`

### Task 8: Card, day header and placeholder components

**Files:**
- Create: `web/src/components/SightingCard.tsx` + `.module.css` + `.test.tsx`, `web/src/components/DayHeader.tsx` + `.module.css`, `web/src/components/SightingsPlaceholder.tsx` + `.module.css`

**Interfaces:**
- Consumes: `LogCard`, `claimLine`, `chipText`, `timeText` (Task 6), `Shimmer`
- Produces: `SightingCard({ card }: SightingCardProps)`, `DayHeader({ children }: DayHeaderProps)`, `SightingsPlaceholder()` (two day headers' worth: one header shimmer and three card shimmers, then one and two)

Card styles per `kind` (spec table): counted `--c-forest-tint` / chip `--c-forest`; special `--c-gold-soft` / chip `--c-ink`; flagged `--c-surface`, 2px solid `--c-orange` border, chip `--c-orange-deep`; false call `--c-orange-tint`, chip `--c-orange-deep`; waiting `--c-cream`, 2px dashed `--c-ink-muted` border, chip `--c-ink-muted`. Every card has a 2px border (transparent when none) so heights match. Name truncates with ellipsis (`min-width: 0`), claim line wraps. Photo box keeps its size with `--c-cream-deep` behind it when `photoUrl` is null; `<img alt="">` with `loading="lazy"`.

- [ ] **Step 1: Write the failing tests**

```ts
it.each(['counted','special','flagged','false_call','waiting'])('renders the %s card', ...)  // chip text and data-kind attribute
it('renders without a photo url', ...)
```

- [ ] **Step 2: Run them**: `cd web && npx vitest run src/components/SightingCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the three components and their CSS from the Weekly design file (screen 04) and Empty - Error States 03.**
- [ ] **Step 4: Run them and lint**: `cd web && npx vitest run src/components && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -S -m "feat: add the sighting card and log placeholder"`

### Task 9: Sightings screen

**Files:**
- Modify: `web/src/screens/SightingsScreen.tsx`
- Create: `web/src/screens/SightingsScreen.module.css`, `web/src/screens/SightingsScreen.test.tsx`

**Interfaces:**
- Consumes: `getSightings` (Task 5), `cardKind`, `groupByDay`, `LogCard` (Task 6), `useQueuedSightings` (Task 7), `SightingCard`, `DayHeader`, `SightingsPlaceholder` (Task 8), `useApiResource`, `useAutoRefresh`, `useMeContext`, `SegmentedControl`, `EmptyState`, `LoadError`, `ScreenTitle`

Behavior:
- `loadEveryone = () => getSightings(false)`, `loadMine = () => getSightings(true)` at module scope, one `useApiResource` each; `useAutoRefresh` refreshes both and calls `queued.reload()`.
- Queued items become `kind: 'waiting'` cards with `photoUrl` from `URL.createObjectURL(item.photo)`; create the URLs in a `useMemo` over `items` and revoke them in an effect cleanup. Drop queued items whose id is already in the server list.
- Cards = waiting cards + server cards, passed to `groupByDay(cards, Date.now())`.
- Kicker `"{n} this week"` (n = cards shown); while the first load is still going, "This week".
- States: `status === 'loading'` gives `SightingsPlaceholder`; empty (no server or waiting cards) gives `EmptyState` with title "No sightings yet" and body "Photos from everyone in the group show up here as soon as they're sent."; `status === 'error'` gives waiting cards (if any) then `LoadError thing="sightings"`.
- Split the list into a `SightingsList({ groups })` component if the screen goes over about 150 lines.

- [ ] **Step 1: Write the failing tests (mock `../lib/api` and pass a fake queue store as in the hook test)**

```ts
it('shows the placeholder while loading', ...)
it('groups cards under day headers', ...)
it('switches to Just mine', ...)
it('shows the empty state', ...)
it('shows the load error and retries', ...)
it('merges a waiting card from the queue', ...)
it('shows a sent sighting once even while it is still queued', ...)
it('counts the shown cards in the kicker', ...)
```

- [ ] **Step 2: Run them**: `cd web && npx vitest run src/screens/SightingsScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the screen.**
- [ ] **Step 4: Run all web checks**: `cd web && npm run lint && npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 5: Check it in the running app** at 390px, in standard and large text, with seed data including a flagged, a false-call and a queued sighting (go offline in devtools and take a photo). Take the 390px screenshot for the PR notes.
- [ ] **Step 6: Commit**: `git commit -S -m "feat: show the weekly sightings log"`
