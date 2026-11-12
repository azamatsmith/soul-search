# Photo Placeholder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Photos show the striped placeholder until they load and never a broken-image icon.

**Architecture:** A `Photo` component renders a wrapper with `var(--stripes)` and an `img` that is transparent until `onLoad`, fades in, and is removed on `onError`. Callers pass sizing via `className`.

**Tech Stack:** React 19 + TypeScript, CSS Modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-photo-placeholder-design.md`

## Global Constraints

- One component per file, named export, `PhotoProps` interface, alphabetized props, CSS Module next to it, tokens only (durations follow the existing inline `0.2s ease-out` pattern with a reduced-motion override).
- Commits: single-line conventional subject, GPG-signed, no AI attribution.

## Review Focus

1. A cached image whose `load` fires before React attaches the handler: must still show (check `img.complete` on mount).
2. `src` changes on the same component (Sightings refetch gives a new signed URL): reset to the placeholder for the new URL, no stale "loaded".
3. Lazy-loaded images below the fold keep `loading="lazy"`.

---

### Task 1: `Photo` component

**Files:** Create `web/src/components/Photo.tsx`, `Photo.module.css`, `Photo.test.tsx`

**Interfaces:** Produces `Photo({ alt, className?, lazy?, src }: PhotoProps)`; wrapper `span` gets `data-state="loading" | "loaded" | "failed"`.

- [ ] Failing tests: shows the placeholder (`data-state="loading"`) with the img present but not yet visible; after `fireEvent.load(img)` state is `loaded`; after `fireEvent.error(img)` state is `failed` and no `img` remains; a new `src` returns to `loading`; `lazy` sets `loading="lazy"`; an already-complete image (stub `complete` true and `naturalWidth` > 0) starts `loaded`.
- [ ] Run `npx vitest run src/components/Photo.test.tsx`: FAIL (module missing).
- [ ] Implement; state keyed by `src` (store the loaded/failed URL, compare during render, no effect for derivable state).
- [ ] Run the file: PASS. Commit `feat: add a photo component with a striped placeholder`.

### Task 2: Use `Photo` everywhere a remote photo shows

**Files:** `SummaryCard.tsx`, `SightingCard.tsx`, `ReviewCard.tsx`, `ReviewPhotoScreen.tsx` and their CSS modules (drop now-unused `.image`/`.noPhoto` rules and the cream/stripes backgrounds `Photo` now owns).

- [ ] Failing tests: SummaryCard shows the striped placeholder for the last photo before it loads (`data-state="loading"`), and a failed last photo leaves no `img`.
- [ ] Run: FAIL.
- [ ] Replace each remote `img` with `Photo` (Sightings and flagged cards pass `lazy`); SummaryCard with no photo keeps its stripes-only box.
- [ ] Full suite, lint, typecheck, format. Commit `feat: show a striped placeholder until photos load`.
