# Handoff: Soul Search (weekly Kia Soul spotting app)

## Overview
Soul Search is a mobile app (installed to the iOS home screen) for an **invite-only** group of players. Only emails on an admin-managed allowlist can sign in. Players spot Kia Souls anywhere during the week, photograph them, and compete on a live leaderboard that resets every Monday. Admins can also run time-boxed **challenges** with their own rules.

One audience consideration drives many decisions: **an older, less tech-confident player** must be able to use it. Large tap targets, high contrast, plain-English labels, and icon + text navigation are requirements, not nice-to-haves.

## Product decisions (Nov 8, 2026)
- **Sign-in uses a 6-digit email code**, not a magic link. On iOS a tapped link opens Safari, not the home-screen app, and the two don't share a login. Code expiry: **10 minutes** (Supabase OTP expiry = 600 s). Lockout after 5 wrong codes, for 15 minutes.
- **Invite-only.** Allowlist owners named in error copy: "Matthew or Heathyr".
- **Scoring is confirmed:** Regular **+1**, Special **+2** (a car in several categories still earns +2 total), False call **−1**. Admins can edit these values.
- **Hybrid verification.** Points count the moment a photo is sent. A background photo check (Claude) then reviews it:
  - Not a Soul → becomes a −1 false call (it appears in the admin "Auto false calls" list, where it can be overturned).
  - Unsure → still counts, flagged.
  - Doubtful Special → keeps +2, flagged for an admin.
  - **Players can see flags.** A false call changes the sighting's chip only; there's no notice or push.
- **Where/place is deferred** for the MVP. Save GPS if allowed; show no place name anywhere.
- **Challenges** have exact start/end times (Pacific), so they can last hours or days. While one runs, new photos count toward the challenge **instead of** the week. **Confirmed:** the weekly board is paused for the challenge dates.

## About the Design Files
The files in this bundle are **design references created in HTML**. They are prototypes that show the intended look and behavior, not production code to copy. Recreate them in the target codebase using its patterns and libraries. Open the `.dc.html` files directly in a browser. `support.js` is only the preview runtime; ignore it for implementation.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and copy are final unless noted. Mock data (names, counts, dates) is placeholder.

## Design Tokens
Defined once as CSS variables in every HTML file (`:root`). Implement them as a theme object or tokens file and reference them everywhere; don't hard-code values.

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

Extra tokens: `--c-camera` `#16110D` (camera and photo viewer background), `--stripes-dark` (dark image placeholder).

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

### Sign in: `Soul Search Sign In.dc.html` (#5)
- **01 Enter email**: brand block, email input (72px, `type=email`, `autocomplete=email`), helper "We'll email you a 6-digit code. Type it in here to sign in. No password to remember.", primary **"Email me a code"**, footnote "Soul Search is invite-only."
- **01b Email not on the list**: input in the error style (orange border + orange-tint ring) and an error alert: "This email isn't on the list." / "Ask Matthew or Heathyr to add you, then try again." Check the allowlist **before** sending a code.
- **02 Enter code**: kicker "STEP 2 OF 2", title "Check your email", "We sent a 6-digit code to **{email}**." Code field = **6 boxes (flex, gap 8, 68px tall, radius 14, serif 34px digits) drawn over ONE hidden `<input inputmode="numeric" autocomplete="one-time-code" maxlength="6">`**, so iOS QuickType autofill ("From Mail") and paste both work. The active box has a 3px forest border, focus ring and caret; filled boxes have a forest border. **It submits on its own after the 6th digit**, so there's no Sign in button. Helper: "The code works for 10 minutes. Check spam if you don't see it." Text link "Use another email". The "Open email app" button was removed.
- **02b Checking**: boxes muted (cream-deep, read-only), status bar "Checking your code…" with the small rolling car (see Loading) on forest-tint.
- **02c Wrong code**: boxes with orange borders, alert "That code isn't right." / "Check the email and try again. 3 tries left." Buttons: Send a new code · Use another email. Clear the boxes on the next keypress.
- **02d Code expired**: title "That code expired", alert "Codes only work for 10 minutes.", primary **"Email me a new code"**.
- **02e Too many tries**: title "Too many tries", alert "Please wait 15 minutes. For safety, sign-in is paused after 5 wrong codes.", disabled button with a live countdown "Try again in mm:ss".
- **03 Display name** (first sign-in only): kicker "Welcome!", "What should we call you?", "This is how other players see you on the leaderboard.", input + helper "2 to 20 characters. You can change it later in Settings.", primary **"Let's go"**.
  - Validation: trim; 2–20 characters; letters, numbers, spaces and `. ' -`; **unique, ignoring case**. Errors: 03b "Someone already goes by “Mom”. Try adding a last initial, like “Mom K.”"; 03c "Names need at least 2 characters." (button disabled).

