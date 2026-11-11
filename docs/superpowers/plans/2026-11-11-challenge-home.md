# Challenge Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a challenge runs, Home (C3 and C3b) shows the challenge kicker, the full time-left line, Challenge points and an orange banner, and every time-left string comes from one helper.

**Architecture:** `web/src/lib/challengeTime.ts` becomes the only home of time-left copy (short form for the weekly header, full form for challenges). A new `web/src/lib/bannerCopy.ts` builds the banner text from `Period.rules.bonuses` and `ends_at`. `HomeHeader` branches on `period.kind`, and a new `ChallengeBanner` renders under it on `TakePhotoScreen`.

**Tech Stack:** React 19 function components, TypeScript, CSS Modules, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-special-challenges-design.md` (section "PR 4", "Decisions" and "PR A").

## Global Constraints

- Branch: `feat/challenge-home` (already created, spec commit on it).
- Pacific time (`America/Los_Angeles`), lowercase am/pm, weekday only when the end isn't today.
- Over 24 h: "{n} days left"; 1 to 24 h: "{n} hours left"; under 1 h: "{n} min left", minutes rounded up. Singular "1 day", "1 hour".
- Weekly Home header keeps the short form ("3 days left"). Challenges use "Ends Sun 11:59 pm · 2 days left".
- Bonus copy uses category names as-is: "Brown paint is worth +3." Several: "Brown paint is worth +3 and Alien Green +4." No bonuses: no sentence.
- Never use em or en dashes in copy, comments or commits.
- CLAUDE.md: named exports, `ComponentNameProps` interface, alphabetized props, one CSS module per component, only `var(--...)` tokens, no multi-line inline handlers, no `any`.
- After every task: `npm run lint && npm run typecheck && npm test` in `web/`, all green. Commits are signed (`git commit -S`), single-line conventional messages.

## Review Focus

- The challenge has already ended but `/period` hasn't refreshed yet: header and banner must not say "0 min left" or "-3 min left"; both read "Ending now". (Task 1 and Task 2 tests.)
- A challenge ending at exactly midnight Pacific (00:00 the next day): the banner is the long version and names "Fri 12:00 am", not "today". (Task 2 test.)
- Several bonuses arrive in jsonb key order, which Postgres reorders: output must be stable regardless of key order. (Task 2 test.)
- A bonus value of 1: "is worth +1" (no plural issue, but the sign must stay). (Task 2 test.)
- Large-text mode: the banner wraps rather than overflowing at 390px; it uses `--t-*` tokens only. (Task 4, checked in the 390px screenshot.)

---

### Task 1: One time-left helper

**Files:**
- Modify: `web/src/lib/challengeTime.ts`
- Modify: `web/src/lib/challengeTime.test.ts`
- Modify: `web/src/lib/homeCopy.ts` (delete `timeLeft` and the now-unused `HOUR`/`DAY` constants if nothing else uses them)
- Modify: `web/src/lib/homeCopy.test.ts` (delete the `timeLeft` block)
- Modify: `web/src/components/HomeHeader.tsx` (import `shortTimeLeftText` instead of `timeLeft`)

**Interfaces:**
- Produces: `shortTimeLeftText(endIso: string, now: number): string` and the existing `timeLeftText(endIso: string, now: number): string`, both in `challengeTime.ts`. At or after the end, both return `'Ending now'`.

- [ ] **Step 1: Write the failing tests** in `challengeTime.test.ts`. Move the `timeLeft` table from `homeCopy.test.ts` into `describe('shortTimeLeftText')` unchanged (end `'2026-11-16T08:00:00Z'`, rows `5 days left` through `Ending now`). Add to `describe('timeLeftText')`:

```ts
it('says Ending now once the end has passed', () => {
  expect(timeLeftText('2026-11-12T19:59:00Z', NOW)).toBe('Ending now')
  expect(timeLeftText('2026-11-12T20:00:00Z', NOW)).toBe('Ending now')
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/challengeTime.test.ts`. Expected: FAIL, `shortTimeLeftText` is not exported and `timeLeftText` returns "Ends 12:00 pm · 0 min left".

- [ ] **Step 3: Implement.** Add `shortTimeLeftText` returning `` `${distance(end, now)} left` ``. Both functions return `'Ending now'` when `end - now <= 0`. `liveText` and `startsInText` keep their current output. Delete `timeLeft` from `homeCopy.ts` and its test block; switch `HomeHeader` to `shortTimeLeftText`.

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass, including the moved table (it already expected round-up-safe values).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib web/src/components/HomeHeader.tsx
git commit -S -m "refactor: keep all time-left copy in one helper"
```

### Task 2: Banner copy

**Files:**
- Create: `web/src/lib/bannerCopy.ts`
- Test: `web/src/lib/bannerCopy.test.ts`

**Interfaces:**
- Consumes: `clockText(at: number)` from `challengeTime.ts`, `pacificDay`, `weekday` from `pacificTime.ts`, `Period` from `api.ts`.
- Produces:
  - `bonusText(bonuses: Record<string, number>): string | null`
  - `bannerTitle(name: string): string` returning `` `${name} is on` ``
  - `bannerBody(period: Period, now: number): string`

- [ ] **Step 1: Write the failing tests.** `NOW = Date.parse('2026-11-12T20:00:00Z')` (Thu 12:00 pm Pacific).

```ts
describe('bonusText', () => {
  it('is null with no bonuses', () => expect(bonusText({})).toBeNull())
  it('names one bonus', () =>
    expect(bonusText({ 'Brown paint': 3 })).toBe('Brown paint is worth +3.'))
  it('joins two, highest first', () =>
    expect(bonusText({ 'Brown paint': 3, 'Alien Green': 4 })).toBe(
      'Alien Green is worth +4 and Brown paint +3.',
    ))
  it('lists three with commas and "and"', () =>
    expect(bonusText({ B: 2, A: 2, C: 5 })).toBe('C is worth +5, A +2 and B +2.'))
  it('ignores key order', () =>
    expect(bonusText({ A: 2, C: 5, B: 2 })).toBe(bonusText({ B: 2, A: 2, C: 5 })))
  it('keeps the sign on +1', () => expect(bonusText({ X: 1 })).toBe('X is worth +1.'))
})

describe('bannerBody', () => {
  it('uses the long version when the end is on a later day', () =>
    expect(bannerBody(challenge('2026-11-16T07:59:00Z', { 'Brown paint': 3 }), NOW)).toBe(
      'Brown paint is worth +3. Photos count toward the challenge until Sun 11:59 pm. Weekly scores pick up again after that.',
    ))
  it('uses the short version when it ends today', () =>
    expect(bannerBody(challenge('2026-11-13T02:00:00Z', { 'Alien Green': 3 }), NOW)).toBe(
      'Alien Green is worth +3 until 6:00 pm today. After that, photos count toward your week again.',
    ))
  it('short version without bonuses', () =>
    expect(bannerBody(challenge('2026-11-13T02:00:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until 6:00 pm today. After that, photos count toward your week again.',
    ))
  it('long version without bonuses', () =>
    expect(bannerBody(challenge('2026-11-16T07:59:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until Sun 11:59 pm. Weekly scores pick up again after that.',
    ))
  it('treats midnight as the next day', () =>
    expect(bannerBody(challenge('2026-11-13T08:00:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until Fri 12:00 am. Weekly scores pick up again after that.',
    ))
})
```

`challenge(endsAt, bonuses)` is a local fixture returning a `Period` with `kind: 'challenge'`, `name: 'Brown Week'`, and `rules` `{ regular: 1, special: 2, false_call: -1, categories: [], bonuses }`.

- [ ] **Step 2: Run** `npx vitest run src/lib/bannerCopy.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** in `bannerCopy.ts`. Sort bonuses by points descending, then name ascending. Short version applies when `pacificDay(end) === pacificDay(now)`. With a bonus sentence in the short version, the "until {time} today" clause attaches to the bonus sentence (drop its period); without one, use "Photos count toward the challenge until {time} today." The long version always appends "Photos count toward the challenge until {Weekday time}. Weekly scores pick up again after that."

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/bannerCopy.ts web/src/lib/bannerCopy.test.ts
git commit -S -m "feat: add the challenge banner copy"
```

### Task 3: HomeHeader challenge state

**Files:**
- Modify: `web/src/components/HomeHeader.tsx`
- Test: `web/src/components/HomeHeader.test.tsx` (create)

**Interfaces:**
- Consumes: `shortTimeLeftText`, `timeLeftText` (Task 1).
- Produces: no new exports. Props unchanged.

- [ ] **Step 1: Write the failing tests.** Render `HomeHeader` with `now = Date.parse('2026-11-12T20:00:00Z')`, a ranked standing (`points: 6, rank: 2, total_players: 19`).
  - Week period (`kind: 'week'`, `name: null`, starts `'2026-11-09T08:00:00Z'`, ends `'2026-11-16T08:00:00Z'`): shows "Week of Nov 9-15", "3 days left", "Your points".
  - Challenge period (`kind: 'challenge'`, `name: 'Brown Week'`, ends `'2026-11-16T07:59:00Z'`): shows "Challenge · Brown Week", "Ends Sun 11:59 pm · 3 days left", "Challenge points", "6", "2nd".

- [ ] **Step 2: Run** `npx vitest run src/components/HomeHeader.test.tsx`. Expected: FAIL on the challenge case (kicker is "Brown Week", label is "Your points").

- [ ] **Step 3: Implement.** `isChallenge = period.kind === 'challenge'`. Kicker: `` `Challenge · ${period.name}` `` for challenges, else the existing week kicker. Time line: `timeLeftText` for challenges, `shortTimeLeftText` for weeks. Points label: "Challenge points" or "Your points". Keep the CSS `text-transform: uppercase` as is.

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/HomeHeader.tsx web/src/components/HomeHeader.test.tsx
git commit -S -m "feat: show the running challenge in the Home header"
```

### Task 4: ChallengeBanner on Home

**Files:**
- Create: `web/src/components/ChallengeBanner.tsx`
- Create: `web/src/components/ChallengeBanner.module.css`
- Modify: `web/src/screens/TakePhotoScreen.tsx`
- Modify: `web/src/screens/TakePhotoScreen.test.tsx`

**Interfaces:**
- Consumes: `bannerTitle`, `bannerBody` (Task 2).
- Produces: `ChallengeBanner` with `interface ChallengeBannerProps { now: number; period: Period }`.

- [ ] **Step 1: Write the failing tests** in `TakePhotoScreen.test.tsx`, reusing its existing `WEEK` fixture and mocks:
  - A challenge period with `name: 'Brown Week'` and `bonuses: { 'Brown paint': 3 }` shows a region named "Brown Week is on" (`getByRole('region', { name: 'Brown Week is on' })`) containing "Brown paint is worth +3."
  - A week period renders no "is on" region (`queryByRole('region')` is null).

- [ ] **Step 2: Run** `npx vitest run src/screens/TakePhotoScreen.test.tsx`. Expected: FAIL, no region.

- [ ] **Step 3: Implement.** `ChallengeBanner` renders `<section aria-labelledby={titleId}>` (`useId`) with an `h2` title and a `p` body. TakePhotoScreen renders it right after `HomeHeader` when `period.data?.kind === 'challenge'` and standing has loaded. CSS (from the design, tokens only):

```css
.banner {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--s-1);
  margin: var(--s-4) var(--s-5) 0;
  padding: var(--s-3) var(--s-4);
  border-radius: var(--r-lg);
  background: var(--c-orange);
  box-shadow: inset 0 -3px 0 var(--c-orange-deep);
  color: var(--c-on-dark);
}
.title { margin: 0; font: 400 var(--t-h3) / 1.2 var(--f-display); }
.body { margin: 0; font: 500 var(--t-small) / 1.4 var(--f-body); }
```

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass.

- [ ] **Step 5: Verify in the app.** Run the stack locally, create a challenge from Admin, and check Home at 390px (per the 390px iframe memory) in standard and large text, for both a multi-day and a same-day challenge. Save both screenshots for the PR notes.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/ChallengeBanner.tsx web/src/components/ChallengeBanner.module.css web/src/screens/TakePhotoScreen.tsx web/src/screens/TakePhotoScreen.test.tsx
git commit -S -m "feat: show the challenge banner on Home"
```
