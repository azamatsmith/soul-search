# Player times in local time

## Why

An Arizona player saw the Home upcoming row say a challenge "starts 3:00 pm" when it was already 3:00 pm for them. The time was Pacific (4:00 pm in Arizona in winter). Players shouldn't have to convert.

## Goals

- Every challenge time a player sees is in their device's timezone: starts, ends, time left, the challenge note ("until 6:00 pm today"), the Home upcoming row, the Upcoming challenges screen, the Scores kicker, and Sightings timestamps and day groups.
- "Today", "Yesterday" and weekday choices follow the player's own day.

## Non-goals

- No timezone setting and no timezone label on player screens.
- Weeks still run Monday 12:00 am to Monday 12:00 am Pacific; the server is unchanged.

## Anti-goals

- Week labels that shift with the viewer ("Nov 9-16" in Arizona).
- Admin screens that show one time in the list and another in the form.

## Decisions

- Week labels ("Week of Nov 9-15", past weeks, Scores week kicker) stay on Pacific dates.
- Admin screens stay Pacific: challenge list, create/edit ("All times Pacific" stays), change history.
- Upcoming challenges drops "All times Pacific."
- The design README's Pacific time rule is updated to match.

## Approaches

1. **Zone-aware helpers, device zone by default (picked).** Formatters take a timezone that defaults to the device's; admin code passes Pacific. Small, keeps one set of copy rules, testable with explicit zones.
2. Per-player timezone setting. Rejected: extra UI when the device already knows its zone.
3. Keep Pacific and label times "PT". Rejected by the user: players still convert.

## Left to the builder

- Tests pin the suite to Pacific so existing expectations hold; new tests pass America/Phoenix and America/New_York explicitly, including the 3 pm Arizona case.