### Home: `Soul Search Weekly.dc.html` (screen 02)
**Purpose:** The one big action: photograph a Soul. Also shows this week's standing.

**Layout:**
- **Forest header** (bg `--c-forest`, status bar included, 3px gold bottom border, padding 4px 24px 22px):
  - Row: left column kicker "WEEK OF NOV 9–15" over "3 days left"; right: **avatar button** (56px circle, forest-deep fill, 2px gold border, serif initial). It opens **Settings**. Accessible label "Settings and profile".
  - Row (align end): left: "Your points" (`--t-small`, gold-soft) over the number (serif 56px, lh 1.1, gap 6). Right: "Rank" over "4th" (serif `--t-h1`) + " of 23" (`--t-small` gold-soft).
- **Center** (flex:1, centered, gap 20):
  - **Camera button**: 250×250 circle, orange bg, cream content. Box-shadow: `0 0 0 10px #F8E2D2, 0 0 0 12px #E6D5AC, inset 0 -6px 0 #943E13, 0 14px 30px rgba(148,62,19,.35)`. Contents: camera glyph (64×48, 4px stroke) + "Snap a Soul" (serif 30px). Pressed: `scale(.97)`. Accessible label "Take photo of a Soul".
  - Helper "Spotted one? Tap the big button, point, and shoot." (`--t-small`, ink-muted, centered).
- **Summary card** (margin 0 20px 16px, surface, radius 22, card shadow, padding 14px 16px): 64×64 last-photo thumbnail (radius 8) · "{n} Souls this week" (`--t-body` 700) over "2 pts behind 3rd place" (`--t-small` ink-muted).
- Tab bar, **Take photo** active.

**Behavior:** The camera button (and the Take photo tab) starts the **Photo flow** below. The old "Photo saved" toast and inline upload states are replaced by that flow.


### Leaderboard: `Soul Search Weekly.dc.html` (screen 03)
**Purpose:** See live rankings for this week or all time.

**Layout:**
- Title block: kicker "NOV 9–15 · 23 PLAYERS · RESETS MONDAY" (all-time: "SINCE YOU JOINED · 23 PLAYERS"), title "Leaderboard".
- Segmented control: **This week** | **All time**.
- Scrollable list (padding 14px 20px 20px, gap 8). Row: min-height 56, radius 14, padding 8px 14px, gap 12:
  - Rank (serif `--t-h3`, ink-muted, 26px wide) · 40px avatar circle (initial, serif 18, cream on rotating forest/orange/ink-muted/ink) · name (`--t-body` 700, ellipsis) over "{n} Souls" (14px 500 ink-muted) · score (serif `--t-h2`, forest).
  - 1st place: gold-soft bg, 2px gold border.
  - Current user ("Name (you)"): forest-tint bg, 2px forest border. Takes priority over 1st-place styling.
  - Others: surface bg, transparent border.
- After the list: secondary button **"See past weeks ›"** (56px) → Past weeks.
- Tab bar, **Scores** active.

**Behavior:** Scores are live (subscribe to updates or refresh on focus). Weekly board resets Monday. Consider pinning the current user's row when it scrolls out of view.


