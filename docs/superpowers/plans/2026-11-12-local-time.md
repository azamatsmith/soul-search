# Player Times in Local Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players see challenge and sighting times in their device's timezone; week labels and admin screens stay Pacific.

**Architecture:** Replace the hard-coded Pacific formatters in `web/src/lib/pacificTime.ts` with zone-aware formatters cached per zone. Player-facing copy functions take an optional `zone` that defaults to the device zone; admin code passes `PACIFIC` explicitly. The test suite pins `TZ` to Pacific so existing expectations hold, and new tests pass other zones explicitly.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + Testing Library, `Intl.DateTimeFormat`.

**Spec:** `docs/superpowers/specs/2026-11-12-local-time-design.md`

## Global Constraints

- Player screens: device timezone, no timezone label, no setting.
- Week labels ("Week of Nov 9-15", past weeks, Scores week kicker) stay Pacific dates: `weekRange` in `lib/homeCopy.ts` is not touched.
- Admin screens stay Pacific: challenge list (`ChallengesScreen`), create/edit (`ChallengeEditScreen`, `DateTimeField`, `useChallengeForm`, keeps "All times Pacific"), change history (`historyCopy`).
- Copy format unchanged: lowercase am/pm, "Ends Sun 11:59 pm · 2 days left", weekday only when not today.
- React rules from CLAUDE.md: named exports, CSS Modules, no `any`, alphabetized props.
- Commits: single-line conventional subject, GPG-signed, no AI attribution.

## Review Focus

1. Device reports no zone (`resolvedOptions().timeZone` undefined in old WebViews): fall back to Pacific, not crash. Test in Task 1.
2. A challenge that is one day in Pacific but crosses local midnight (8 pm to 10 pm Pacific is 11 pm to 1 am New York): `upcomingRangeText` picks the two-day form from local days. Test in Task 3.
3. "Today" in the note and upcoming "Today/Tomorrow" follow the local day near midnight: an 11:30 pm Pacific end is "today" in Pacific but tomorrow (2:30 am) in New York. Test in Task 3.
4. Sightings day groups near midnight: a photo at 11:30 pm Pacific is "Today" in Pacific but already the next day in Phoenix. Test in Task 4.
5. DST: Arizona never shifts, Pacific does; summer times read the same in both zones. Test in Task 2.

---

### Task 1: Zone-aware formatters (refactor, no behavior change)

**Files:**
- Create: `web/src/lib/zonedTime.ts`, `web/src/lib/zonedTime.test.ts`
- Delete: `web/src/lib/pacificTime.ts`
- Modify: every importer of `pacificTime` (`challengeTime.ts`, `noteCopy.ts`, `upcomingCopy.ts`, `sightingsCopy.ts`, `historyCopy.ts`, `hooks/useChallengeForm.ts`), `web/vite.config.ts` (test env)

**Interfaces:**
- Produces:
  - `PACIFIC = 'America/Los_Angeles'`
  - `deviceZone(): string` returns `Intl.DateTimeFormat().resolvedOptions().timeZone`, or `PACIFIC` when that is empty/undefined
  - `formattersFor(zone: string): { clock, dayKey, monthDay, weekday }` with the same options as today's `clock`/`dateKey`/`weekday` and `challengeTime`'s `monthDay`, cached in a `Map` per zone
  - `dayIn(at: number, zone: string): string` (the `YYYY-MM-DD` key, replaces `pacificDay`)
  - `dayBefore(key: string): string` (moved unchanged)

- [ ] **Step 1: Pin the suite to Pacific.** In `vite.config.ts` set `test.env = { TZ: 'America/Los_Angeles' }`.
- [ ] **Step 2: Write failing tests** in `zonedTime.test.ts`:
  - `deviceZone()` is `'America/Los_Angeles'` under the pinned suite
  - `deviceZone()` falls back to `PACIFIC` when `resolvedOptions` returns `{ timeZone: undefined }` (spy on `Intl.DateTimeFormat.prototype.resolvedOptions`)
  - `dayIn(Date.parse('2026-11-13T07:30:00Z'), PACIFIC)` is `'2026-11-12'`; with `'America/Phoenix'` it is `'2026-11-13'`
  - `formattersFor('America/Phoenix')` returns the same object on a second call
