# Admin Challenges API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin endpoints to list, create, edit and delete special challenges, with validation and change history (PR 1 of #14).

**Architecture:** Pure validation in `app/admin/challenges.py` (no DB), persistence in `app/admin/challenges_repo.py` (Protocol + Pg implementation, like `rules_repo.py`), thin FastAPI routes in `app/admin/challenges_routes.py` guarded by `get_admin_user`. Delete reuses `PgSightingsRepo.week_at` and `PgWeeksRepo.refresh_results`.

**Tech Stack:** FastAPI, pydantic, psycopg 3, pytest (`-m db` for DB tests), Vitest for the web history copy.

**Spec:** `docs/superpowers/specs/2026-11-11-special-challenges-design.md` (PR 1 section)

## Global Constraints

- Errors are `ApiError(status, code, **extra)` codes, never prose. The web maps codes to copy in PR 2.
- Error codes: `invalid_name`, `invalid_times`, `overlaps` (extra `name`), `start_locked`, `invalid_points`, `invalid_bonus`, `not_found` (404), `not_admin` (403, existing guard).
- Name trimmed, 1 to 40 characters.
- Point ranges match A4: `regular` 1..10, `special` 1..10, `false_call` -10..0, each bonus 1..10.
- Time ranges are half-open `[starts_at, ends_at)`: a challenge ending at 6:00 pm does not overlap one starting at 6:00 pm.
- Request datetimes must be timezone-aware (`pydantic.AwareDatetime`); compare instants, not strings.
- Change history: `type="challenge"`, `target_id` = challenge id, `before`/`after` = the challenge as JSON (`name`, `starts_at`, `ends_at`, `rules`), `None` on create (`before`) and delete (`after`).
- No code comments unless non-obvious. Single-line conventional commits, GPG signed. Run `make lint` and `make test` after every task (`make db-api-test` for DB tests, local Supabase running).

## Review Focus

- Editing a challenge without changing its times must not report it overlapping itself. (Task 2 test `test_overlapping_ignores_the_excluded_challenge`.)
- Back-to-back challenges are allowed. (Task 2 test `test_back_to_back_challenges_do_not_overlap`.)
- Re-sending the same start instant in a different UTC offset on a started challenge is not a change. (Task 1 test `test_start_locked_compares_instants`.)
- Deleting a challenge whose photos fall in two different weeks, one already closed: each photo lands in its own week and only the closed one's results refresh. (Task 3 test `test_delete_moves_photos_to_each_ones_week_and_refreshes_closed_weeks`.)
- Naive datetimes in the body return 422 `invalid_request`, not a 500. (Task 4 test `test_naive_datetimes_are_rejected`.)

---

### Task 1: Validation rules

**Files:**
- Create: `api/app/admin/challenges.py`
- Test: `api/tests/admin/test_challenges.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class ChallengeRules: regular: int; special: int; false_call: int; bonuses: Mapping[str, int]` with `to_json() -> dict[str, object]` and `@classmethod from_json(data: Mapping[str, object]) -> ChallengeRules` (`bonuses` defaults to `{}`).
  - `@dataclass(frozen=True) class ChallengeDraft: name: str; starts_at: datetime; ends_at: datetime; rules: ChallengeRules`
  - `@dataclass(frozen=True) class Challenge: id: UUID; name: str; starts_at: datetime; ends_at: datetime; rules: ChallengeRules` (defined here; the repo imports it).
  - `validate_draft(draft: ChallengeDraft, categories: Sequence[str], now: datetime, existing: Challenge | None = None) -> ChallengeDraft` returns the draft with the name trimmed, or raises `ApiError(422, code)`.

Checks in order: name (`invalid_name`), `ends_at > starts_at` (`invalid_times`), point ranges (`invalid_points`), bonuses: each key in `categories` exactly and each value 1..10 (`invalid_bonus`). When `existing` has started (`existing.starts_at <= now`): `draft.starts_at != existing.starts_at` raises `start_locked`, `draft.ends_at <= now` raises `invalid_times`. For a new or unstarted challenge, `starts_at` in the past is allowed (admin may backfill); no extra check.