### Sightings log: `Soul Search Weekly.dc.html` (screen 04) (#10)
- Title row "Sightings" + "{n} this week", segmented **Everyone | Just mine**, list grouped by day (orange kicker "TODAY · THU" + thin gold line).
- Card: 76px photo · name + time · description ("Special · Alien Green", "Regular", "Photo check: not a Kia Soul") · status chip (pill, 3px 10px padding, 2px border, Figtree 700 13):
  - **+1 Counted**: forest-tint bg, forest text
  - **+2 Special**: gold-soft bg, ink text
  - **+2 · Flagged for a second look** (or +1 · …): surface bg, **2px orange border**, orange-deep text. Visible to players.
  - **−1 False call**: orange-tint bg, orange-deep text. A sighting changes to this silently if the photo check decides it's not a Soul.
  - **Waiting to send**: cream bg, **2px dashed ink-muted border**, ink-muted text. The photo is still on the phone.
  - **Challenge tag** (e.g. "Brown Week"): orange bg, cream text, shown next to the points chip.
- **Tapping a card opens the photo full screen** (see Sighting photo). There are no edit actions.

### Photo flow: `Soul Search Photo Flow.dc.html` (#8, #9)
- **00a Camera access (first time only)**: shown before iOS asks. Camera glyph, "Soul Search needs your camera", "So you can take photos of the Souls you spot. We only use it when you tap Take photo.", "Next, your iPhone will ask. Tap **Allow**." Primary **Continue** (triggers the iOS prompt), text button "Not now".
- **00b Camera is turned off** (permission denied): numbered steps "Open the Settings app" → "Tap Apps, then Safari" → "Tap Camera and choose Allow" → "Come back here and try again". (Verify the path for the iOS version you target; home-screen web apps inherit Safari's camera setting.) Primary **"Use the iPhone camera instead"** opens the native camera (`<input type="file" accept="image/*" capture="environment">`) and continues at step 02. It needs no design of its own. Secondary "I turned it on. Try again".
Screens, in order:
1. **01 Camera**: full-screen, background `#16110D`. Top hint pill: "Fit the whole car in the frame" (rgba(255,252,245,.12) bg, Figtree 700 16). Viewfinder fills the space (margin 0 12, radius 22) with four gold corner brackets (40×40, 4px `#C9A35A`, inset 22% top/bottom, 9% sides). Bottom bar is a 3-column grid: **Cancel** (min 56×96, 2px rgba(255,252,245,.4) border) · **shutter** (96px circle, orange fill, 6px cream border, outer ring) · empty. Cancel returns Home.
2. **02 Check the photo**: kicker "STEP 1 OF 2", title "Can you see the Soul?". Photo preview fills remaining height (radius 22, 2px gold-soft border). Helper "Make sure the whole car is in the photo and not blurry." Primary **"Use this photo"** (72px) → 03; secondary **"Take it again"** (56px) → 01.
3. **03 What did you find?**: header row with 64px thumbnail + kicker "STEP 2 OF 2" + serif `--t-h2` title. Two radio cards (min-height 88, radius 22, padding 14×16): **Regular Soul** "Any color not listed below" with forest **+1** badge, and **Special Soul** "Alien Green, racing stripes, graphics or brown" with ink/gold-soft **+2** badge. Selected: 3px forest border, forest-tint bg, filled radio. Unselected: 2px gold-soft border, surface bg.
   - If Special: "What makes it special? Pick any" + multi-select chips (Alien Green, Racing stripes, Exterior graphics, Brown paint; min-height 56, pill; selected = forest fill/cream text) + note "Brown means brown: champagne, pale gold and beige don't count." A car in several categories still earns +2 total.
   - Sticky footer (surface bg, 2px gold top rule): primary button. Disabled (`--c-cream-deep` bg, ink-muted text) with label "Pick what makes it special" until valid; enabled label "Send · +1 point" / "Send · +2 points". Footnote: "Not a Soul after all? Wrong calls cost 1 point." **The Where row was removed** (deferred).
   - Valid = Regular selected, OR Special + at least one category. No default selection in production (the mock preselects Special + Alien Green to demonstrate).
4. **04 Sending**: centered 200px photo, "Sending your photo…" (serif `--t-h1`), 14px progress bar (forest on cream-deep) with the rolling car riding on top at the current percent (wheels turning), "Keep the app open. This usually takes a few seconds."
5. **05a Saved**: full forest background. 96px cream circle with forest check (8px gold halo), kicker "SPECIAL SOUL SAVED" / "SOUL SAVED", points in serif 72px ("+2"), "You have {n} points this week." plus a note: "We'll double-check the photo. If it isn't a Kia Soul, it becomes a −1 in Sightings." (rgba(255,252,245,.1) panel) Buttons: orange **"Snap another Soul"** → 01; gold-outline **"Done"** → Home.
6. **05b Didn't send**: orange 96px "!" circle, "Your photo didn't send", "Don't worry, it's saved on this phone. We'll send it on our own when you have signal." Buttons: **"Try again now"** (primary) · **"OK, send it later"** (secondary → Home; the claim appears in Sightings as "Waiting to send").

**Behavior notes:** Request camera permission on first use with a plain-language explanation. Keep the captured photo locally until the server confirms receipt. Categories are **multi-select** and chosen during capture. Save GPS with the photo if allowed. Send triggers the background photo check.


### Settings, past weeks, sighting photo: `Soul Search Settings - History.dc.html` (#5, #6, #12)
- **01 Settings** (from the Home avatar): back "‹ Home", profile card (56px avatar, serif name, email), list: **Your name** › (opens 02) and **Large text** toggle ("Bigger words and buttons"; switches the type/tap tokens to large mode). Bottom: **Sign out** (orange outline). Version footnote.
- **01b Settings for admins**: adds a section labeled "ONLY ADMINS SEE THIS" with **Admin tools** › and a count badge of flagged photos.
- **02 Change your name**: same rules as first sign-in; primary "Save name".
- **03 Past weeks** (from Leaderboard): cards newest first. Each card: date kicker, winner avatar + name + score, and a line with your result ("You: 2nd · 18 pts" or "You won this week!" in forest).
- **04 One past week**: "Final · Nov 2–8", title "{winner} won", final standings in leaderboard rows.
- **05 / 05b / 05c Sighting photo**: full-screen dark viewer (`--c-camera`), **Close** button (56px), photo (pinch to zoom), bottom cream sheet with name, time, claim, status chip. Flagged adds a note: "Our photo check wasn't sure about the stripes. The +2 still counts while an admin takes a look." False call adds an orange note: "Our photo check says this isn't a Kia Soul, so it counts as −1."

### Empty, loading and error states: `Soul Search Empty - Error States.dc.html` (#8, #10)
- **Home · no Souls yet**: points 0, rank shows small text "Snap a Soul to get ranked" over "23 players" (not a dash, which read as missing data), card "No Souls yet this week" / "Your first one is out there. Regular Souls are +1, special ones +2."
- **Home · loading**: header placeholders in forest-deep, with the dark shimmer. The camera button works while scores load.
- **Lists · loading**: gray placeholder rows/cards (`--c-cream-deep`) in the real layout; shimmer sweep, 1.6s linear, left to right (skip it if reduced motion is on).
- **Empty**: dashed gold circle with a serif "S", serif title, body text, orange **"Take a photo"**. Leaderboard: "No scores yet this week" / "Nobody has spotted a Soul since Monday. The first photo puts you on top." Sightings: "No sightings yet" / "Photos from everyone in the group show up here as soon as they're sent."
- **Error** (same everywhere): error alert "Couldn't load {the scores | sightings}" / "Check your Wi-Fi or signal, then try again. Your photos are safe." + primary **Try again**.

### Admin: `Soul Search Admin.dc.html` (#13)
Entry: **Admin tools** row in Settings, admins only. Every action writes to the change history.
- **A1 Admin tools**: rows for Flagged photos (badge), Challenges, Points & categories, Allowed emails, Adjust a score, Change history.
- **A2 Flagged photos**: segmented **Flagged (n) | Auto false calls (n)**. Card: photo, player, time, "Claimed: …", the model's note in quotes, chip "Counting +2 for now".
- **A3 Review**: big photo, "Player's claim" card, "Photo check notes" card, then three full-width actions (72px): **Keep the claim · +2** (forest; clears the flag / overturns), **Change to Regular · +1** (gold border), **Mark as false call · −1** (orange border). For auto false calls the same screen offers **Restore as Regular +1 / Restore as Special +2 / Keep false call**.
- **A4 Points & categories**: steppers for Regular, Special and False call; list of categories with Remove; "+ Add a category"; note "Changes apply to new photos from now on. Past points stay the same."; sticky **Save changes**.
- **A5 Allowed emails**: add field + **Add to the list**; note that no invite email is sent; list with status ("Joined · {name}" or "Not signed in yet") and Remove.
- **A6 Adjust a score**: player picker, "Points now 8 → 11", stepper "Change by", **required** reason (admins only see it), sticky **Save · {name} +3**.
- **A7 Change history**: newest first, filter **Everything | Scores only**. Row: admin avatar, "**Matthew** changed …", type chip (Photo / Score / Emails / Rules / Challenge) and time.

### Challenges: `Soul Search Challenges.dc.html` (#14)
- **C1 Admin list**: **+ New challenge**, then "Running now" (2px orange border card, chip "Live · ends 6:00 pm · 3 hours left"), "Coming up" (chip "Starts Thu 9:00 am · in 3 days") and "Finished" ("Won by …"). Card subtitle shows the exact range, e.g. "Thu Nov 26, 2:00 – 6:00 pm".
- **C2 Create / edit**: Name; **Starts** and **Ends** each have a date picker (flex 3) next to a time picker (flex 2), both 72px. **Exact times in Pacific (America/Los_Angeles)**, stored as UTC. Under them: "All times Pacific" plus a live duration ("Runs 4 hours" / "Runs 3 days, 15 hours"). Validate that Ends is after Starts. Note "While it runs, new photos count toward the challenge instead of the week."; C2b shows a 4-hour "Thanksgiving Dash" (Thu Nov 26, 2:00–6:00 pm); steppers starting from the weekly rules + per-category bonus rows ("Brown paint +3"), "+ Add a category bonus", **Save challenge**.
- **Time-left copy rule** (Home header, C1 chips, leaderboard kicker): more than 24 h left → "Ends Sun 11:59 pm · 2 days left"; 1–24 h → "Ends 6:00 pm · 3 hours left"; under 1 h → "Ends 6:00 pm · 45 min left". Use the weekday only when the end isn't today. Lowercase am/pm, Pacific time. Starts use the same pattern ("Starts Thu 9:00 am · in 3 days").
- **C3 Home while running**: header kicker "CHALLENGE · BROWN WEEK", "Ends Sun 11:59 pm · 2 days left" (C3b short version: "Ends 6:00 pm · 3 hours left", banner "Alien Green Souls are worth +3 until 6:00 pm today. After that, photos count toward your week again."), "Challenge points", challenge rank; **orange banner** under the header: "Brown Week is on" / "Brown Souls are worth +3. Photos count toward the challenge until Sun 11:59 pm. Weekly scores pick up again after that."
- **C4 Photo step 2**: orange-tint strip "Counts toward Brown Week"; point badges and the Send label show challenge values; a bonus category chip shows its points ("+3").
- **C5 Saved**: kicker "BROWN SOUL SAVED", "+3", "You have 9 Brown Week points."
- **C6 Challenge leaderboard**: segmented **{Challenge} | All time** (it replaces "This week" while running), rules strip "Rules: Regular +1 · Special +2 · Brown paint +3 · False call −1", rows, See past weeks.
- **C7 Sightings**: day header says "· Brown Week"; challenge photos get the orange challenge tag.

### Loading
Two patterns, one for each kind of wait. Both are in `Soul Hunt Design System.dc.html` (section 06).
- **Rolling car** (network waits with no layout to show: checking a sign-in code, sending a photo, any full-screen wait). A small boxy car (inline SVG, 64×44 viewBox: `--c-forest` body, `--c-forest-tint` windows, `--c-ink` wheels with `--c-gold-soft` hub bars, `--c-orange` tail light) on a 3px dashed `--c-gold` road. It drives left to right across its container in 2.4s ease-in-out, looping; wheels rotate every 0.5s. Inline size: 40×28 car on a 96×34 road. When progress is known (Sending), don't loop: position the car at the progress value on top of the progress bar. It's a generic car, not any real model; keep it that way. Always pair it with a visible text label and `role="status"`; the car itself is `aria-hidden`.
- **Shimmer** (lists and cards whose layout is known: Leaderboard, Sightings, Home header). Placeholders in `--c-cream-deep` (`--c-forest-deep` on the green header) in the real layout, with a lighter band (`#FBF6EC`, or `#24533A` on dark) sweeping left to right, 1.6s linear, infinite.
- **Reduced motion** (`prefers-reduced-motion: reduce`): the car parks centered with still wheels; placeholders don't move. Labels stay.
- Animate with `transform` in production (the prototypes animate `left` for simplicity).

## State Management
- `auth`: `{ status: 'signedOut' | 'notAllowed' | 'codeSent' | 'checking' | 'wrongCode' | 'expired' | 'lockedOut' | 'needsName' | 'signedIn', email, triesLeft, lockedUntil, user }`
- `user`: `{ id, displayName, email, isAdmin, settings: { textSize: 'standard' | 'large' } }`
- `period`: the active week or challenge `{ type: 'week' | 'challenge', id, name, start, end, rules }`
- `me`: `{ points, count, rank, totalPlayers, pointsBehindNext }` for the active period
- `leaderboard`: `{ period: 'current' | 'all', rows, status: 'loading' | 'ready' | 'empty' | 'error' }`
- `pastWeeks`: `[{ start, end, winner, winnerPoints, myRank, myPoints }]`
- `sightings`: `{ filter: 'all' | 'mine', status, items: [{ id, userId, photoUrl, takenAt, gps?, kind: 'regular' | 'special', categories: [], points, state: 'pendingUpload' | 'counted' | 'flagged' | 'falseCall', checkNotes, challengeId? }] }`
- `capture`: `{ step: 'permission' | 'denied' | 'camera' | 'review' | 'classify' | 'sending' | 'saved' | 'failed', photo, kind, categories }`
- `uploadQueue`: photos stored locally until the server confirms; auto-retry
- Admin: `rules { regular, special, falseCall, categories[] }`, `allowlist[]`, `flagQueue[]`, `autoFalseCalls[]`, `auditLog[{ adminId, type, targetId, before, after, reason, at }]`, `challenges[]`

## Assets
- **App icon** (built from shapes, so recreate it as a vector): forest rounded square (radius ≈ 22% of size), 1.5px gold inner rule inset ≈ 7%, cream Young Serif "S" centered (≈ 60% of size), orange dot top-right (≈ 13% of size). Sizes 180 / 120 / 60 / 40 are shown in the design system file.
- **Photos** are striped placeholders. Real images come from user uploads.
- **Icons** are drawn with CSS shapes. Replace them with an icon library (e.g. Lucide) of matching weight.
- **Fonts:** Young Serif and Figtree from Google Fonts (OFL).

## Files
- `Soul Search Sign In.dc.html`: email, allowlist error, 6-digit code and its states, display name.
- `Soul Search Weekly.dc.html`: Home, Leaderboard, Sightings.
- `Soul Search Photo Flow.dc.html`: camera permission, camera → check → classify → sending → saved / didn't send.
- `Soul Search Settings - History.dc.html`: Settings (player and admin), change name, past weeks, sighting photo.
- `Soul Search Empty - Error States.dc.html`: empty, loading and error states.
- `Soul Search Admin.dc.html`: admin tools.
- `Soul Search Challenges.dc.html`: challenge admin and the player experience while one runs.
- `Soul Hunt Design System.dc.html`: tokens, base components, app icon. ("Soul Hunt" is a paused Thanksgiving variant; the tokens apply unchanged.)
- `support.js`: preview runtime only.