- [ ] **Step 3: Run** `cd web && npx vitest run src/lib/zonedTime.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 4: Implement `zonedTime.ts`**, then switch every `pacificTime` import to `formattersFor(PACIFIC)` / `dayIn(at, PACIFIC)` so behavior is identical. Delete `pacificTime.ts`.
- [ ] **Step 5: Run** `cd web && npx vitest run && npm run lint && npm run typecheck`. Expected: all pass, no test expectations changed.
- [ ] **Step 6: Commit** `refactor: make the time formatters zone-aware`

### Task 2: Challenge times in the player's zone

**Files:**
- Modify: `web/src/lib/challengeTime.ts`, `web/src/screens/ChallengesScreen.tsx`, `web/src/components/DateTimeField.tsx`
- Test: `web/src/lib/challengeTime.test.ts`

**Interfaces:**
- Consumes: `deviceZone`, `formattersFor`, `dayIn`, `PACIFIC` from Task 1
- Produces (new trailing `zone: string = deviceZone()` param on each): `clockText(at, zone)`, `dayText(at, zone)`, `rangeText(startIso, endIso, zone)`, `dayRangeText(startIso, endIso, zone)`, `endsAtText(endIso, now, zone)`, `timeLeftText(endIso, now, zone)`, `startsInText(startIso, now, zone)`, `liveText(endIso, now, zone)`. `shortTimeLeftText`, `lengthText`, `durationText` take no zone. `pacificToIso`, `isoToPacificFields`, `isFullDateTime` stay Pacific-only.

- [ ] **Step 1: Write failing tests** in `challengeTime.test.ts`, describe `'in another zone'`:
  - `timeLeftText('2026-11-13T02:00:00Z', Date.parse('2026-11-12T20:00:00Z'), 'America/Phoenix')` is `'Ends 7:00 pm · 6 hours left'`
  - `startsInText('2026-11-12T23:00:00Z', Date.parse('2026-11-12T22:00:00Z'), 'America/Phoenix')` is `'Starts 4:00 pm · in 1 hour'` (the reported Arizona case: Pacific 3:00 pm)
  - `rangeText('2026-11-27T04:00:00Z', '2026-11-27T06:00:00Z', 'America/New_York')` is `'Thu Nov 26, 11:00 pm – Fri Nov 27, 1:00 am'`; with `PACIFIC` it is `'Thu Nov 26, 8:00 – 10:00 pm'`
  - summer: `clockText(Date.parse('2026-07-01T22:00:00Z'), 'America/Phoenix')` equals the same call with `PACIFIC` (`'3:00 pm'`)
- [ ] **Step 2: Run** `npx vitest run src/lib/challengeTime.test.ts`. Expected: FAIL on the new cases (zone ignored).
- [ ] **Step 3: Add the `zone` param** to the functions listed above, using `formattersFor(zone)` and `dayIn(…, zone)`.
- [ ] **Step 4: Keep admin Pacific:** pass `PACIFIC` to `liveText`, `startsInText`, `rangeText`, `dayRangeText` in `ChallengesScreen.tsx`, and to `clockText` in `DateTimeField.tsx`. Add a `ChallengesScreen` test that a running challenge's subtitle reads in Pacific with the suite zone stubbed to Phoenix (spy `resolvedOptions` to `{ timeZone: 'America/Phoenix' }`).
- [ ] **Step 5: Run** full suite, lint, typecheck. Expected: all pass.
- [ ] **Step 6: Commit** `feat: show challenge times in the player's timezone`

### Task 3: Note and upcoming copy in the player's zone

