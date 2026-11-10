# Sighting photo viewer

Issue: #10, Sightings log and weekly leaderboard. This spec covers the photo viewer only (Settings - History design file, screens 05, 05b and 05c). The Leaderboard shipped in #57 and the Sightings log in #61.

## Decisions

- Any card in the Sightings log opens the photo full screen, waiting cards included.
- The open photo lives in the URL as `?photo=<id>`, so the back gesture closes it.
- Pinch to zoom is a small custom hook, no new dependency.
- The full photo URL comes with the log (`photo_url`), so the viewer needs no extra request.
- No edit actions.

## API

`GET /sightings` items gain `photo_url`: a signed URL for the full photo.

- Thumbnails and full photos are signed in one storage call. The signed URL cache is keyed by the storage path that was signed.
- `thumb_url` still falls back to the full photo when there is no thumbnail.
- If storage fails, `thumb_url` and `photo_url` are both null and the list still returns.

Route tests: `photo_url` is returned, the thumbnail fallback, storage failure nulls both, cached URLs skip storage.

## Web

### Data

- `LoggedSighting.photo_url` in `lib/api.ts`.
- `LogCard.fullPhotoUrl`: `photo_url`, else `thumb_url`. Waiting cards use the queued photo's object URL.

### `PhotoViewer`

Full-screen layer over the app, `role="dialog"`, labelled by the player name.

- Close button, top left, outline on the dark camera background.
- Photo fills the remaining space, `object-fit: contain`, pinch to zoom. The thumbnail shows until the full photo loads.
- Cream info panel: name and time ("Thu 2:40 PM"), claim line, status chip, and a note box for flagged and false-call sightings.

| State | Claim line | Note box |
| --- | --- | --- |
| Counted, special, waiting | Same as the card | none |
| Flagged | Same as the card | `check_note`, else "Our photo check wasn't sure about this one. The +{points} still counts while an admin takes a look." Surface, gold-soft border. |
| False call | "Claimed: Regular" or "Claimed: Special · {categories}" | `check_note`, else "Photo check: not a Kia Soul". Orange tint, orange border. |

- Focus moves to Close on open. Escape closes. Page scroll is locked while open.
- Opening pushes `?photo=<id>`. Close goes back in history when the viewer was opened from the log, otherwise it removes the parameter. An unknown id shows nothing.
- Must hold up at 390px and in large-text mode: the info panel grows and the photo shrinks.

### `usePinchZoom`

Pointer events on the photo:

- Two pointers pinch between 1x and 4x around their midpoint.
- One pointer pans only while zoomed, clamped so the photo stays on screen.
- Double tap toggles between 1x and 2x.
- Resets when the photo changes.

### Shared components

`StatusChip` moves out of `SightingCard` so the card and the viewer share it.

### Web tests

- `sightingsCopy`: viewer time, viewer claim line, note text and fallbacks.
- `usePinchZoom`: pinch scale and clamp, pan clamp, double tap, reset.
- `PhotoViewer`: each state, Close, Escape.
- `SightingsScreen`: tapping a card opens the viewer, closing it, a waiting card opens.