- [ ] **Step 1: Write the failing tests** in `test_challenges.py`, with `NOW = datetime(2026, 11, 12, 20, tzinfo=UTC)` and a valid `DRAFT` ("Brown Week", NOW+1d to NOW+4d, rules 1/2/-1, bonus `{"Brown paint": 3}`), categories `("Alien Green", "Brown paint")`:
  - `test_valid_draft_is_returned_with_trimmed_name`: name `"  Brown Week "` comes back `"Brown Week"`.
  - `test_name_must_be_1_to_40_characters`: `"   "` and `"x" * 41` raise code `invalid_name`; `"x" * 40` passes.
  - `test_end_must_be_after_start`: equal times raise `invalid_times`.
  - `test_points_outside_a4_ranges_are_rejected`: parametrize regular 0, regular 11, special 0, false_call 1, false_call -11, each `invalid_points`.
  - `test_bonus_must_use_a_known_category_and_range`: `{"Purple": 3}`, `{"brown paint": 3}`, `{"Brown paint": 0}`, `{"Brown paint": 11}` each `invalid_bonus`.
  - `test_started_challenge_cannot_move_its_start`: existing started an hour ago; draft start one minute later raises `start_locked`.
  - `test_start_locked_compares_instants`: same start instant expressed with `ZoneInfo("America/Los_Angeles")` passes.
  - `test_started_challenge_end_cannot_be_in_the_past`: end = NOW raises `invalid_times`.
  - `test_unstarted_challenge_can_move_its_start`.
  - `test_rules_round_trip_json`: `ChallengeRules.from_json(r.to_json()) == r`, and `from_json` without `bonuses` gives `{}`.

  Assert codes with `with pytest.raises(ApiError) as err: ...; assert err.value.code == "..."`.

- [ ] **Step 2: Run to verify failure:** `cd api && uv run pytest tests/admin/test_challenges.py -v` → FAIL (module not found).
- [ ] **Step 3: Implement** `app/admin/challenges.py` per Interfaces.
- [ ] **Step 4: Run** the same command → all PASS; `make lint` clean.
- [ ] **Step 5: Commit** `feat: validate admin challenge drafts`

---

### Task 2: Repo, list, get, overlap, create, update

**Files:**
- Create: `api/app/admin/challenges_repo.py`
- Test: `api/tests/admin/test_challenges_repo_db.py` (`pytestmark = pytest.mark.db`, reuse `ALICE`, `BOB`, `CAROL`, `AT`, `add_sighting`, `add_adjustment` from `tests/sightings/test_sightings_repo_db.py`)

**Interfaces:**
- Consumes: `Challenge`, `ChallengeRules`, `ChallengeDraft` (Task 1); `ranked_cte` from `app.sightings.repo`.
- Produces:
  - `@dataclass(frozen=True) class Winner: display_name: str; points: int`
  - `@dataclass(frozen=True) class ChallengeList: running: tuple[Challenge, ...]; upcoming: tuple[Challenge, ...]; finished: tuple[tuple[Challenge, Winner | None], ...]`
  - `class ChallengesRepo(Protocol)`: `list(now: datetime) -> ChallengeList`, `get(challenge_id: UUID) -> Challenge | None`, `overlapping(starts_at: datetime, ends_at: datetime, exclude_id: UUID | None) -> str | None` (name of the first overlap by start), `create(draft: ChallengeDraft, admin_id: UUID) -> Challenge`, `update(challenge_id: UUID, draft: ChallengeDraft) -> Challenge`, `delete(challenge_id: UUID) -> None` (Task 3).
  - `PgChallengesRepo(conn)`, `get_challenges_repo(conn: Conn) -> ChallengesRepo`.

