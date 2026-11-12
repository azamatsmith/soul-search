# Right-sized photos

## Why

Phones download full camera originals (often several MB) to show a 64px Home thumbnail, the photo viewer and the admin review photo. Downloads should be no bigger than the screen needs.

## Goals

- Upload saves three files: the original (unchanged), a 256px thumbnail (was 480px; thumbnails show at 64px, 192px at 3x) and a new 1600px display version (long edge, JPEG quality 80), next to each other in storage.
- API, same field names: `last_photo_url` (Home) is the thumbnail; `photo_url` (sightings viewer, admin review) is the display version; `thumb_url` stays the thumbnail. Each falls back to the next bigger file that exists (thumbnail, then display, then original).
- No phone downloads an original. The server keeps using originals for the photo check.
- A backfill command creates missing thumbnails and display versions for existing photos, and with `--redo-thumbnails` regenerates every thumbnail at 256px: `python -m app.sightings.backfill_sizes [--dry-run] [--redo-thumbnails]`, idempotent, prints counts. The user runs it once in production from Render's Shell after deploy.

## Non-goals

- Changing the original's size or quality, or the photo check.
- Web app changes (field names stay), apart from removing the dead duplicate `--thumb: 76px` token.

## Approaches

1. **Generate at upload plus a backfill (picked by the user):** works on any Supabase plan, fixed files cache well.
2. Supabase on-the-fly image transformations: less code but a paid, per-transform feature.

## Decisions

- Display version: 1600px long edge, quality 80, used by admins too (sharp at 2x pinch zoom).
- Missing files are detected with the existing batch signing call (it returns no URL for a missing object), so the store needs no new API.
