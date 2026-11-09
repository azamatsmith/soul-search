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
   [ ] Shows the React PWA (Netlify), FastAPI (Render or Fly), Supabase Auth, Postgres and Storage, the Claude vision API, and the email provider for magic links
   [ ] Shows the main flows: magic-link login, photo upload, background verification, and pg_cron calling the weekly close-out endpoint
   [ ] Notes the local, staging and production environments Depends on: 1, 1b
2. Supabase project and schema
   Create the Supabase project and initial migrations. Tables: players (id = auth user id, display_name, is_admin), settings (green_only bool), sightings (player_id, photo_path, taken_at, status: pending/counted/rejected, flagged bool, verification_notes, challenge_id nullable, week_id), weeks (start, end, closed_at, results jsonb), challenges (name, starts_at, ends_at, rules jsonb).
   [ ] Migrations are checked in and reproducible
   [ ] Private storage bucket for photos
   [ ] RLS: players read all sightings and leaderboards, write only their own; admin can do everything Depends on: 1
3. Magic-link auth
   Supabase email magic links, using a custom SMTP provider (e.g. Resend), because the built-in sender is rate-limited. Long-lived sessions so players rarely log in again. Only pre-approved emails can sign in.
   [ ] Login screen with email field only
   [ ] Sessions persist on iOS home-screen PWA
   [ ] FastAPI validates Supabase JWTs Depends on: 2
4. PWA shell and Netlify deploy
   Manifest, icons and service worker so it installs to the iPhone home screen. Deploy web to Netlify.
   [ ] Installs and launches full-screen on iOS Safari
   [ ] Netlify deploys from main, with preview deploys on PRs Depends on: 1
5. FastAPI deploy
   Deploy api to Render or Fly, with health check, CORS for the Netlify domain, and secrets configured.
   [ ] /health is reachable in production
   [ ] Deploys from main Depends on: 1
6. Photo upload flow
   One big "I spotted one" button that opens the camera, uploads to Supabase Storage and creates a pending sighting. Must be dead simple for an older user.
   [ ] Two taps from home screen to submitted
   [ ] Clear confirmation after upload
   [ ] Sighting is tagged with active challenge_id if a challenge is running, otherwise week_id Depends on: 3, 4
7. Background photo verification
   FastAPI worker or background task that sends pending photos to the Claude vision API. Always check it's a Kia Soul, and check green when green_only is on. If the model is unsure, mark it counted and set flagged = true.
   [ ] Pending sightings get resolved without user waiting
   [ ] Result and model reasoning stored in verification_notes
   [ ] Unsure results count but are flagged
   [ ] Retries on API failure Depends on: 2, 5, 6
8. Sightings log and weekly leaderboard
   Show the current week's leaderboard (counted, non-challenge sightings only) and a log of every sighting with who, when, photo, status and flag.
   [ ] Leaderboard excludes challenge sightings
   [ ] Status updates appear without manual refresh, or on pull-to-refresh Depends on: 6, 7
9. Weekly close-out scheduled job
   Supabase pg_cron (via pg_net) calls a protected FastAPI endpoint. The endpoint works out the Pacific-time week boundary in code, handling daylight saving, closes the week, saves results to weeks.results and opens the next week. It must be idempotent.
   [ ] Runs every Sunday night Pacific, across DST changes
   [ ] Safe to run twice
   [ ] Endpoint protected by a shared secret Depends on: 2, 5
10. Past weeks' results
    Page listing closed weeks and their final standings.
    [ ] Shows winner and scores per week Depends on: 9
11. Admin: settings, players and overrides
    Admin-only screens (is_admin flag, just the owner for now): toggle green-only, add or remove players, view flagged sightings, overturn a verification result, manually adjust scores.
    [ ] Non-admins cannot reach admin routes or endpoints
    [ ] Flagged queue shows photo and model notes
    [ ] Overrides are recorded with who and when Depends on: 3, 7
12. Admin: special challenges
    Create timed challenges (e.g. a 4-hour Thanksgiving challenge) with a start, an end and flexible rules jsonb. During a challenge, sightings count only toward the challenge, never the weekly score. Each challenge has its own leaderboard.
    [ ] Admin can create, edit and delete challenges
    [ ] Rules are config-driven, not hard-coded (start with a green_only override)
    [ ] Challenge leaderboard page Depends on: 7, 11
    Later (not MVP)
    • Twilio/SMS or WhatsApp photo submission
    • Sister as second admin
