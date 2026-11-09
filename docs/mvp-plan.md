Soul Search MVP – GitHub Issues
Stack: React + Vite PWA on Netlify, FastAPI (Python) backend on Render or Fly, Supabase for auth, Postgres and photo storage, Claude vision API for verification. Weekly reset Monday 00:00, America/Los_Angeles. Twilio/SMS is out of scope for the MVP.
Each section below is one issue: title, description, acceptance criteria, dependencies. Create them in order.

1. Repo and project scaffolding
   Set up a monorepo with web/ (React + Vite + TypeScript) and api/ (FastAPI, Python 3.12, uv or Poetry). Add linting, formatting, a README and env templates.
   [ ] web and api both run locally with one command each
   [ ] .env.example files for both
   [ ] Basic CI runs lint and tests on PRs Depends on: none
   1b. Local dev and staging environments
   Three environments: local, staging and production. Local runs the Supabase CLI stack in Docker, plus FastAPI and Vite. Staging is a second free Supabase project, a staging FastAPI service, and Netlify preview or branch deploys pointed at it. Migrations are applied to staging before production.
   [ ] supabase start brings up the local stack, and migrations plus seed data (three test players) apply cleanly
   [ ] Separate env configs for local, staging and production; no shared secrets
   [ ] Staging Supabase project, staging API deploy (from a staging branch) and Netlify branch deploy wired together
   [ ] Staging uses a test email sender and its own storage bucket
   [ ] Documented flow: merge to staging, verify, then promote to main Depends on: 1
   1c. Architecture diagram
   Add a Mermaid architecture diagram to the README (or docs/architecture.md) so it renders on GitHub and stays versioned with the code. Keep it updated as later issues land.
   [ ] Shows the React PWA (Netlify), FastAPI (Render or Fly), Supabase Auth, Postgres and Storage, the Claude vision API, and the email provider for sign-in codes
   [ ] Shows the main flows: email-code login, photo capture and upload, background verification, and pg_cron calling the weekly close-out endpoint
   [ ] Notes the local, staging and production environments Depends on: 1, 1b
2. Supabase project and schema
   Create the Supabase project and initial migrations.
   Tables:
   - **players**: id = auth user id, display_name (unique ignoring case), is_admin, text_size (standard/large)
   - **allowed_emails**: pre-approved emails that may sign in, with joined status (joined player or not signed in yet)
   - **settings**: point values (Regular +1, Special +2, False call -1) and the special category list (Alien Green, Racing stripes, Exterior graphics, Brown paint); admins can edit both
   - **sightings**: player_id, photo_path, taken_at, claim_type (regular/special), categories (list), points, location (nullable GPS), status (waiting_review/counted/false_call), flagged bool, check_note (short, player-facing), verification_notes (full model reasoning, admin-facing), challenge_id nullable, week_id
   - **score_adjustments**: player_id, admin_id, period (week or challenge), change, reason (required), created_at
   - **audit_log**: admin_id, type (photo/score/emails/rules/challenge), target_id, before, after, reason, created_at
   - **weeks**: start, end, closed_at, results jsonb (full final standings)
   - **challenges**: name, starts_at, ends_at (exact times), rules jsonb (point values plus per-category bonuses, e.g. Brown paint +3)
   Points are stored on each sighting at send time, so changing the rules only affects new photos. Place names are out of scope; only raw GPS is stored.
   [ ] Migrations are checked in and reproducible
   [ ] Private storage bucket for photos
   [ ] RLS: players read all sightings and leaderboards, write only their own; admin can do everything
   [ ] Point values and categories live in settings, not in code
   [ ] Display names are unique ignoring case Depends on: 1
