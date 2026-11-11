# Challenge Photo Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The photo flow (C4 and C5) shows which challenge a photo counts toward and each bonus category's points, and its rule copy comes from data instead of hard-coded text.

**Architecture:** New pure helpers in `web/src/lib/claim.ts` build the Special description, the brown-note check and the false-call text. `ClaimForm` gains a `challengeName` prop for the orange strip, `CategoryChip` gains an optional `bonus` badge, and `SavedStep` takes the false-call value from the rules. `CaptureScreen` passes both from `/period`.

**Tech Stack:** React 19 function components, TypeScript, CSS Modules, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-special-challenges-design.md` (sections "PR 4", "Decisions" and "PR B").

## Global Constraints

- Branch: `feat/challenge-photo-flow`, from fresh main.
- Category names are used as-is. The Special option shows the base `rules.special`; a bonus chip shows its own value ("+3"); the Send label (already `claimPoints`) gives the exact total.
- The Special description is the category list joined with commas and "or": "Alien Green, Racing stripes, Exterior graphics or Brown paint".
- The "Brown means brown: champagne, pale gold and beige don't count." note shows only when a category starts with "Brown" (case-insensitive).
- Negative points render with a real minus sign: "−1" (U+2212). Never use em or en dashes.
- CLAUDE.md: named exports, `ComponentNameProps`, alphabetized props, CSS Modules with only `var(--...)` tokens, no multi-line inline handlers, no `any`.
- After every task: `npm run lint && npm run typecheck && npm test` in `web/`, all green. Signed single-line conventional commits.

## Review Focus

- No categories at all: the Special description must not render "undefined" or a stray "or"; it is empty and the Special option still renders. (Task 1 test.)
- One category: "Brown paint", with no "or". (Task 1 test.)
- A bonus on a category that is no longer in `rules.categories`: no chip appears for it and nothing crashes. (Task 2 test.)
- A week (not a challenge) that has bonuses in its rules: chips still show their bonus, but no "Counts toward" strip. (Task 2 test.)
- `SpecialPicker` (admin review screen) also renders `CategoryChip`: it must keep working without a bonus badge. (Covered by its existing tests; the prop is optional.)

---

### Task 1: Rule copy helpers

**Files:**
- Modify: `web/src/lib/claim.ts`
- Test: `web/src/lib/claim.test.ts` (create if missing, otherwise extend)

**Interfaces:**
- Produces, all in `claim.ts`:
  - `specialDescription(categories: string[]): string`
  - `hasBrownCategory(categories: string[]): boolean`
  - `pointsText(points: number): string` returning `+3` or `−1`

- [ ] **Step 1: Write the failing tests.**

```ts
describe('specialDescription', () => {
  it('joins with commas and "or"', () => {
    expect(
      specialDescription(['Alien Green', 'Racing stripes', 'Exterior graphics', 'Brown paint']),
    ).toBe('Alien Green, Racing stripes, Exterior graphics or Brown paint')
  })
  it('joins two with "or"', () => {
    expect(specialDescription(['Alien Green', 'Brown paint'])).toBe('Alien Green or Brown paint')
  })
  it('shows one as-is', () => {
    expect(specialDescription(['Brown paint'])).toBe('Brown paint')
  })
  it('is empty with none', () => {
    expect(specialDescription([])).toBe('')
  })
})

describe('hasBrownCategory', () => {
  it('finds a category starting with Brown', () => {
    expect(hasBrownCategory(['Alien Green', 'brown paint'])).toBe(true)
  })
  it('ignores Brown elsewhere in the name', () => {
    expect(hasBrownCategory(['Light brown'])).toBe(false)
  })
})

