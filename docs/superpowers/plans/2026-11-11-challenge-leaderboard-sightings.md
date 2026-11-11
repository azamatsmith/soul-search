# Challenge Leaderboard and Sightings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a challenge runs, the Leaderboard's first tab is the challenge with a rules strip (C6), and Sightings marks challenge days and photos with the challenge name (C7).

**Architecture:** The web API types catch up with what the API already returns (`scope=challenge`, `name`, `challenge_name`, `no_challenge`). A `useLeaderboardTabs` hook decides whether the first tab is the week or the challenge from `/period`, falling back to the week on `no_challenge`. Sightings copy gains a challenge suffix for day headers and a `ChallengeTag` next to the status chip.

**Tech Stack:** React 19, TypeScript, TanStack Query (via `useApiResource`), CSS Modules, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-special-challenges-design.md` (sections "PR 4", "Decisions" and "PR C").

## Global Constraints

- Branch: `feat/challenge-leaderboard-sightings`, from fresh main.
- C6 kicker: "Challenge · ends Sun 11:59 pm", weekday only when the end isn't today, lowercase am/pm, Pacific.
- Rules strip: "Rules: Regular +1 · Special +2 · Brown paint +3 · False call −1". Only bonuses worth more than Special (`liveBonuses`), highest first then by name, minus as U+2212.
- C7 day headers: "Today · Fri · Brown Week" when any photo that day is in a challenge; "Wed · Weekly" for other days of a week that has challenge photos; unchanged otherwise. Challenge cards get an orange tag with the challenge name.
- No em or en dashes. CLAUDE.md: named exports, `ComponentNameProps`, alphabetized props, CSS Modules with only `var(--...)` tokens, no multi-line inline handlers, no `any`, hooks in `src/hooks`, components under about 150 lines.
- After every task: `npm run lint && npm run typecheck && npm test` in `web/`, all green. Signed single-line conventional commits.

## Review Focus

- The challenge ends while Scores is open: the next challenge-board fetch returns `no_challenge` and the screen must fall back to This week rather than show an error. (Task 2 test.)
- `/period` is still loading or failed: the first tab is This week, never a blank or broken tab. (Task 2 test.)
- The player selected the first tab during a challenge and the challenge ends: the selection stays on the first tab, now This week, not on a stale challenge. (Task 2: state is `'first' | 'all'`, not a scope.)
- A photo still waiting to send (no `challenge_name`) on a challenge day: the day keeps the challenge suffix from the sent photos, and a day with only waiting photos gets no suffix unless the week has challenge photos ("Weekly"). (Task 3 test.)
- Two different challenges in one week: each day shows its own challenge's name. (Task 3 test.)

---

### Task 1: API types and shared copy

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/hooks/useApiResource.ts`
- Modify: `web/src/lib/claim.ts`, `web/src/lib/bannerCopy.ts`, `web/src/lib/challengeTime.ts`, `web/src/lib/leaderboardCopy.ts`
- Test: `web/src/lib/claim.test.ts`, `web/src/lib/challengeTime.test.ts`, `web/src/lib/leaderboardCopy.test.ts` (create if missing)

**Interfaces:**
- Produces:
  - `api.ts`: `LeaderboardScope = 'all' | 'challenge' | 'week'`; `Leaderboard.name: string | null`; `LoggedSighting.challenge_name: string | null`; `'no_challenge'` in `ERROR_CODES`.
  - `useApiResource(key, load, { enabled?: boolean, refreshEvery?: number })`, passing `enabled` to `useQuery` (default true). Disabled resources report `status: 'loading'`.
  - `claim.ts`: `sortedBonuses(rules: Rules): [string, number][]` (live bonuses, points descending then name). `bannerCopy.ts` switches to it with no change in output.
  - `challengeTime.ts`: `endsAtText(endIso: string, now: number): string` returning "ends Sun 11:59 pm" or "ends 6:00 pm".
  - `leaderboardCopy.ts`: `leaderboardKicker(board: Leaderboard, now: number)` adds the challenge case "Challenge · ends Sun 11:59 pm"; `rulesText(rules: Rules): string`.

- [ ] **Step 1: Write the failing tests.** `NOW = Date.parse('2026-11-12T20:00:00Z')`.
  - `endsAtText('2026-11-16T07:59:00Z', NOW)` is `'ends Sun 11:59 pm'`; `endsAtText('2026-11-13T02:00:00Z', NOW)` is `'ends 6:00 pm'`.
  - `sortedBonuses({ ...RULES, special: 2, bonuses: { A: 2, B: 3, C: 5, D: 3 } })` equals `[['C', 5], ['B', 3], ['D', 3]]`.
  - `rulesText({ regular: 1, special: 2, false_call: -1, categories: [], bonuses: { 'Brown paint': 3 } })` is `'Rules: Regular +1 · Special +2 · Brown paint +3 · False call −1'`; with no bonuses, `'Rules: Regular +1 · Special +2 · False call −1'`.
  - `leaderboardKicker({ scope: 'challenge', name: 'Brown Week', starts_at: '2026-11-12T17:00:00Z', ends_at: '2026-11-16T07:59:00Z', total_players: 19, rows: [] }, NOW)` is `'Challenge · ends Sun 11:59 pm'`. Existing week and all-time kicker tests keep passing with the new `now` argument.

- [ ] **Step 2: Run** `npx vitest run src/lib`. Expected: FAIL, the new functions are missing.

