# Friendly error screen (#115)

## Why

Any error while a screen renders shows React Router's developer error page, with no way back for a player.

## Design (approved)

- Inside a tab (Home, Sightings, Scores, Upcoming): the error replaces that tab's content only; the tab bar stays.
- Anywhere else, or if the app shell itself fails: a full-page error screen.
- Look: the photo flow's "Didn't send" style (orange 96px "!" circle, serif title, body, primary button), tokens only, fine at 390px and in large text.
- Copy: "Something went wrong" / "This screen hit a problem. Your photos are safe." / **Try again** / **Back to Home** (hidden on Home).
- Try again navigates to the current location (replace), which clears the router error; if the bug remains the error screen returns.
- The error and path are logged with `console.error`.

## Approaches

1. **Route `errorElement`s (picked):** a pathless route under `AppShell` catches tab errors inside the shell; a pathless root route catches everything else. Router-native, no class component.
2. A class `ErrorBoundary`: against the project's function-component rule, and duplicates what the data router already does.

## Plan

1. Failing route tests (`routes.errors.test.tsx`, a test-only throwing Sightings and Settings screen): in-tab error keeps the tab bar; full-page error has Back to Home; Try again recovers once fixed; Back to Home goes Home; the error is logged.
2. `components/RouteError.tsx` + `RouteError.module.css` (`fullPage?: boolean`), wired into `routes.tsx`.
3. Full suite, lint, typecheck, format; check at 390px in standard and large text.
