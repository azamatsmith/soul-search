# Right-Sized Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Phones get a thumbnail or a 1600px display version, never the original; existing photos get the missing sizes from a backfill command.

**Architecture:** `photo_meta` makes both derived sizes from one upright image; upload stores them beside the original; routes sign the right size with fallbacks via the existing `cached_signed_urls`; a backfill module walks every sighting's `photo_path`, detects missing sizes with batch signing, and uploads them.

**Tech Stack:** FastAPI, Pillow, psycopg, pytest (fakes in `api/tests/fakes.py`).

**Spec:** `docs/superpowers/specs/2026-11-12-photo-sizes-design.md`

## Global Constraints

- Thumbnail: 480px long edge, quality 80 (unchanged). Display: 1600px long edge, quality 80. Never upscale.
- Paths: `thumb_path(p)` = `<p without .jpg>.thumb.jpg` (unchanged); `display_path(p)` = `<p without .jpg>.display.jpg`.
- API field names unchanged. Fallback order: thumbnail, display, original.
- Commits: single-line conventional subject, GPG-signed, no AI attribution. Run `uv run ruff check`, `uv run ruff format --check`, `uv run pytest` (whatever the repo's CI uses).

## Review Focus

1. A photo with no thumbnail and no display (pre-backfill): every URL falls back to the original, nothing is `null` when the original exists.
2. Storage down during standing or sightings: still 200 with `null` URLs (existing behavior).
3. Backfill on a photo whose original is missing or corrupt: logs and continues, counts it as failed, exit code non-zero only if any failed.
4. Backfill re-run: uploads nothing when every size exists.
5. Portrait and EXIF-rotated originals: display keeps orientation (originals are already upright, so no second transpose).

---

### Task 1: Make and store the display version at upload

**Files:** `app/sightings/photo_meta.py`, `app/sightings/photo_store.py`, `app/sightings/routes.py` (upload), tests in `tests/sightings/test_photo_meta.py`, `test_photo_store.py`, `test_sightings_routes.py`.

**Interfaces:** Produces `display_path(photo_path: str) -> str`; `CleanPhoto.display: bytes`; `Sizes(thumbnail: bytes, display: bytes)`; `make_sizes(data: bytes) -> Sizes` (for an already-cleaned JPEG; raises `InvalidPhoto`).

- [ ] Failing tests: a 3000x4000 upload's display is 1200x1600 JPEG; a 300x200 upload's display stays 300x200; `display_path("p1/abc.jpg") == "p1/abc.display.jpg"`; posting a sighting uploads `[path, thumb, display]`; `make_sizes` on a cleaned JPEG returns both sizes; `make_sizes(b"junk")` raises `InvalidPhoto`.
- [ ] Run: FAIL. Implement (shared resize helper for both sizes). Run: PASS. Commit `feat: save a display-size copy of each photo`.

### Task 2: Serve the right size

**Files:** `app/sightings/routes.py` (standing, sightings), `app/admin/review_routes.py`, their tests.

- [ ] Failing tests: standing `last_photo_url` is the thumbnail URL; without a thumbnail it is the display, then the original; sightings `photo_url` is the display URL, falling back to the original; `thumb_url` falls back thumbnail, display, original; admin review `photo_url` is the display URL with the same fallback; storage down still gives `null`.
- [ ] Run: FAIL. Implement with `cached_signed_urls` and a small `first_url(urls, *paths)` helper. Run: PASS. Commit `feat: send phones the thumbnail or display size`.

### Task 3: Backfill command

**Files:** Create `app/sightings/backfill_sizes.py`, `tests/sightings/test_backfill_sizes.py`; README section.

**Interfaces:** `backfill(paths: Iterable[str], store, *, dry_run: bool) -> BackfillResult(checked, created, failed)`; `main(argv: list[str] | None = None) -> int` reads all `photo_path` from `sightings` (`select photo_path from sightings order by taken_at`) and prints `Checked N photos, created M sizes, F failed` (dry run says "would create").

- [ ] Failing tests with `FakePhotoStore`: creates only the missing size(s); dry run uploads nothing but counts; a missing original counts as failed and the run continues; a second run creates nothing; `main` returns 1 when anything failed, else 0.
- [ ] Run: FAIL. Implement (batch-sign to find missing, download original, `make_sizes`, upload). Run: PASS.
- [ ] README: how to run it in Render Shell (`python -m app.sightings.backfill_sizes --dry-run`, then without).
- [ ] Commit `feat: add a command to backfill photo sizes`.
