Soul Search MVP – GitHub Issues
Stack: React + Vite PWA on Netlify, FastAPI (Python) backend on Render or Fly, Supabase for auth, Postgres and photo storage, Claude vision API for verification. Weekly reset Sunday night, America/Los_Angeles. Twilio/SMS is out of scope for the MVP.
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
   Create the Supabase project and initial migrations. Tables: players (id = auth user id, display_name, is_admin, text_size: standard/large), allowed_emails (pre-approved sign-in emails), settings (point values: regular +1, special +2, false call -1, all placeholders; special category list: Alien Green, Racing stripes, Exterior graphics, Brown paint), sightings (player_id, photo_path, taken_at, claim_type: regular/special, categories list, points, location nullable GPS, status: waiting_review/counted/false_call, flagged bool, verification_notes, challenge_id nullable, week_id), weeks (start, end, closed_at, results jsonb), challenges (name, starts_at, ends_at, rules jsonb). Place names are out of scope for now; only raw GPS is stored.
   [ ] Migrations are checked in and reproducible
   [ ] Private storage bucket for photos
   [ ] RLS: players read all sightings and leaderboards, write only their own; admin can do everything
   [ ] Point values and categories live in settings, not in code Depends on: 1
3. Email code auth
   Supabase email one-time codes (6 digits) entered in the app, using a custom SMTP provider (e.g. Resend), because the built-in sender is rate-limited. A code is used instead of a magic link because on iOS a tapped link opens Safari, not the installed home-screen PWA, and they don't share a session. Long-lived sessions so players rarely log in again. Only pre-approved emails can sign in. Follows design screen 01; State B ("Check your email") still shows the magic-link version and needs a design update for code entry.
   [ ] Login screen with email field only, matching the design
   [ ] Inline error for an invalid email format
   [ ] "Send again" has a 60s cooldown with the countdown in the button label
   [ ] Expired or wrong code shows a clear message and a way to send a new one
   [ ] Emails not on the allowlist cannot sign in
   [ ] First sign-in asks for a display name (needs design)
   [ ] Sessions persist on iOS home-screen PWA
   [ ] FastAPI validates Supabase JWTs Depends on: 2
4. PWA shell and Netlify deploy
   Manifest, icons and service worker so it installs to the iPhone home screen. Deploy web to Netlify. Set up the design foundation every screen uses.
   [ ] Installs and launches full-screen on iOS Safari
   [ ] Netlify deploys from main, with preview deploys on PRs
   [ ] Design tokens (color, type, spacing, radius, tap targets, rules, shadow) implemented once as a theme and referenced everywhere
   [ ] Young Serif and Figtree loaded from Google Fonts
   [ ] Bottom tab bar (Take photo, Sightings, Scores) with icon and text label
   [ ] App icon built as a vector at all required sizes
   [ ] Large-text mode as a per-player setting that bumps type tokens and tap targets Depends on: 1
5. FastAPI deploy
   Deploy api to Render or Fly, with health check, CORS for the Netlify domain, and secrets configured.
   [ ] /health is reachable in production
   [ ] Deploys from main Depends on: 1
6. Photo capture flow
   Build the photo flow from the Photo Flow design: camera, check the photo, "What did you find?", sending, then saved or didn't send. One decision per screen; must be dead simple for an older user. Also build the Home screen (screen 02) that launches it.
   [ ] Custom full-screen viewfinder as designed, falling back to the native iOS camera if the camera API or permission fails
   [ ] Camera permission is requested on first use with a plain-language explanation
   [ ] Check step: "Use this photo" or "Take it again"
   [ ] Classify step: Regular or Special; Special requires at least one category; Send stays disabled until valid; no default selection
   [ ] Saves GPS location if the player allows it (the Where row and Change link are deferred)
   [ ] Photo is kept on the phone until the server confirms receipt; failed sends are queued and retried whenever the app is opened
   [ ] Saved screen shows points awarded and the weekly total; Didn't send screen offers "Try again now" and "OK, send it later"
   [ ] Home shows week, days left, points, rank and the summary card
   [ ] Sighting is tagged with active challenge_id if a challenge is running, otherwise week_id Depends on: 3, 4
7. Background photo verification
   FastAPI worker or background task that sends new sightings to the Claude vision API after the player submits a claim. Points count as soon as the photo is sent; verification adjusts them afterwards.
   [ ] Pending sightings get resolved without the user waiting
   [ ] Checks that the photo is a Kia Soul and that the claimed special categories match
   [ ] Not a Soul: marked false call (-1, configurable)
   [ ] Unsure: still counts, flagged = true
   [ ] Claimed Special but looks like an ordinary Soul: keeps +2, flagged for admin review
   [ ] Result and model reasoning stored in verification_notes
   [ ] Retries on API failure Depends on: 2, 5, 6
8. Sightings log and weekly leaderboard
   Build the Leaderboard (screen 03) and Sightings log (screen 04). The weekly leaderboard uses non-challenge sightings only.
   [ ] Leaderboard toggles This week and All time
   [ ] Leaderboard excludes challenge sightings
   [ ] Current player's row is highlighted; 1st place has its own style
   [ ] Sightings log toggles Everyone and Just mine, grouped by day
   [ ] Status chips: +1 Counted, +2 Special, -1 False call, Waiting for review, and Waiting to send for photos still on the phone
   [ ] Scores and statuses update without manual refresh, or on pull-to-refresh Depends on: 6, 7
9. Weekly close-out scheduled job
   Supabase pg_cron (via pg_net) calls a protected FastAPI endpoint. The endpoint works out the Pacific-time week boundary in code, handling daylight saving, closes the week, saves results to weeks.results and opens the next week. It must be idempotent.
   [ ] Runs every Sunday night Pacific, across DST changes
   [ ] Safe to run twice
   [ ] Endpoint protected by a shared secret Depends on: 2, 5
10. Past weeks' results
    Page listing closed weeks and their final standings.
    [ ] Shows winner and scores per week Depends on: 9
11. Admin: settings, players and overrides
    Admin-only screens (is_admin flag, just the owner for now): edit point values and special categories, manage the email allowlist, view flagged sightings, overturn a verification result, manually adjust scores.
    [ ] Non-admins cannot reach admin routes or endpoints
    [ ] Point values and categories are editable without a deploy
    [ ] Admin can add or remove allowed emails
    [ ] Flagged queue shows photo and model notes, including disputed Special claims
    [ ] Admin can downgrade a disputed Special claim to +1
    [ ] Overrides are recorded with who and when Depends on: 3, 7
12. Admin: special challenges
    Create timed challenges (e.g. a 4-hour Thanksgiving challenge) with a start, an end and flexible rules jsonb. During a challenge, sightings count only toward the challenge, never the weekly score. Each challenge has its own leaderboard.
    [ ] Admin can create, edit and delete challenges
    [ ] Rules are config-driven, not hard-coded (start with point-value and category overrides)
    [ ] Challenge leaderboard page Depends on: 7, 11
    Later (not MVP)
    • Twilio/SMS or WhatsApp photo submission
    • Sister as second admin
