# Leaderboard

Issue: #10, Sightings log and weekly leaderboard. This spec covers the Leaderboard screen only (Weekly design file, screen 03). The Sightings log and the photo viewer follow in their own PRs.

## Decisions

- One PR per screen. This one ships the Leaderboard plus the shared pieces the Sightings log will reuse.
- Live updates: refetch when the app comes back to the foreground and every 30 seconds while it is visible. No Supabase Realtime, so every read still goes through FastAPI and RLS keeps its zero-policy setup.
- Ranking rule: only players with a sighting or an admin adjustment in the scope are listed, ranked among themselves with `rank()` (ties share a rank: 1, 2, 2, 4). Home's rank switches to the same rule, so the two screens always agree.
- "This week" is the Pacific week containing now, even while a challenge runs. Replacing it with the challenge board (C6) belongs to #14.
- "See past weeks ›" is left out until Past weeks ships in #12; that acceptance criterion moves to #12.
- Pinning the current player's row when it scrolls out of view is out of scope.

## API

All new code lives in `api/app/sightings/`.

### `GET /leaderboard?scope=week|all`

Requires an allowed user, like the other sightings routes. An unknown scope returns 422 `invalid_request`.

```json
{
  "scope": "week",
  "starts_at": "2026-11-09T08:00:00Z",
  "ends_at": "2026-11-16T08:00:00Z",
  "total_players": 23,
  "rows": [
    {
      "player_id": "uuid",
      "display_name": "Mom",
      "points": 18,
      "count": 12,
      "rank": 1,
      "is_me": false
    }
  ]
}
```

- `week`: sightings with `week_id` = the current week, plus adjustments with the same `week_id`. Challenge sightings and challenge adjustments never count.
- `all`: every sighting and every adjustment, week and challenge. `starts_at` and `ends_at` are null.
- A player is listed when they have at least one sighting or one adjustment in the scope.
- `points` = sum of sighting points + sum of adjustment changes. `count` = sightings that are not false calls.
- Rows are ordered by rank, then display name ignoring case.
- `total_players` counts every player, listed or not.

### Shared ranking

The ranking query is written once in the repo and used by both `leaderboard()` and `standing()`, so the two cannot disagree.

### Repo changes

- `week_at(at)`: the week lookup and insert, split out of `period_at()`. `period_at()` calls it when no challenge is running.
- `leaderboard(scope, week)`: returns the rows above.
- `standing()`: ranks among participants only, using the shared query. A player whose only activity is an adjustment now gets a rank on Home. `total_players` still counts every player.

### API tests

DB tests in `test_sightings_repo_db.py`:

- Week scope excludes challenge sightings and challenge adjustments; all time includes both
- Adjustments count toward points and make a player listed
- Ties share a rank
- False calls lower points but not count
- Players with no activity are not listed but are counted in `total_players`
- A player whose only sighting is a false call is listed last with a rank
- `standing()` and `leaderboard()` give the same rank for the same player

Route tests in `test_sightings_routes.py` with the existing fakes: both scopes, `is_me`, invalid scope, unauthenticated.

## Web

### Data

- `getLeaderboard(scope)` and the `Leaderboard` and `LeaderboardRow` types in `lib/api.ts`.
- `useApiResource` gains `refresh()`: it reloads without dropping the current data. A failed refresh keeps the old data and shows no error. `retry()` keeps its current behavior.
- `useAutoRefresh(refresh, intervalMs)` in `src/hooks`: calls `refresh` on `visibilitychange` to visible and every `intervalMs` while the document is visible. Default 30 seconds.
- Each segment has its own resource and loads on first view. Switching back shows the cached data immediately and refreshes it.

### Screen

`ScoresScreen`, Scores tab:

- Title block kicker: week shows "NOV 9-15 · 23 PLAYERS · RESETS MONDAY"; all time shows "SINCE YOU JOINED · 23 PLAYERS". Title "Leaderboard".
- `SegmentedControl`: This week | All time.
- List of `LeaderboardRow`: rank, `PlayerAvatar`, "Name (you)" for the current player, "{n} Souls" (singular "1 Soul"), score.
  - Current player: forest-tint background, 2px forest border. Wins over 1st place.
  - Rank 1: gold-soft background, 2px gold border. Every rank-1 row in a tie gets it.
  - Others: surface background, transparent border.

### Shared components

One component per file, each with its own CSS module that uses only `var(--...)` tokens.

| Component | Purpose |
| --- | --- |
| `SegmentedControl` | Two or more options, design system segmented control. Used again by Sightings. |
| `PlayerAvatar` | Initial in a circle. Color picked from forest, orange, ink-muted and ink by the player id, so a player keeps their color. |
| `LeaderboardRow` | One row as above. |
| `LeaderboardPlaceholder` | Six shimmer rows in the real row layout, using `Shimmer`. |
| `EmptyState` | Dashed gold circle with a serif "S", title, body, orange "Take a photo" button that opens the capture flow. |
| `LoadError` | "Couldn't load {thing}" alert with the shared body copy and a Try again button. Home's inline error switches to it. |

### States

- Loading (first load only): `LeaderboardPlaceholder`.
- Empty, this week: "No scores yet this week" / "Nobody has spotted a Soul since Monday. The first photo puts you on top."
- Empty, all time: "No scores yet" / "The first photo puts you on top."
- Error with nothing to show: `LoadError` with "Couldn't load the scores".
- Must hold up at 390px and in large-text mode. The shimmer stays still under reduced motion (already handled by `Shimmer`).

### Web tests

- `ScoresScreen`: loading, ready, empty (both scopes), error with Try again, segment switch, you-row and 1st-place styling, kicker copy.
- `useAutoRefresh`: interval while visible, no calls while hidden, refresh on becoming visible, cleanup on unmount.
- `useApiResource.refresh`: keeps data while reloading, keeps old data on failure.
- `SegmentedControl`: selection and keyboard access.
- `PlayerAvatar`: same id gives the same color.