3. Email code auth
   Email sign-in with a 6-digit one-time code, following the Sign In design file. Uses a custom SMTP provider (e.g. Resend), because the built-in Supabase sender is rate-limited. A code is used instead of a magic link because on iOS a tapped link opens Safari, not the installed home-screen PWA, and they don't share a session. Long-lived sessions so players rarely log in again.
   Code checks go through FastAPI, because Supabase only rate-limits per IP and can't count wrong codes per email. FastAPI verifies the code with Supabase, counts tries per email and enforces the lockout.
   Also builds the Settings screen (from the Settings - History design file), since it holds profile and sign-out.
   [ ] 01: email field, "Email me a code", invite-only footnote
   [ ] 01b: allowlist is checked before a code is sent; unknown emails get "This email isn't on the list"
   [ ] 02: six code boxes drawn over one hidden input (inputmode numeric, autocomplete one-time-code) so iOS autofill and paste work; submits after the 6th digit
   [ ] 02b to 02e: checking, wrong code with tries left, expired code, and too many tries with a live countdown
   [ ] Codes expire after 10 minutes (Supabase OTP expiry 600 s)
   [ ] 5 wrong codes per email locks sign-in for 15 minutes, enforced server-side
   [ ] 03: display-name step on first sign-in; trimmed, 2 to 20 characters, letters, numbers, spaces and . ' -, unique ignoring case, with the 03b and 03c errors
   [ ] Settings: profile card, change name (same rules), sign out, and an Admin tools row with a flagged-photo badge for admins only
   [ ] Sessions persist on iOS home-screen PWA
   [ ] FastAPI validates Supabase JWTs Depends on: 2, 5
4. PWA shell and Netlify deploy
   Manifest, icons and service worker so it installs to the iPhone home screen. Deploy web to Netlify. Set up the design foundation every screen uses.
   [ ] Installs and launches full-screen on iOS Safari
   [ ] Netlify deploys from main, with preview deploys on PRs
   [ ] Design tokens (color incl. --c-camera, type, spacing, radius, tap targets, rules, shadow) implemented once as a theme and referenced everywhere
   [ ] Young Serif and Figtree loaded from Google Fonts
   [ ] Bottom tab bar (Take photo, Sightings, Scores) with icon and text label
   [ ] App icon built as a vector at all required sizes
   [ ] Large-text mode switches the type and tap-target tokens; it's a per-player setting toggled from Settings Depends on: 1
5. FastAPI deploy
   Deploy api to Render or Fly, with health check, CORS for the Netlify domain, and secrets configured.
   [ ] /health is reachable in production
   [ ] Deploys from main Depends on: 1
6. Photo capture flow
   Build the Photo Flow design file and the Home screen that launches it (Weekly design file, screen 02). One decision per screen; must be dead simple for an older user.
   [ ] 00a: first-use camera explanation shown before the iOS prompt, with Continue and Not now
   [ ] 00b: camera-denied screen with steps to re-enable (verify the iOS Settings path for the targeted iOS version), "Use the iPhone camera instead" (native capture input, continues at step 02) and "I turned it on. Try again"
   [ ] 01: custom full-screen viewfinder as designed, falling back to the native iOS camera if the camera API fails
   [ ] 02: "Use this photo" or "Take it again"
   [ ] 03: Regular or Special; Special requires at least one category; Send stays disabled until valid; no default selection
   [ ] Saves GPS location if the player allows it; no place name shown
   [ ] Photo is kept on the phone until the server confirms receipt; failed sends are queued and retried whenever the app is opened
   [ ] 05a: points awarded, weekly total, and the "We'll double-check the photo" note; 05b: "Try again now" and "OK, send it later"
   [ ] Home: week, days left, points, rank, summary card, and the avatar button that opens Settings
   [ ] Home empty ("No Souls yet this week", rank shown as a dash) and loading states; the camera button works while scores load
   [ ] Point values in copy (e.g. "Regular Souls are +1, special ones +2") come from settings, never hard-coded
   [ ] Sighting is tagged with active challenge_id if a challenge is running, otherwise week_id Depends on: 3, 4
7. Background photo verification
   FastAPI worker or background task that sends new sightings to the Claude vision API after the player taps Send. Points count as soon as the photo is sent; verification adjusts them afterwards.
   [ ] Pending sightings get resolved without the user waiting
   [ ] Checks that the photo is a Kia Soul and that the claimed special categories match
   [ ] Not a Soul: becomes a false call (-1, configurable) silently and appears in the admin Auto false calls list
   [ ] Unsure: still counts, flagged = true
   [ ] Claimed Special but looks like an ordinary Soul: keeps +2, flagged for admin review
   [ ] Stores a short plain-language note for players (e.g. "wasn't sure about the stripes") in check_note and the full model reasoning in verification_notes
   [ ] Retries on API failure Depends on: 2, 5, 6
