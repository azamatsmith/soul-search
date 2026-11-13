# Architecture

Soul Search is an installable phone web app (PWA) for iPhone and Android backed by a FastAPI service and Supabase. The PWA talks to FastAPI for everything except keeping its session fresh, which supabase-js does directly with Supabase Auth, and loading photos, which it fetches straight from Supabase Storage through short-lived signed links that FastAPI hands out. FastAPI is the only part that reads and writes data and talks to the Claude vision API.

Built so far: sign-in, both deploys, photo capture with an offline send queue, scoring, the weekly leaderboard and past weeks, the sightings log, background photo verification, the weekly close-out, timed challenges and the upcoming challenges list, and the admin tools (allowed emails, flagged photo review, challenges, point values, score adjustments and change history). Each issue that lands updates this page.

## System

![Soul Search system architecture](architecture.svg)

## Flows

### Email-code login

```mermaid
sequenceDiagram
    actor player as Player
    participant pwa as PWA
    participant api as FastAPI
    participant auth as Supabase Auth
    participant mail as Resend

    player->>pwa: Enter email
    pwa->>api: POST /auth/send-code
    api->>api: Check the email is on the allowlist and not locked out
    api->>auth: Create the account on first sign-in (public signups are off)
    api->>auth: Send a one-time code
    auth->>mail: Send email
    mail-->>player: 6-digit code, valid for 10 minutes
    player->>pwa: Enter code
    pwa->>api: POST /auth/verify-code
    api->>api: Check the allowlist and refuse while locked out
    api->>auth: Verify the code
    alt Code accepted
        auth-->>api: Session
        api->>api: Reset the wrong-try count
        api-->>pwa: Session
    else Wrong or expired code
        api->>api: Count the wrong try (the 5th locks sign-in for 15 minutes)
        api-->>pwa: Tries left, expired, or locked until
    end
    pwa->>pwa: Keep the session on the phone (supabase-js)
    pwa->>auth: Check the session, then refresh it before it expires
    pwa->>api: GET /me
    opt First sign-in, no display name yet
        player->>pwa: Choose a name
        pwa->>api: PUT /me/display-name
    end
    Note over pwa,api: Every later request sends the session token. FastAPI validates it and checks the email is still on the allowlist
```

### Photo send

```mermaid
sequenceDiagram
    actor player as Player
    participant pwa as PWA
    participant api as FastAPI
    participant storage as Supabase Storage
    participant db as Postgres

    player->>pwa: Take photo, choose a claim (Regular, Special or a challenge category), tap Send
    pwa->>pwa: Keep the photo queued on the phone
    pwa->>api: POST /sightings with photo, claim, optional GPS
    api->>api: Turn the photo upright, read GPS, strip all EXIF
    api->>storage: Save the original, a 256px thumbnail and a 1600px display copy
    api->>db: Save sighting with points, tagged to the week or the running challenge
    api-->>pwa: Received, with points and the period total
    pwa->>pwa: Remove the queued copy
    api->>api: Start checking the photo in the background
    Note over pwa: If the send fails, the photo stays queued and is retried when the app opens or signal returns
    Note over api,storage: The original is only read by the server (photo check). Phones get the thumbnail or display copy
```

### Viewing photos

```mermaid
sequenceDiagram
    participant pwa as PWA
    participant api as FastAPI
    participant storage as Supabase Storage

    pwa->>api: GET /me/standing, /sightings or /admin/review
    api->>storage: Sign links for each photo's thumbnail, display copy and original (one batch call)
    storage-->>api: Signed links, none for files that don't exist
    api-->>pwa: thumb_url and photo_url (Home's last photo uses the thumbnail)
    pwa->>storage: Load the image by its signed link
    Note over api: Links last an hour and are cached in memory, re-signed 10 minutes before they expire
    Note over api,pwa: A missing size falls back to the next bigger one (thumbnail, display copy, original)
    Note over pwa: Striped placeholder until the image loads, and it stays if loading fails
```

The `python -m app.sightings.backfill_sizes` command creates missing sizes for older photos (see the README).

### Background verification

```mermaid
sequenceDiagram
    participant api as FastAPI background worker
    participant storage as Supabase Storage
    participant claude as Claude vision API
    participant db as Postgres

    api->>storage: Fetch the original photo
    api->>claude: Is this a Kia Soul, and do the claimed categories match?
    claude-->>api: Verdict and reasoning
    alt Not a Soul
        api->>db: Mark as a false call (-1), shown in the admin false calls list
    else Unsure, or Special that looks ordinary
        api->>db: Keep the points, flag for admin review
    else Confirmed
        api->>db: Mark as counted
    end
    api->>db: Save the short player note and the full reasoning
    Note over api,claude: Runs right after each send and every minute. Failed checks retry with backoff (1 min up to 6 h). After 8 tries the photo is counted and flagged for an admin
    Note over api,db: A readable license plate is saved for admins only
```

### Weekly close-out

```mermaid
sequenceDiagram
    participant cron as pg_cron + pg_net
    participant api as FastAPI
    participant db as Postgres

    cron->>db: Every hour at :05, read the close-out URL and secret from Vault
    cron->>api: POST /close-out with the shared secret
    api->>db: Lock every open week whose Pacific Monday 00:00 end has passed
    api->>db: Save each one's final standings to results and set closed_at
    api->>db: Make sure the current week exists
    Note over cron,api: Safe to run twice. A missed hour is caught up on the next run
    Note over api,db: Challenge points stay out because they belong to the challenge, not the week
```

## Environments

| Environment | Web | API | Supabase |
| --- | --- | --- | --- |
| Local | Vite on `localhost:5173` | FastAPI on `localhost:8000` | Supabase CLI stack in Docker, with Mailpit catching sign-in emails |
| Pull request previews | Netlify deploy preview for each pull request | Production API (allowed through `CORS_ORIGIN_REGEX`) | Production Supabase project |
| Production | Netlify (`soulsearch.cc`), deployed from `main` | Render, deployed from `main` once CI passes | Production Supabase project |

On every push to `main`, after the checks pass, the CI `migrate` job applies new migrations to the production database with `supabase db push`; Render waits for it, so the schema is in place before the API code that needs it. A separate staging environment (#18) is postponed and not needed for the MVP.
