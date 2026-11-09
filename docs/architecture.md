# Architecture

Soul Search is an installable phone web app (PWA) for iPhone and Android backed by a FastAPI service and Supabase. The PWA talks to FastAPI for everything except keeping its session fresh, which supabase-js does directly with Supabase Auth. FastAPI is the only part that reads and writes data and talks to the Claude vision API.

Most of this is planned rather than built. Each issue that lands updates this page.

## System

```mermaid
flowchart TB
    phone["Phone PWA, iPhone and Android<br/>React + Vite<br/>(Netlify)"]
    api["FastAPI<br/>(Render)"]
    claude["Claude vision API"]
    email["Email provider<br/>(custom SMTP, e.g. Resend)"]
    inbox["Player's inbox"]
    cron["Supabase pg_cron + pg_net<br/>(weekly schedule)"]

    subgraph supabase["Supabase"]
        auth["Auth"]
        db[("Postgres")]
        storage[("Storage<br/>private photos bucket")]
    end

    phone -- "HTTPS, session token" --> api
    phone -- "store and refresh session" --> auth
    api -- "check photo" --> claude
    api -- "codes and tokens" --> auth
    api -- "data" --> db
    api -- "photos" --> storage
    cron -- "weekly close-out,<br/>shared secret" --> api
    auth -- "sign-in codes" --> email
    email -- "6-digit code" --> inbox
```

## Flows

### Email-code login

```mermaid
sequenceDiagram
    actor player as Player
    participant pwa as PWA
    participant api as FastAPI
    participant auth as Supabase Auth
    participant mail as Email provider

    player->>pwa: Enter email
    pwa->>api: POST /auth/send-code
    api->>api: Check the email is on the allowlist
    api->>auth: Send a one-time code
    auth->>mail: Send email
    mail-->>player: 6-digit code, valid for 10 minutes
    player->>pwa: Enter code
    pwa->>api: POST /auth/verify-code
    api->>api: Count tries per email (5 wrong locks sign-in for 15 minutes)
    api->>auth: Verify the code
    auth-->>api: Session
    api-->>pwa: Session
    pwa->>auth: Store the session (supabase-js), refreshed automatically from then on
    Note over pwa,api: Every later request sends the session token, which FastAPI validates
```

### Photo send

```mermaid
sequenceDiagram
    actor player as Player
    participant pwa as PWA
    participant api as FastAPI
    participant storage as Supabase Storage
    participant db as Postgres

    player->>pwa: Take photo, choose Regular or Special, tap Send
    pwa->>pwa: Keep the photo queued on the phone
    pwa->>api: Photo, claim, optional GPS
    api->>storage: Save photo
    api->>db: Save sighting with points, tagged to the week or active challenge
    api-->>pwa: Received, with points and weekly total
    pwa->>pwa: Remove the queued copy
    api->>api: Queue the sighting for verification
    Note over pwa: If the send fails, the photo stays queued and is retried when the app opens
```

### Background verification

```mermaid
sequenceDiagram
    participant api as FastAPI background task
    participant storage as Supabase Storage
    participant claude as Claude vision API
    participant db as Postgres

    api->>storage: Fetch photo
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
    Note over api,claude: Retries if the API call fails
```

### Weekly close-out

```mermaid
sequenceDiagram
    participant cron as pg_cron + pg_net
    participant api as FastAPI
    participant db as Postgres

    cron->>api: Just after Monday 00:00 Pacific, call close-out with the shared secret
    api->>api: Work out the Pacific-time week boundary, handling daylight saving
    api->>db: Save full final standings to the week's results
    api->>db: Open the next week
    Note over cron,api: Safe to run twice
```

## Environments

| Environment | Web | API | Supabase |
| --- | --- | --- | --- |
| Local | Vite on `localhost:5173` | FastAPI on `localhost:8000` | Supabase CLI stack in Docker, with a mail catcher for sign-in emails |
| Staging | Netlify branch deploy | Staging service deployed from a `staging` branch | Separate Supabase project with a test email sender |
| Production | Netlify, deployed from `main` | Render, deployed from `main` once CI passes | Production Supabase project |

Staging is planned in #18. Changes go to staging first, are verified there, then are promoted to `main`.
