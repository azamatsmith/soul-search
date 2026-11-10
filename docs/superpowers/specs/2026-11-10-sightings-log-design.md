# Sightings log

Issue: #10, Sightings log and weekly leaderboard. This spec covers the Sightings log only (Weekly design file, screen 04, plus Empty - Error States 03 to 03c). The Leaderboard shipped in #57. The photo viewer follows in its own PR.

## Decisions

- The log shows the current Pacific week only. No paging, no older weeks.
- Photos are shown as small thumbnails made at upload, not full photos.
- Live updates reuse the Leaderboard approach: refresh on return to the foreground and every 30 seconds while visible. Pull-to-refresh is out of scope.
- "Waiting to send" cards come from this phone's upload queue, for the signed-in player only.
- Out of scope: tapping a card (photo viewer PR), challenge tags and challenge day headers (C7, #14).
- `check_note` is shown to every player on false-call cards. `verification_notes` is never returned.

## API

### Thumbnails

- `clean_photo` also returns a thumbnail: longest side 480px, JPEG quality 80.
- The photo store saves it next to the photo at `{photo path without .jpg}.thumb.jpg`. No new column or migration.
- Photos sent before this change have no thumbnail. The log falls back to the full photo for them. No backfill.

### `PhotoStore.signed_urls(paths, expires_in)`

One storage call that signs many paths, so the log costs one round trip instead of one per card. Raises `StorageUnavailable` on failure.

### `GET /sightings?mine=true|false`

Requires an allowed user. `mine` defaults to false.

```json
{
  "starts_at": "2026-11-09T08:00:00Z",
  "ends_at": "2026-11-16T08:00:00Z",
  "sightings": [
    {
      "id": "uuid",
      "player_id": "uuid",
      "display_name": "Heathyr",
      "is_me": true,
      "taken_at": "2026-11-12T00:31:00Z",
      "claim_type": "special",
      "categories": ["Alien Green"],
      "points": 2,
      "status": "counted",
      "flagged": false,
      "check_note": null,
      "thumb_url": "https://..."
    }
  ]
}
```

- Sightings with `week_id` = the current week (`week_at(now)`). Challenge sightings are not included.
- `mine=true` limits to the caller's sightings.
- Ordered by `taken_at` descending, then id.
- `thumb_url` signs the thumbnail when it exists, otherwise the full photo. If storage fails, every `thumb_url` is null and the list still returns.
- `verification_notes` is never part of the response.

### API tests

DB tests (`test_sightings_repo_db.py`):

- Only the current week's sightings; challenge sightings excluded
- `mine` filter
- Newest first
- Returns `check_note` and the display name; no `verification_notes`

Photo tests: `clean_photo` thumbnail size and orientation; the store uploads both files.

Route tests (`test_sightings_routes.py`): both filters, `is_me`, thumbnail falls back to the full photo, storage failure gives null URLs, unauthenticated.

## Web

### Data

- `getSightings(mine)` and the `SightingsLog` and `LoggedSighting` types in `lib/api.ts`.
- One `useApiResource` per segment, loaded on first view, refreshed by `useAutoRefresh` (30 seconds).
- Waiting cards: read the upload queue for the current player on mount, on every refresh and after a queue flush. The queued photo blob is shown through an object URL, revoked on unmount. Waiting cards appear under both Everyone and Just mine.

### Screen

`SightingsScreen`, Sightings tab:

- Kicker "{n} this week", n = cards shown under the current filter, waiting cards included. Title "Sightings".
- `SegmentedControl`: Everyone | Just mine.
- Cards grouped by Pacific day, days newest first, cards newest first within a day.
- Day headers: "Today · Thu", "Yesterday · Wed", otherwise the weekday ("Mon").

### `SightingCard`

Thumbnail, player name, time ("4:31 PM"), claim line, status chip.

| State | Claim line | Chip | Card |
| --- | --- | --- | --- |
| Counted, regular | Regular | +1 Counted | forest tint |
| Counted, special | Special · {categories joined by ", "} | +{points} Special | gold soft |
| Flagged | the claim | +{points} · Flagged for a second look | surface, 2px orange border, orange-deep chip text |
| False call | `check_note`, or "Photo check: not a Kia Soul" | −1 False call (from points) | orange tint, orange-deep chip text |
| Waiting to send | the claim | Waiting to send | cream, 2px dashed ink-muted border |

Precedence: waiting, then false call, then flagged, then counted. A flagged false call shows as a false call.

Point values come from each sighting's `points`, never hard-coded. Colors use theme tokens only.

### Shared and new components

| Component | Purpose |
| --- | --- |
| `SightingCard` | One card as above. |
| `SightingsPlaceholder` | Shimmer cards in the card layout, using `Shimmer`. |
| `DayHeader` | The day group label. |
| `lib/sightingsCopy.ts` | Day header, time, claim line and chip text helpers. |

### States

- Loading (first load only): `SightingsPlaceholder`.
- Empty (both segments): `EmptyState` with "No sightings yet" / "Photos from everyone in the group show up here as soon as they're sent."
- Error with nothing to show: `LoadError` with "Couldn't load sightings". Waiting cards, if any, still show above it.
- Must hold up at 390px and in large-text mode. Shimmer stays still under reduced motion.

### Web tests

- `SightingsScreen`: loading, ready, empty, error with Try again, segment switch, waiting card merged in, day grouping.
- `SightingCard`: each of the five states.
- `sightingsCopy`: Today, Yesterday and weekday headers, including across a DST change; claim line; chip text.