**Files:**
- Modify: `web/src/lib/noteCopy.ts`, `web/src/lib/upcomingCopy.ts`, `web/src/screens/UpcomingChallengesScreen.tsx`
- Test: `web/src/lib/noteCopy.test.ts`, `web/src/lib/upcomingCopy.test.ts`, `web/src/screens/UpcomingChallengesScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1 and Task 2 functions
- Produces: `noteBody(period, now, zone = deviceZone())`, `howSoonText(startIso, now, zone)`, `upcomingRangeText(startIso, endIso, zone)`, `startText(startIso, zone)` (same default)

- [ ] **Step 1: Write failing tests:**
  - `noteBody(challenge('2026-11-13T07:30:00Z', {}), Date.parse('2026-11-13T04:30:00Z'), zone)`: with `PACIFIC` it is `'Photos count toward the challenge until 11:30 pm today. After that, photos count toward your week again.'`; with `'America/New_York'` it is `'Photos count toward the challenge until Fri 2:30 am. Weekly scores pick up again after that.'`
  - `startText('2026-11-12T23:00:00Z', 'America/Phoenix')` is `'Thu Nov 12, 4:00 pm'`
  - `upcomingRangeText('2026-11-27T04:00:00Z', '2026-11-27T06:00:00Z', 'America/New_York')` is `'Thu Nov 26 – Fri Nov 27'`; with `PACIFIC` it is `'Thu Nov 26, 8:00 – 10:00 pm'`
  - `howSoonText('2026-11-13T07:30:00Z', Date.parse('2026-11-12T20:00:00Z'), 'America/Phoenix')` is `'Tomorrow'`; with `PACIFIC` it is `'Today'`
  - Upcoming screen: no text matching `/All times Pacific/`
- [ ] **Step 2: Run** the three test files. Expected: FAIL.
- [ ] **Step 3: Implement:** thread `zone` through, replacing `pacificDay` with `dayIn(…, zone)` and passing `zone` into the Task 2 functions. Footnote becomes `New challenges show up here as soon as an admin adds them.`
- [ ] **Step 4: Run** full suite, lint, typecheck. Expected: all pass.
- [ ] **Step 5: Commit** `feat: show upcoming challenges and the challenge note in local time`

### Task 4: Sightings in the player's zone, history stays Pacific

**Files:**
- Modify: `web/src/lib/sightingsCopy.ts`, `web/src/lib/historyCopy.ts`
- Test: `web/src/lib/sightingsCopy.test.ts`, `web/src/lib/historyCopy.test.ts`

**Interfaces:**
- Produces: `timeText(takenAt, zone = deviceZone())`, `viewerTime(takenAt, zone)`, `dayHeader(takenAt, now, zone)`, `groupByDay(cards, now, zone)` (same default). `historyTime` stays Pacific via `formattersFor(PACIFIC)`.

- [ ] **Step 1: Write failing tests:**
  - `dayHeader('2026-11-13T07:30:00Z', Date.parse('2026-11-13T07:45:00Z'), PACIFIC)` is `'Today · Thu'`; with `'America/Phoenix'` it is `'Today · Fri'`
  - `timeText('2026-11-12T23:00:00Z', 'America/Phoenix')` equals `timeText('2026-11-13T00:00:00Z', PACIFIC)` (Phoenix is Pacific + 1 h in winter; avoids pinning `Intl`'s space character)
  - `historyTime` with the device zone stubbed to Phoenix still prints the Pacific time
- [ ] **Step 2: Run** both files. Expected: the Phoenix sightings cases FAIL; the history case passes (guards against regression).
- [ ] **Step 3: Implement** the `zone` param in `sightingsCopy.ts`; switch `historyCopy.ts` to `formattersFor(PACIFIC)`.
- [ ] **Step 4: Run** full suite, lint, typecheck. Expected: all pass.
- [ ] **Step 5: Commit** `feat: show sighting times in the player's timezone`

### Task 5: Design README

**Files:**
- Modify: `design/README.md` (line 20 challenges summary, line 216 time-left copy rule, C8 Upcoming footnote if it mentions Pacific)

- [ ] **Step 1:** Update the rules: players see times in their device's timezone; admins create, edit and list challenges in Pacific; week labels follow Pacific dates. Remove "All times Pacific" from the C8 description.
- [ ] **Step 2:** `grep -n "Pacific" design/README.md` and confirm every remaining mention is admin or week related.
- [ ] **Step 3: Commit** `docs: describe local time for players`

### Final verification

- [ ] Full web suite, lint, format check, typecheck.
- [ ] Real app at 390x844 with the browser zone set to Phoenix: Home upcoming row shows Pacific start + 1 h in winter; admin list shows Pacific.