8. Sightings log and weekly leaderboard
   Build the Leaderboard (screen 03) and Sightings log (screen 04) from the Weekly design file, the sighting photo viewer (Settings - History file, 05 to 05c) and their empty, loading and error states.
   [ ] Leaderboard toggles This week and All time; This week never includes challenge points, All time includes weekly and challenge points
   [ ] Leaderboard excludes challenge sightings
   [ ] Current player's row is highlighted; 1st place has its own style
   [ ] "See past weeks" button after the list
   [ ] Sightings log toggles Everyone and Just mine, grouped by day
   [ ] Status chips: +1 Counted, +2 Special, Flagged for a second look (orange border, visible to players), -1 False call, Waiting to send (dashed), plus a challenge tag on challenge photos
   [ ] Tapping a card opens the photo full screen (pinch to zoom) with name, time, claim, chip, and the flagged or false-call note; no edit actions
   [ ] Loading placeholders (pulse skipped under reduced motion), empty states and the shared error state with Try again
   [ ] Scores and statuses update without manual refresh, or on pull-to-refresh Depends on: 6, 7
9. Weekly close-out scheduled job
   Supabase pg_cron (via pg_net) calls a protected FastAPI endpoint. The endpoint works out the Pacific-time week boundary in code, handling daylight saving, closes the week, saves results to weeks.results and opens the next week. It must be idempotent.
   [ ] Each week runs Monday 00:00 to the next Monday 00:00 Pacific, across DST changes; the job runs just after that boundary
   [ ] Safe to run twice
   [ ] Endpoint protected by a shared secret
   [ ] Saves full final standings, so Past weeks can show every player's rank and points
   [ ] A week that overlaps a challenge closes normally with only its non-challenge points Depends on: 2, 5
10. Past weeks' results
    Past weeks screens from the Settings - History design file (03 and 04), reached from "See past weeks" on the Leaderboard. Challenge results are not shown here; they live in the challenges list.
    [ ] 03: closed weeks newest first; each card has the dates, winner avatar, name and score, and your result ("You: 2nd · 18 pts" or "You won this week!")
    [ ] 04: one past week with "{winner} won" and final standings in leaderboard rows Depends on: 9
11. Admin: settings, players and overrides
    Admin tools from the Admin design file, reached from the Admin tools row in Settings (admins only). Every action writes to the change history.
    [ ] Non-admins cannot reach admin routes or endpoints
    [ ] A1: admin home with Flagged photos (badge), Challenges, Points & categories, Allowed emails, Adjust a score, Change history
    [ ] A2: Flagged and Auto false calls tabs; cards show photo, player, time, claim, the model's note and current points
    [ ] A3: review flagged photos (Keep the claim, Change to Regular, Mark as false call) and auto false calls (Restore as Regular, Restore as Special, Keep false call)
    [ ] A4: edit point values with steppers and add or remove categories; changes apply to new photos only
    [ ] A5: add or remove allowed emails, with Joined or Not signed in yet status; no invite email is sent
    [ ] A6: adjust a player's score with a required reason
    [ ] A7: change history, newest first, filterable to scores only, recording who, what and when Depends on: 3, 7
12. Admin: special challenges
    Timed challenges from the Challenges design file (e.g. a 4-hour Thanksgiving challenge). Each has an exact start and end time, plus rules jsonb (point values and per-category bonuses). While a challenge runs, new photos count toward the challenge instead of the week. Each challenge has its own leaderboard. Challenge points count toward All time, never toward the week.
    [ ] C1: admin list with + New challenge, Running now, Coming up and Finished ("Won by ..."); cards show the exact time range
    [ ] C2: create and edit with name, start and end each as a date picker plus a time picker (Pacific, stored as UTC), a live duration line ("Runs 4 hours"), validation that the end is after the start, rule steppers starting from the weekly rules, and per-category bonuses
    [ ] Time-left copy follows the design rule everywhere (Home header, C1 chips, leaderboard kicker): days left over 24 h, hours left from 1 to 24 h, minutes under 1 h; weekday only when the end isn't today
    [ ] Admin can delete a challenge
    [ ] Rules are config-driven, not hard-coded
    [ ] C3 and C3b: Home shows challenge kicker, time left, challenge points and rank, and the orange banner, including the short-challenge version
    [ ] C4 and C5: photo flow shows "Counts toward {challenge}" and challenge point values, including bonus chips
    [ ] C6: challenge leaderboard replaces This week while it runs, with a rules strip
    [ ] C7: Sightings day headers and challenge tags show the challenge name Depends on: 7, 11
    Later (not MVP)
    • Twilio/SMS or WhatsApp photo submission
    • Sister as second admin
