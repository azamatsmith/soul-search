# Handoff: Soul Search (weekly Kia Soul spotting app)

## Overview
Soul Search is a mobile app for an open group of players who spot Kia Souls anywhere during the week, photograph them, and compete on a live leaderboard that resets every Monday. This handoff covers four screens: **Sign in (magic link)**, **Home (take photo)**, **Leaderboard**, and **Sightings log**, plus the design tokens and base components.

One audience consideration drives many decisions: **an older, less tech-confident player** (the designer's mom) must be able to use it. Large tap targets, high contrast, plain-English labels, and icon + text navigation are requirements, not nice-to-haves.

## About the Design Files
The files in this bundle are **design references created in HTML**. They are prototypes that show the intended look and behavior, not production code to copy. Recreate these designs in the target codebase's environment (React Native, SwiftUI, Expo, a PWA in React, etc.) using its patterns and libraries. If no codebase exists yet, pick the most appropriate framework. A cross-platform mobile stack (e.g. Expo / React Native) or a mobile-first PWA both fit, since the core features are camera, auth and a list UI.

Open the `.dc.html` files directly in a browser to view them. The `support.js` file is only the preview runtime; ignore it for implementation.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and copy are final unless noted. Recreate pixel-accurately. Mock data (player names, places, counts) is placeholder.

**Open item:** the weekly scoring rules are not final. The UI currently shows +1 Regular / +2 Special color / −1 False call as **placeholder** values. Keep scoring values configurable.

## Design Tokens
Defined once as CSS variables in both HTML files (`:root`). Implement them as a theme object or tokens file and reference them everywhere; don't hard-code values.

### Color
| Token | Hex | Use |
|---|---|---|
| `--c-cream` | `#FAF4E8` | Page background |
| `--c-surface` | `#FFFCF5` | Cards, sheets, tab bar, inputs |
| `--c-cream-deep` | `#F1E7D3` | Segmented-control track, disabled, placeholders |
| `--c-forest` | `#1F4A33` | Headers, primary buttons, active states |
| `--c-forest-deep` | `#143424` | Primary pressed / button bottom bevel |
| `--c-forest-tint` | `#E3EBE2` | Success surfaces, "you" row highlight, selected tiles |
| `--c-orange` | `#B9501C` | Accent: camera button, alerts, active-tab bar, kickers |
| `--c-orange-deep` | `#943E13` | Orange pressed / bevel; text on orange-tint |
| `--c-orange-tint` | `#F8E2D2` | Warning surfaces, false-call chips, camera halo |
| `--c-ink` | `#3A2618` | Body text (warm dark brown) |
| `--c-ink-muted` | `#6B5443` | Secondary text (6.6:1 on cream) |
| `--c-gold` | `#C9A35A` | Rules and borders only. **Never text.** |
| `--c-gold-soft` | `#E6D5AC` | Thin dividers, 1st-place row, "+2 Special" chip |
| `--c-on-dark` | `#FFFCF5` | Text/icons on forest or orange |

Contrast: cream on forest 9.6:1; cream on orange 4.9:1; ink on cream 12.6:1.

Special-color swatch dots (category chips in design system): Alien Green `#9BC53D`, Brown `#6E4B30`.

### Typography
- Display / headings: **Young Serif** 400 (Google Fonts). Fallback Georgia, serif.
- Body / UI: **Figtree** 400/500/600/700/800 (Google Fonts). Fallback system-ui.
- Mono (code/labels in docs only): JetBrains Mono 500.

| Token | Standard | Large-text mode | Usage |
|---|---|---|---|
| `--t-display` | 48px | 54px | App name on sign-in (line-height 1.05) |
| `--t-h1` | 34px | 38px | Screen titles (serif, lh 1.1) |
| `--t-h2` | 26px | 29px | Card titles, scores (serif) |
| `--t-h3` | 21px | 24px | Button labels (sans 700), field labels |
| `--t-body` | 19px | 22px | Body (sans, lh 1.5) |
| `--t-small` | 16px | 18px | Helper text (sans 500, lh 1.45) |
| `--t-label` | 13px | 15px | Kicker labels: sans 700, uppercase, letter-spacing .14em |

The body size is 19px on purpose (larger than typical) for legibility. **Large-text mode** (Tweaks → textSize) overrides the type tokens and bumps tap targets; implement as a user setting and/or honor OS dynamic type.

### Spacing
`--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 · `--s-8` 72 (px)

### Radius
`--r-sm` 8 · `--r-md` 14 · `--r-lg` 22 · `--r-pill` 999 (px)

### Touch targets
- `--tap-min` **56px** (64 in large mode). Absolute minimum for any control. 44px is not used anywhere.
- `--tap-lg` **72px** (80 in large mode). Primary buttons, inputs, tab bar items, upload/score actions.
- Minimum 12px between adjacent targets.

### Rules & shadow
- `--rule`: `2px solid #C9A35A`. Section dividers, tab bar top border, header bottom (3px on forest header).
- `--rule-thin`: `1px solid #E6D5AC`. Light dividers.
- `--shadow-card`: `0 1px 0 #E6D5AC, 0 6px 18px rgba(58,38,24,.07)`.
- Image placeholder: `repeating-linear-gradient(135deg, #F1E7D3 0 8px, #E6D5AC 8px 9px)`.

## Shared Layout
- Designed at **390×844** (iPhone 14/15). Status bar area 44px. Respect safe areas.
- **Bottom tab bar** (screens 02–04): surface background, 2px gold top border, 18px bottom padding (home-indicator area). Three equal items, each min-height 72px, column layout: icon (26×20 box) above label, gap 6px, label Figtree 700 15px.
  - Active: icon and label `--c-forest`, plus a 4px `--c-orange` bar along the top edge of the item.
  - Inactive: `--c-ink-muted`, no bar.
  - Items, in order:
    1. **Take photo**: camera icon (rounded rect 26×19, 2.5px stroke, 5px radius, with 9px circle lens inside).
    2. **Sightings**: list icon (three rows: 5×5 square + 2.5px line).
    3. **Scores**: podium icon (three bars, heights 12/20/8px).
  - Use a real icon set in production (e.g. Lucide `camera`, `list`, `trophy`/`podium`) at a similar visual weight. **Always keep the text label.**
- **Screen title block**: kicker (`--t-label`, orange) above serif `--t-h1` forest title, padding 12px 20px 14px, 2px gold bottom rule.
- **Segmented control**: track `--c-cream-deep`, radius 14, padding 4, gap 4. Segment min-height 56, radius 10, Figtree 700 16. Selected: surface background, forest text, shadow `0 1px 3px rgba(58,38,24,.15)`. Unselected: transparent, ink-muted.
- **Primary button**: min-height 72, radius 14, forest background, cream Figtree 700 21px, `inset 0 -3px 0 #143424` bevel. Hover/pressed `#143424`.
- **Secondary button**: min-height 56, 2px forest (or gold) border, transparent, forest text Figtree 700 16.

## Screens

### 01 · Sign in (magic link)
**Purpose:** Authenticate with email only. Every user must be authenticated; there are no passwords.

**Layout:** Column, padding 24px 24px 32px, gap 18px.
1. Brand block (centered, gap 12): app icon 84×84 (see Assets), "Soul Search" (serif `--t-display`, forest), tagline "A new Kia Soul challenge every week." (`--t-body` 500, ink-muted).
2. 2px gold rule.
3. **State A: enter email**
   - Label "Your email" (`--t-h3` sans 700).
   - Email input: min-height 72, padding 0 18, radius 14, 2px gold border, surface bg, `--t-body` 500. Focus: border forest + `0 0 0 4px #E3EBE2` ring. Use `type="email"`, `autocomplete="email"`, `inputmode="email"`.
   - Helper: "We'll email you a link. Tap it to sign in. No password to remember." (`--t-small`, ink-muted).
   - Flexible spacer, then primary button **"Send my sign-in link"** pinned to bottom.
4. **State B: link sent** (after Send)
   - Confirmation card: forest-tint bg, radius 22, padding 18px 16px, centered, gap 10. 72px forest circle with envelope glyph; "Check your email" (serif `--t-h2` forest); "We sent a link to **{email}**. Open it on this phone." (`--t-body`, wraps anywhere); "The link works for 15 minutes. Check spam if it's not there." (`--t-small` ink-muted).
   - Spacer, then primary **"Open email app"**, then row of two secondary buttons (gap 12): **"Send again"** (forest border) · **"Change email"** (gold border; returns to State A).

**Behavior:**
- Validate email format before sending; show inline error in an orange-tint alert style if invalid.
- "Send again": rate-limit (e.g. 60s cooldown; show countdown in the button label).
- Deep link from email opens the app and signs the user in → Home. Expired link → back to Sign in with an alert: "That link expired. Send a new one."
- 15-minute expiry is an assumption; confirm with the auth provider config.
- First sign-in may need a display-name step (not designed yet).

### 02 · Home (Take photo)
**Purpose:** The one big action: photograph a Soul. Also shows this week's standing.

**Layout:**
- **Forest header** (bg `--c-forest`, status bar included, 3px gold bottom border, padding 8px 24px 22px):
  - Row: kicker "WEEK OF NOV 9–15" (`--t-label`, gold-soft) · "3 days left" (`--t-small` 600, gold-soft), space-between.
  - Row (align end): left: "Your points" (`--t-small`, gold-soft) over the number (serif 56px, lh 1.1, gap 6). Right: "Rank" over "4th" (serif `--t-h1`) + " of 23" (`--t-small` gold-soft).
- **Center** (flex:1, centered, gap 20):
  - **Camera button**: 250×250 circle, orange bg, cream content. Box-shadow: `0 0 0 10px #F8E2D2, 0 0 0 12px #E6D5AC, inset 0 -6px 0 #943E13, 0 14px 30px rgba(148,62,19,.35)`. Contents: camera glyph (64×48, 4px stroke) + "Snap a Soul" (serif 30px). Pressed: `scale(.97)`. Accessible label "Take photo of a Soul".
  - Helper "Spotted one? Tap the big button, point, and shoot." (`--t-small`, ink-muted, centered).
  - After capture: success toast (forest-tint bg, radius 14, 28px forest check circle, Figtree 700 16, forest): "Photo saved. Mark it in Sightings." Auto-dismiss after ~2.2s.
- **Summary card** (margin 0 20px 16px, surface, radius 22, card shadow, padding 14px 16px): 64×64 last-photo thumbnail (radius 8) · "{n} Souls this week" (`--t-body` 700) over "2 pts behind 3rd place" (`--t-small` ink-muted).
- Tab bar, **Take photo** active.

**Behavior:** Camera button opens the device camera directly (not a picker sheet). On capture, upload the photo with timestamp and (if permitted) location, then show the toast. Upload states from the design system apply: uploading (progress bar), saved, failed ("Didn't send. Tap to try again", with the photo kept locally and retried automatically).

### 03 · Leaderboard (live)
**Purpose:** See live rankings for this week or all time.

**Layout:**
- Title block: kicker "NOV 9–15 · 23 PLAYERS · RESETS MONDAY" (all-time: "SINCE YOU JOINED · 23 PLAYERS"), title "Leaderboard".
- Segmented control: **This week** | **All time**.
- Scrollable list (padding 14px 20px 20px, gap 8). Row: min-height 56, radius 14, padding 8px 14px, gap 12:
  - Rank (serif `--t-h3`, ink-muted, 26px wide) · 40px avatar circle (initial, serif 18, cream on rotating forest/orange/ink-muted/ink) · name (`--t-body` 700, ellipsis) over "{n} Souls" (14px 500 ink-muted) · score (serif `--t-h2`, forest).
  - 1st place: gold-soft bg, 2px gold border.
  - Current user ("Name (you)"): forest-tint bg, 2px forest border. Takes priority over 1st-place styling.
  - Others: surface bg, transparent border.
- Tab bar, **Scores** active.

**Behavior:** Scores are live (subscribe to updates or refresh on focus). Weekly board resets Monday. Consider pinning the current user's row when it scrolls out of view.

### 04 · Sightings log
**Purpose:** Browse photo claims and their review status.

**Layout:**
- Title row: "Sightings" (serif `--t-h1`) · "{n} this week" (`--t-small` 600 ink-muted), then segmented control **Everyone** | **Just mine**. Bottom 2px gold rule.
- Scrollable list grouped by day. Day header: kicker (`--t-label`, orange), e.g. "TODAY · THU", "YESTERDAY · WED", followed by a 1px gold-soft line filling the row.
- Card: surface, radius 14, card shadow, padding 10, gap 12. 76×76 photo (radius 8) · name (`--t-small` 700) + time (13px ink-muted) on one row · description, e.g. "Alien Green · Trader Joe's lot" (14px ink-muted) · status chip (pill, padding 4px 10px, Figtree 700 13):
  - **+1 Counted**: forest-tint bg, forest text
  - **+2 Special**: gold-soft bg, ink text
  - **−1 False call**: orange-tint bg, orange-deep text
  - **Waiting for review**: cream-deep bg, ink-muted text
- Tab bar, **Sightings** active.

**Behavior:** Filter toggles between all players and the current user. Tapping a card should open a detail view (not designed) where the owner marks the claim as Regular or Special and picks a category: Alien Green, Racing stripes, Exterior graphics, Brown paint. The review flow for false calls is undecided.

## State Management
- `auth`: `{ status: 'signedOut' | 'linkSent' | 'signedIn', email, user }`
- `week`: `{ start, end, daysLeft }`, server-driven, resets Monday
- `me`: `{ weekPoints, weekCount, rank, totalPlayers, pointsBehindNext }`
- `leaderboard`: `{ period: 'week' | 'all', rows: [{ userId, name, score, count }] }`
- `sightings`: `{ filter: 'all' | 'mine', items: [{ id, userId, photoUrl, takenAt, place, category, status }] }`
- `uploadQueue`: pending photos with retry for offline/failure
- `settings.textSize`: `'standard' | 'large'`

## Assets
- **App icon** (built from shapes, so recreate it as a vector): forest rounded square (radius ≈ 22% of size), 1.5px gold inner rule inset ≈ 7%, cream Young Serif "S" centered (≈ 60% of size), orange dot top-right (≈ 13% of size). Sizes 180 / 120 / 60 / 40 are shown in the design system file.
- **Photos** are striped placeholders. Real images come from user uploads.
- **Icons** are drawn with CSS shapes. Replace them with an icon library (e.g. Lucide) of matching weight.
- **Fonts:** Young Serif and Figtree from Google Fonts (OFL).

## Files
- `Soul Search Weekly.dc.html`: **the four screens to build** (sign in, home, leaderboard, sightings). The source of truth.
- `Soul Hunt Design System.dc.html`: tokens, type scale, and base components (buttons, score badges, category chips, photo upload tile with all four states, tally stepper, alerts, text field, toggles, leaderboard row) and the app icon at all sizes.
- `support.js`: preview runtime only. Not part of the design.

Note: "Soul Hunt" in the design-system file header refers to a paused Thanksgiving variant. The tokens and components apply unchanged to Soul Search.
