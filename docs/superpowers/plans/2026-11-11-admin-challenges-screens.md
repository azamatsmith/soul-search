# Admin Challenges Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C1 admin challenge list and C2/C2b create and edit screens, plus the Challenges row on Admin tools (PR 2 of #14).

**Architecture:** Pure helpers in `web/src/lib` (Pacific time conversion, challenge copy), API calls in `lib/api.ts`, a form hook in `src/hooks`, and two screens built from small components. Follows `PointsScreen` + `usePointRulesForm` and `AdjustScoreScreen` + `useAdjustScore`.

**Tech Stack:** React, TypeScript, React Router, TanStack Query via `useApiResource`, CSS Modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-special-challenges-design.md` (PR 2 section). Design: `design/Soul Search Challenges.dc.html` C1, C2, C2b, and `design/README.md` "Challenges".

## Global Constraints

- `~/.claude/CLAUDE.md` React rules: function components, named exports, one component per file, `ComponentNameProps` interfaces, props alphabetized (interface, destructuring, JSX), no multi-line inline handlers, components under about 150 lines, CSS Modules referencing only `var(--...)` tokens, no `any`.
- All times are Pacific (`America/Los_Angeles`), lowercase am/pm, sent to the API as UTC ISO strings.
- Time-left rule (shared with PR 4): over 24 h "Ends Sun 11:59 pm · 2 days left"; 1 to 24 h "Ends 6:00 pm · 3 hours left"; under 1 h "Ends 6:00 pm · 45 min left". Weekday only when the end isn't today. Starts use the same pattern with "Starts" and "in": "Starts Thu 9:00 am · in 3 days".
- Running card chip prefixes "Live · ": "Live · ends 6:00 pm · 3 hours left" (lowercase "ends" after the prefix).
- Point values always come from data; new challenges start from `getPointRules()` with no bonuses.
- Finished challenges open read-only (agreed): details and winner, only Delete offered.
- No browser dialogs; delete confirms in-page.
- Run `make lint` and `cd web && npm test` after every task. Single-line conventional commits, GPG signed. No code comments unless non-obvious.

## Review Focus

- A DST boundary: a challenge starting Sun Mar 8 2026 1:30 am Pacific and ending 3:30 am runs 1 hour, not 2. (Task 1 `pacificToIso` and `durationText` tests.)
- Editing a challenge loads its UTC times back into the right Pacific date and time fields, including one ending at 11:59 pm. (Task 1 `isoToPacificFields` test.)
- A server rejection (`overlaps`, `start_locked`, `invalid_times`) keeps the form filled and shows the matching message. (Task 3 screen test.)
- A started challenge's start fields are disabled but still sent unchanged. (Task 3 test.)
- Durations under an hour and exact days: "Runs 45 minutes", "Runs 3 days". (Task 1 test.)

---

### Task 1: Challenge API calls, time helpers and copy

**Files:**
- Modify: `web/src/lib/api.ts`, `web/src/lib/api.test.ts`
- Create: `web/src/lib/challengeTime.ts`, `web/src/lib/challengeTime.test.ts`, `web/src/lib/challengeCopy.ts`, `web/src/lib/challengeCopy.test.ts`

**Interfaces:**
- Produces in `api.ts`:
  - `interface ChallengeRules { bonuses: Record<string, number>; false_call: number; regular: number; special: number }`
  - `interface Challenge { ends_at: string; id: string; name: string; rules: ChallengeRules; starts_at: string }`
  - `interface FinishedChallenge extends Challenge { winner: { display_name: string; points: number } | null }`
  - `interface ChallengeList { finished: FinishedChallenge[]; running: Challenge[]; upcoming: Challenge[] }`
  - `interface ChallengeDetail extends Challenge { started: boolean }`
  - `type ChallengeInput = Omit<Challenge, 'id'>`
  - `getChallenges()`, `getChallenge(id)`, `postChallenge(input)`, `putChallenge(id, input)`, `deleteChallenge(id)` against `/admin/challenges`.
  - Add `'overlaps' | 'invalid_name' | 'invalid_times' | 'start_locked' | 'invalid_bonus'` to `ERROR_CODES`, and carry `name?: string` on `ApiFailure` when the body has a string `name`.
- Produces in `challengeTime.ts`:
  - `pacificToIso(date: string, time: string): string` (`'2026-11-26'`, `'14:00'` → `'2026-11-26T22:00:00.000Z'`). Approach: guess UTC from the wall time, read the Pacific offset at that guess with `Intl.DateTimeFormat` parts, correct, and re-check once (handles DST).
  - `isoToPacificFields(iso: string): { date: string; time: string }`
  - `durationText(startIso: string, endIso: string): string` → "Runs 4 hours", "Runs 3 days, 15 hours", "Runs 45 minutes", "Runs 1 hour, 30 minutes", "Runs 3 days".
  - `rangeText(startIso, endIso): string` → same day "Thu Nov 26, 2:00 – 6:00 pm" (drop the first am/pm when both match), else "Thu Nov 12, 9:00 am – Sun Nov 15, 11:59 pm". Finished cards use `dayRangeText` → "Oct 19 – Oct 25".
  - `timeLeftText(endIso: string, now: number): string` and `startsInText(startIso: string, now: number): string` per Global Constraints. Unit rounding: days = floor(hours / 24), hours = floor, minutes = ceil; singular "1 day left", "1 hour left".
- Produces in `challengeCopy.ts`: `challengeErrorText(failure: ApiFailure): string`:
  - `overlaps`: "This overlaps {name}. Pick other times."
  - `invalid_name`: "Give the challenge a name (up to 40 characters)."
  - `invalid_times`: "The end has to be after the start, and can't be in the past once it's running."
  - `start_locked`: "This challenge has started, so its start time can't change."
  - default: "We couldn't save that. Check your connection and try again."

- [ ] **Step 1: Write failing tests** covering every example string above, `pacificToIso` for a PST date, a PDT date and the spring-forward example in Review Focus, `isoToPacificFields('2026-11-16T07:59:00Z')` → `{ date: '2026-11-15', time: '23:59' }`, `timeLeftText` across the three bands with and without "today", and `toFailure` keeping `name`.
- [ ] **Step 2: Run** `cd web && npx vitest run src/lib` → new tests FAIL.
- [ ] **Step 3: Implement.** Reuse `clock`, `weekday` and `pacificDay` from `lib/pacificTime.ts`; lowercase the formatted am/pm.
- [ ] **Step 4: Run** → PASS; `make lint` clean.
- [ ] **Step 5: Commit** `feat: add challenge api calls and time copy`

---

### Task 2: C1 challenge list and the Admin tools row

**Files:**
- Create: `web/src/screens/ChallengesScreen.tsx` (+ `.module.css`, `.test.tsx`), `web/src/components/ChallengeCard.tsx` (+ `.module.css`)
- Modify: `web/src/screens/AdminScreen.tsx` (+ test), `web/src/routes.tsx`

**Interfaces:**
- Consumes: Task 1 `getChallenges`, `rangeText`, `dayRangeText`, `timeLeftText`, `startsInText`; `useApiResource(['challenges'], getChallenges)`; `useNow`; `PushedScreen`, `LoadError`, `Button`, `SettingsRow`.
- Produces: route `/admin/challenges` → `ChallengesScreen`; `ChallengeCard` props `{ live?: boolean; status: string; subtitle: string; title: string; to: string }`, a link card with "›". Running cards get the 2px orange border (`live`).

Screen: `PushedScreen` back "Admin tools" → `/admin`, kicker "Admins only", title "Challenges"; "+ New challenge" button → `/admin/challenges/new`; sections "Running now", "Coming up", "Finished", each hidden when empty; an empty state "No challenges yet." when all three are empty. Finished status "Won by {name}", or "Nobody scored" when `winner` is null. Admin tools gets a "Challenges" row between Flagged photos and Points & categories, linking to `/admin/challenges`.

- [ ] **Step 1: Write failing tests:** renders the three sections with the design copy for fixed `now`; hides empty sections; "Nobody scored"; empty state; load error with retry; the Admin tools Challenges row links to `/admin/challenges`.
- [ ] **Step 2: Run** `npx vitest run src/screens/ChallengesScreen.test.tsx src/screens/AdminScreen.test.tsx` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; lint clean.
- [ ] **Step 5: Commit** `feat: list challenges in admin tools`

---

### Task 3: C2 create, edit, read-only and delete

**Files:**
- Create: `web/src/hooks/useChallengeForm.ts`, `web/src/screens/ChallengeEditScreen.tsx` (+ `.module.css`, `.test.tsx`), `web/src/components/DateTimeField.tsx` (+ css), `web/src/components/BonusEditor.tsx` (+ css), `web/src/components/DeleteChallenge.tsx` (+ css)
- Modify: `web/src/routes.tsx`

**Interfaces:**
- Consumes: Task 1 API calls, `pacificToIso`, `isoToPacificFields`, `durationText`, `challengeErrorText`; `getPointRules` for defaults and category list; `Stepper` (hint "Weekly rule: +1" etc., bonus rows hint "Category bonus"); `TextField`; `useRefreshAll`.
- Produces:
  - Routes `/admin/challenges/new` and `/admin/challenges/:id` → `ChallengeEditScreen`.
  - `useChallengeForm(id: string | null)` returning `{ categories, deleteChallenge, error, fields, finished, loadStatus, retry, save, saving, started, update }` where `fields = { endDate, endTime, name, rules, startDate, startTime }`. New challenges default to tomorrow 9:00 am to 11:59 pm the same day (Pacific) and the weekly rules. `finished` = `ends_at <= now`. On success it calls `refreshAll()` and navigates to `/admin/challenges`.
  - `DateTimeFieldProps { date: string; disabled?: boolean; label: string; onDateChange; onTimeChange; time: string }`: native `<input type="date">` (flex 3) and `<input type="time">` (flex 2), 72px high, showing "Thu, Nov 12" and "9:00 am" over the inputs.
  - `BonusEditorProps { bonuses: Record<string, number>; categories: string[]; onChange: (bonuses: Record<string, number>) => void }`: one Stepper row per bonus (1 to 10) with a "Remove" text button, then "+ Add a category bonus", which reveals buttons for categories without a bonus; picking one adds it at the weekly special value plus one, capped at 10.
  - `DeleteChallengeProps { name: string; onConfirm: () => void }`: "Delete challenge" text button that swaps in place to "Delete {name}? Its photos go back to their weeks." with "Delete" and "Keep it".

Screen: back "Challenges" → `/admin/challenges`; title is the name, or "New challenge" while empty; Name field; Starts and Ends `DateTimeField`; "All times Pacific" plus the live duration; the note "While it runs, new photos count toward the challenge instead of the week."; "Points during the challenge" steppers (Regular 1..10, Special 1..10, False call -10..0); `BonusEditor`; error via `FormError` using `challengeErrorText`; "Save challenge". Start fields disabled when `started`. Finished: everything disabled, no Save, the winner line ("Won by Marcus T. · 14 points" or "Nobody scored"), and Delete. Delete only appears when editing.

Ruling recorded in the plan: the design has no way to remove a bonus; a "Remove" text button on each bonus row is the smallest addition.

- [ ] **Step 1: Write failing tests:** new form prefilled from weekly rules and posts UTC ISO times; duration line updates live; overlap error shows "This overlaps Thanksgiving Dash. Pick other times." and keeps the fields; editing loads Pacific fields from the challenge; started challenge disables the start fields and still sends the unchanged start; finished challenge is read-only with the winner and no Save; add and remove a bonus; delete confirm then `deleteChallenge` and back to the list; "Keep it" cancels.
- [ ] **Step 2: Run** `npx vitest run src/screens/ChallengeEditScreen.test.tsx` → FAIL.
- [ ] **Step 3: Implement**, splitting further if the screen passes about 150 lines.
- [ ] **Step 4: Run** `make lint && cd web && npm test` → PASS.
- [ ] **Step 5: Commit** `feat: create and edit challenges`

---

## Finish

Final whole-branch review, `/security-review`, 390px screenshots of C1 and C2 via the same-origin iframe (memory: screenshot-390-iframe), push, and open the PR with the raw.githack design link to the Challenges file (C1, C2, C2b). Update the spec's PR 2 section with the read-only finished decision in the same branch.