- [ ] **Step 3: Implement.** `endsAtText` reuses the private `momentText` in `challengeTime.ts`. Update `ScoresScreen`'s call to `leaderboardKicker` to pass `now` (from `useNow`). Add `challenge_name: null` to every `LoggedSighting` test fixture that typecheck flags.

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -S -m "feat: add challenge leaderboard types and rule copy"`

### Task 2: C6 challenge leaderboard

**Files:**
- Create: `web/src/hooks/useLeaderboardTabs.ts`
- Create: `web/src/components/RulesStrip.tsx`, `RulesStrip.module.css`
- Modify: `web/src/screens/ScoresScreen.tsx`
- Test: `web/src/screens/ScoresScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1's types, `enabled`, `leaderboardKicker`, `rulesText`.
- Produces:
  - `useLeaderboardTabs(): { board: ApiResource<Leaderboard>; challengeName: string | null; options: { label: string; value: 'all' | 'first' }[]; rules: Rules | null; setTab: (tab: 'all' | 'first') => void; tab: 'all' | 'first' }`. It loads `['period']`, `['leaderboard','week']`, `['leaderboard','all']` and, only while `/period` is a challenge, `['leaderboard','challenge']` (`enabled`), all every 30 seconds. The first tab is the challenge when `/period` is a challenge and the challenge board hasn't failed with `no_challenge`; otherwise This week. `challengeName` and `rules` are null unless the first tab is the challenge.
  - `RulesStrip` with `interface RulesStripProps { rules: Rules }`, rendering `<p>` with `rulesText(rules)`.

- [ ] **Step 1: Write the failing tests** in `ScoresScreen.test.tsx`. Mock `getPeriod` alongside `getLeaderboard` (the mock keys by scope). Default `getPeriod` returns a week period, so existing tests keep passing.
  - Challenge running: tabs read "Brown Week" and "All time"; the Brown Week tab is selected; kicker "Challenge · ends Sun 11:59 pm" (fake time `2026-11-12T20:00:00Z`); rules strip text "Rules: Regular +1 · Special +2 · Brown paint +3 · False call −1"; rows come from the `challenge` board.
  - Challenge running, All time selected: no rules strip.
  - `getLeaderboard('challenge')` fails with `{ ok: false, status: 404, error: 'no_challenge' }`: tabs read "This week" and "All time", week rows show, no error message.
  - `getPeriod` never resolves: tabs read "This week" and "All time" and the week board shows.
  - Challenge running with no rows: "No scores yet in Brown Week" / "The first photo puts you on top."

- [ ] **Step 2: Run** `npx vitest run src/screens/ScoresScreen.test.tsx`. Expected: FAIL on the challenge cases.

- [ ] **Step 3: Implement** the hook, `RulesStrip`, and switch `ScoresScreen` to the hook. `RulesStrip` CSS from the design:

```css
.strip {
  margin: 0;
  padding: var(--s-3) var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-orange-tint);
  color: var(--c-ink);
  font: 600 var(--t-small) / 1.4 var(--f-body);
}
```

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -S -m "feat: show the challenge leaderboard while a challenge runs"`

### Task 3: C7 Sightings challenge days and tags

**Files:**
- Modify: `web/src/lib/sightingsCopy.ts` (`LogCard.challengeName`, `groupByDay`)
- Modify: `web/src/screens/SightingsScreen.tsx` (`toCard`), `web/src/hooks/useWaitingCards.ts` and any other `LogCard` builder typecheck flags (e.g. `reviewCopy.ts`), setting `challengeName: null` where there is no challenge data
- Create: `web/src/components/ChallengeTag.tsx`, `ChallengeTag.module.css`
- Modify: `web/src/components/SightingCard.tsx`, `SightingCard.module.css`
- Test: `web/src/lib/sightingsCopy.test.ts`, `web/src/screens/SightingsScreen.test.tsx`

**Interfaces:**
- Consumes: `LoggedSighting.challenge_name` (Task 1).
- Produces: `LogCard.challengeName: string | null`; `ChallengeTag` with `interface ChallengeTagProps { name: string }`.

- [ ] **Step 1: Write the failing tests.** In `sightingsCopy.test.ts`, with `NOW` on Fri `2026-11-13T20:00:00Z`:
  - Fri card in "Brown Week" and Wed card with none: headers `['Today · Fri · Brown Week', 'Wed · Weekly']`.
  - No challenge cards at all: headers unchanged (`['Today · Fri', 'Wed']`).
  - Fri has a waiting card (null) and a Brown Week card: one group, header `'Today · Fri · Brown Week'`.
  - Mon card in "Monday Dash" and Fri card in "Brown Week": each header names its own challenge.
  In `SightingsScreen.test.tsx`: a sighting with `challenge_name: 'Brown Week'` shows a "Brown Week" tag inside its card button; one with `challenge_name: null` has no tag.

- [ ] **Step 2: Run** `npx vitest run src/lib/sightingsCopy.test.ts src/screens/SightingsScreen.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** `groupByDay` builds groups by `dayHeader` as now, then appends ` · {name}` using the first non-null `challengeName` among that day's cards, or ` · Weekly` when the day has none but any card in the list does. The status chip and tag sit in a wrapping row (`.chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }`). Tag CSS from the design:

```css
.tag {
  align-self: flex-start;
  padding: var(--s-1) var(--s-3);
  border: 2px solid transparent;
  border-radius: var(--r-pill);
  background: var(--c-orange);
  color: var(--c-on-dark);
  font: 700 var(--t-label) / 1.3 var(--f-body);
}
```

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass.

- [ ] **Step 5: Verify in the app.** Add a running challenge and one sighting in it directly to the local database (no capture flow, so no photo-check call), then check Scores and Sightings at 390px in standard and large text. Delete the test sighting and challenge. Save C6 and C7 screenshots.

- [ ] **Step 6: Commit** `git commit -S -m "feat: mark challenge days and photos in Sightings"`
