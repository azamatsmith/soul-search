# Special challenges

Issue: #14, Admin: special challenges. Design: Challenges design file, screens C1 to C7.

Timed challenges (e.g. "Brown Week", a 4-hour "Thanksgiving Dash") scheduled by an admin. While one runs, new photos count toward the challenge instead of the week, scored with the challenge's rules, and the challenge has its own leaderboard. Challenge points count toward All time, never the week.

## Already in place

- `challenges` table with `rules jsonb`.
- `PgSightingsRepo.period_at` tags new photos with the running challenge and scores them with its rules, including category bonuses.
- `/me/standing` and `/period` already use `period_at`.
- The Saved step and Home soul count already take a challenge name.
- `PgWeeksRepo.refresh_results` recomputes a closed week's saved standings.
- The change history already has a `challenge` type.

## Decisions

- Four PRs, each branched from fresh main: (1) API admin CRUD, (2) Web C1 and C2, (3) API player-facing data, (4) Web C3 to C7.
- Challenges never overlap. Create and edit reject a time range that overlaps another challenge with "Overlaps {name}".
- Once a challenge has started, its start time is locked. Name, end time and rules stay editable. The end cannot move before now. Rule changes apply to new photos only, since points are stored per sighting.
- Delete is allowed at any time. Each of the challenge's photos moves to the Pacific week containing its `taken_at`, and each score adjustment to the week containing its `created_at`, keeping their stored points. Every affected week that is already closed gets `refresh_results`, so Past weeks stays correct. All of it runs in one transaction.
- The design has no delete control. C2 edit gets a "Delete challenge" text button at the bottom with an in-page confirm.
- Finished challenge results are admin-only (C1 "Won by ..."). No player-facing past-challenges screen in MVP.
- Times are entered and shown in Pacific time and stored as UTC.
- Every create, edit and delete writes a change-history entry.

## Rules

```json
{ "regular": 1, "special": 2, "false_call": -1, "bonuses": { "Brown paint": 3 } }
```

New challenges start from the weekly settings with no bonuses. Bonus categories must exist in settings, at most one bonus per category. Values use the same ranges as the A4 steppers.

## PR 1: API, admin challenge CRUD

New files in `api/app/admin/`: `challenges_repo.py` and `challenges_routes.py`, guarded like the other admin routes.

- `GET /admin/challenges`: `{ running: [...], upcoming: [...], finished: [...] }`. Upcoming sorted soonest first, finished newest first. Each item: `id`, `name`, `starts_at`, `ends_at`, `rules`; finished items also carry `winner` (`display_name`, `points`) or null when nobody scored.
- `GET /admin/challenges/{id}`: one challenge plus `started: bool`. 404 when missing.
- `POST /admin/challenges`: body `name`, `starts_at`, `ends_at`, `rules`. 201 with the challenge.
- `PUT /admin/challenges/{id}`: same body. Returns the challenge.
- `DELETE /admin/challenges/{id}`: 204.

Validation errors return 422 with a player-readable message, matching the existing admin error shape:

- Name trimmed, 1 to 40 characters.
- End after start.
- No overlap with another challenge.
- After start: start unchanged, end not before now.
- Bonus categories exist in settings.

Change history wording: "created Brown Week", "changed Brown Week", "deleted Brown Week". `historyCopy` on the web gets the matching lines.

## PR 2: Web, C1 and C2

- C1 admin list: Running now, Coming up, Finished. Cards show the exact Pacific range and a status line ("Live · ends 6:00 pm · 3 hours left", "Starts Thu 9:00 am · in 3 days", "Won by Marcus T.").
- C2 and C2b create and edit: name, start and end each as a date picker plus a time picker, "All times Pacific", a live duration line ("Runs 4 hours"), steppers prefilled from the weekly rules, add and remove category bonuses, Save challenge, and Delete challenge with an in-page confirm. Start pickers are disabled once started.
- A Challenges row on Admin tools (A1).
- Shared time-left helper following the design rule: over 24 hours "Ends Sun 11:59 pm · 2 days left"; 1 to 24 hours "Ends 6:00 pm · 3 hours left"; under an hour "Ends 6:00 pm · 45 min left". Weekday only when the end isn't today, lowercase am/pm.

## PR 3: API, player-facing challenge data

- `/period` returns the rules, including bonuses.
- `/leaderboard?scope=challenge` returns the running challenge's board, 404 when none is running. This week never includes challenge points; All time does.
- The Sightings log selects by `taken_at` within the Pacific week instead of `week_id`, so challenge photos still show, and each sighting carries `challenge_name`.

## PR 4: Web, C3 to C7

- C3 and C3b Home: "Challenge · {name}" kicker, time left, Challenge points, rank, and the orange banner, including the short-challenge version.
- C4 and C5 photo flow: "Counts toward {name}", challenge point values and bonus chips.
- C6: the Leaderboard's first tab becomes the challenge, with a rules strip, while one runs.
- C7: challenge tags and day headers show the challenge name.
- Point values always come from data.

## Testing

- API: repo DB tests for overlap, the started-challenge lock, delete reassignment and closed-week refresh; route tests for admin-only access and each validation error.
- Web: unit tests for the time-left helper and screen tests for each new screen and state.
- End to end locally: create a short challenge, send a photo, check Home, photo flow, leaderboard and sightings; delete it and confirm the photo moves to its week and Past weeks updates.