describe('pointsText', () => {
  it('signs positive points', () => expect(pointsText(3)).toBe('+3'))
  it('uses a real minus sign', () => expect(pointsText(-1)).toBe('−1'))
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/claim.test.ts`. Expected: FAIL, the functions are not exported.

- [ ] **Step 3: Implement** the three functions in `claim.ts`.

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -S -m "feat: build photo rule copy from the rules"`

### Task 2: C4 claim step during a challenge

**Files:**
- Modify: `web/src/components/capture/ClaimForm.tsx`, `ClaimForm.module.css`
- Modify: `web/src/components/capture/CategoryChip.tsx`, `CategoryChip.module.css`
- Modify: `web/src/screens/CaptureScreen.tsx` (pass `challengeName`)
- Test: `web/src/screens/CaptureScreen.test.tsx`

**Interfaces:**
- Consumes: `specialDescription`, `hasBrownCategory`, `pointsText` (Task 1).
- Produces: `ClaimFormProps` gains `challengeName: string | null`. `CategoryChipProps` gains optional `bonus?: number`.

- [ ] **Step 1: Write the failing tests** in `CaptureScreen.test.tsx`, reaching the claim step the way existing tests do. Its `PERIOD` fixture has categories `['Alien Green', 'Brown paint']` and bonus `{ 'Brown paint': 3 }`.
  - Challenge period (`kind: 'challenge'`, `name: 'Brown Week'`): shows "Counts toward Brown Week".
  - Week period: no text matching `/Counts toward/`.
  - Special option description reads "Alien Green or Brown paint".
  - After choosing Special, the "Brown paint" radio contains "+3" and the "Alien Green" radio has no "+".
  - Categories `['Alien Green']` with bonuses `{ 'Brown paint': 3 }`: only an "Alien Green" chip renders, and no brown note.
  - Categories with "Brown paint": the brown note "Brown means brown" shows.

- [ ] **Step 2: Run** `npx vitest run src/screens/CaptureScreen.test.tsx`. Expected: FAIL on the strip, description and badge cases.

- [ ] **Step 3: Implement.**
  - ClaimForm renders the strip right after the header when `challengeName` is set: `<p className={styles.counts}>Counts toward {challengeName}</p>`.
  - Special `description={specialDescription(rules.categories)}`.
  - Chips pass `bonus={rules.bonuses[option]}`.
  - The brown note renders only when `hasBrownCategory(rules.categories)`.
  - CategoryChip renders `{bonus !== undefined && <span className={styles.bonus}>{pointsText(bonus)}</span>}` after the label.
  - CaptureScreen passes `challengeName={period.data.kind === 'challenge' ? period.data.name : null}`.
  - CSS from the design, tokens only:

```css
/* ClaimForm.module.css */
.counts {
  margin: 0;
  padding: var(--s-2) var(--s-3);
  border: 2px solid var(--c-orange);
  border-radius: var(--r-md);
  background: var(--c-orange-tint);
  color: var(--c-orange-deep);
  font: 700 var(--t-small) / 1.3 var(--f-body);
}

/* CategoryChip.module.css */
.bonus {
  padding: 2px var(--s-2);
  border-radius: var(--r-pill);
  background: var(--c-orange);
  color: var(--c-on-dark);
  font: 700 var(--t-label) / 1.2 var(--f-body);
}
```

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass, including the SpecialPicker tests.

- [ ] **Step 5: Commit** `git commit -S -m "feat: show the challenge and bonus points on the claim step"`

### Task 3: C5 saved step uses the false-call value

**Files:**
- Modify: `web/src/components/capture/SavedStep.tsx`
- Modify: `web/src/screens/CaptureScreen.tsx` (pass `falseCall`)
- Test: `web/src/screens/CaptureScreen.test.tsx`

**Interfaces:**
- Consumes: `pointsText` (Task 1).
- Produces: `SavedStepProps` gains `falseCall: number`.

- [ ] **Step 1: Write the failing test.** With the rules' `false_call: -2`, after a successful send the Saved step shows "If it isn't a Kia Soul, it becomes a −2 in Sightings." Existing challenge-name total tests stay as they are.

- [ ] **Step 2: Run** `npx vitest run src/screens/CaptureScreen.test.tsx`. Expected: FAIL, it says "-1".

- [ ] **Step 3: Implement.** SavedStep renders `pointsText(falseCall)`; CaptureScreen passes `falseCall={period.data.rules.false_call}` (guard as the existing `challengeName` line does, falling back to `-1` if period hasn't loaded).

- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: all pass.

- [ ] **Step 5: Verify in the app.** Add a running challenge with a Brown paint +3 bonus to the local database, open the claim step at 390px (standard and large text), pick Special and Brown paint, then delete the test challenge. Save screenshots of C4 for the PR.

- [ ] **Step 6: Commit** `git commit -S -m "feat: use the false-call value on the saved step"`