Ordering: running and upcoming by `starts_at` ascending, finished by `starts_at` descending. Finished = `ends_at <= now`; running = `starts_at <= now < ends_at`. Winner: top row of `ranked_cte("challenge_id = %(period)s")` ordered `rank, lower(display_name)`; `None` when no rows. Overlap: `starts_at < %(end)s and %(start)s < ends_at and id is distinct from %(exclude)s`.

- [ ] **Step 1: Write the failing DB tests:**
  - `test_create_then_get_round_trips`: created challenge equals `get(id)`, rules with bonuses intact, `created_by == ALICE`.
  - `test_update_changes_name_times_and_rules`.
  - `test_get_unknown_is_none`.
  - `test_list_splits_running_upcoming_finished`: three challenges around `AT`; asserts names in each bucket and order (two finished, newest first).
  - `test_finished_winner_is_top_scorer_including_adjustments`: Bob 2 pts sighting, Carol 1 sighting + adjustment +3 → winner `Winner("Carol", 4)`; a finished challenge with no photos has winner `None`.
  - `test_overlapping_returns_the_clashing_name`.
  - `test_back_to_back_challenges_do_not_overlap`.
  - `test_overlapping_ignores_the_excluded_challenge`.
- [ ] **Step 2: Run** `cd api && uv run pytest tests/admin/test_challenges_repo_db.py -m db -v` → FAIL.
- [ ] **Step 3: Implement** `PgChallengesRepo` minus `delete` (leave `delete` out of the class until Task 3; Protocol may declare it now).
- [ ] **Step 4: Run** → PASS; `make lint` clean.
- [ ] **Step 5: Commit** `feat: store admin challenges`

---

### Task 3: Delete with reassignment to weeks

**Files:**
- Modify: `api/app/admin/challenges_repo.py`
- Test: `api/tests/admin/test_challenges_repo_db.py`

**Interfaces:**
- Consumes: `PgSightingsRepo(conn).week_at(at: datetime) -> Period` (creates the week row if missing), `PgWeeksRepo(conn).refresh_results(week_id: UUID) -> None` (no-op for open weeks).
- Produces: `PgChallengesRepo.delete(challenge_id: UUID) -> None`.

Approach: lock the challenge row (`for update`); for each sighting of the challenge set `week_id = week_at(taken_at).id, challenge_id = null`; for each adjustment set `week_id = week_at(created_at).id, challenge_id = null`; delete the challenge; call `refresh_results` on every distinct week touched. Runs in the request's single connection transaction (confirm `app.db.Conn` commits at request end, as other admin writes rely on).

- [ ] **Step 1: Write the failing DB tests:**
  - `test_delete_moves_photos_to_each_ones_week_and_refreshes_closed_weeks`: a challenge spanning a Pacific week boundary with one Bob photo in each week; the earlier week is closed with `results` saved before the delete (close it via `PgWeeksRepo.close_ended`). After delete: both sightings have `challenge_id is null` and the matching `week_id`, points unchanged; the closed week's `results` now include Bob's points; the challenge row is gone.
  - `test_delete_moves_adjustments_by_created_at`.
  - `test_delete_unknown_is_a_no_op`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `delete`.
- [ ] **Step 4: Run** `uv run pytest tests/admin/test_challenges_repo_db.py -m db -v` → PASS.
- [ ] **Step 5: Commit** `feat: move a deleted challenge's photos back to their weeks`

---

### Task 4: Routes, change history and wiring

**Files:**
- Create: `api/app/admin/challenges_routes.py`
- Modify: `api/app/main.py` (include router after `history_router`), `api/tests/fakes.py` (add `FakeChallengesRepo`)
- Test: `api/tests/admin/test_challenges_routes.py` (harness pattern from `tests/admin/test_scores_routes.py`, overriding `get_challenges_repo`, `get_point_rules_repo`, `get_audit_repo`, `get_now`)

**Interfaces:**
- Consumes: Tasks 1 to 3; `get_admin_user`; `PointRulesRepo.get().categories` for bonus validation; `AuditEntry`.
- Produces (prefix `/admin/challenges`):
  - `GET ""` → `{ running: [ChallengeOut], upcoming: [ChallengeOut], finished: [FinishedChallengeOut] }`
  - `GET "/{challenge_id}"` → `ChallengeDetailOut` (`ChallengeOut` + `started: bool`), 404 `not_found`
  - `POST ""` → 201 `ChallengeOut`
  - `PUT "/{challenge_id}"` → `ChallengeOut`, 404 when missing
  - `DELETE "/{challenge_id}"` → 204, 404 when missing
  - `ChallengeOut`: `id, name, starts_at, ends_at, rules: RulesBody`; `RulesBody`: `regular, special, false_call, bonuses: dict[str, int] = {}`; `FinishedChallengeOut` adds `winner: WinnerOut | None` (`display_name, points`). Body `ChallengeBody`: `name: str, starts_at: AwareDatetime, ends_at: AwareDatetime, rules: RulesBody`.
  - `FakeChallengesRepo(challenges: list[Challenge] = [], overlap: str | None = None)` recording `created`, `updated`, `deleted`.

Order on create/update: `validate_draft`, then `overlapping(...)` → `ApiError(422, "overlaps", name=...)`, then write, then `audit.record`.

- [ ] **Step 1: Write the failing route tests:**
  - `test_non_admin_gets_403_on_every_route` (parametrize the five method/path pairs).
  - `test_list_returns_buckets_and_winner`.
  - `test_create_returns_201_and_records_history`: audit entry `type="challenge"`, `before is None`, `after["name"] == "Brown Week"`, `target_id` = new id.
  - `test_create_rejects_overlap_with_its_name`: JSON `{"error": "overlaps", "name": "Thanksgiving Dash"}`.
  - `test_create_passes_settings_categories_to_validation`: bonus on an unknown category → `invalid_bonus`.
  - `test_naive_datetimes_are_rejected` → 422 `invalid_request`.
  - `test_update_started_challenge_cannot_move_start` → `start_locked`.
  - `test_update_records_before_and_after`.
  - `test_get_detail_reports_started`.
  - `test_unknown_id_is_404_for_get_put_delete`.
  - `test_delete_returns_204_and_records_history`: `after is None`, `before["name"]`.
- [ ] **Step 2: Run** `uv run pytest tests/admin/test_challenges_routes.py -v` → FAIL.
- [ ] **Step 3: Implement** routes, fake, wiring.
- [ ] **Step 4: Run** `make lint && make test && make db-api-test` → all PASS.
- [ ] **Step 5: Commit** `feat: add admin challenge endpoints`

---

### Task 5: Change history wording on the web

**Files:**
- Modify: `web/src/lib/historyCopy.ts` (the `case 'challenge'` branch), `web/src/lib/historyCopy.test.ts` (replace `describes a challenge change`)

**Interfaces:**
- Consumes: history entries whose `before`/`after` hold `name` (Task 4).
- Produces: `historyLine` challenge lines `created {name}.`, `changed {name}.` (uses `after` name), `deleted {name}.`; falls back to `changed a challenge.` if the name is missing. Reuse the existing `textOf` helper.

- [ ] **Step 1: Write failing tests** `describes a created challenge`, `describes a changed challenge`, `describes a deleted challenge` with `Brown Week`, plus `falls back when a challenge has no name`.
- [ ] **Step 2: Run** `cd web && npx vitest run src/lib/historyCopy.test.ts` → FAIL.
- [ ] **Step 3: Implement** a `challengeLine` helper alongside `emailsLine`.
- [ ] **Step 4: Run** `make lint && cd web && npm test` → PASS.
- [ ] **Step 5: Commit** `feat: describe challenge changes in the history`

---

## Finish

`/security-review` on the branch diff, then ask before pushing and opening the PR (API PR, no screenshot needed; design link to C1 and C2 in Notes).
