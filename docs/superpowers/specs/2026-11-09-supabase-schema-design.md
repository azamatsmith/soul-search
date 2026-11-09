# Supabase schema

Issue: 2. Supabase project and schema.

## Decisions

- Local only: migrations, seed data and tests run against the local Supabase stack. Hosted projects are created with the API deploy and staging issues.
- Everything goes through FastAPI, which connects with the server key. RLS is enabled on every table with no policies, so the browser keys (`anon`, `authenticated`) can neither read nor write. FastAPI enforces who can do what.
- pgTAP tests run with `supabase test db`, locally through `make db-test` and in CI.
- Fixed value sets are `text` columns with `check` constraints rather than Postgres enums, so later migrations can change them easily.
- Tables use `id uuid primary key default gen_random_uuid()` unless noted, and `created_at timestamptz not null default now()`.

## Tables

### players

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | primary key, references `auth.users`, cascade on delete |
| display_name | text | trimmed, 2 to 20 of letters, numbers, spaces and `. ' -`; unique ignoring case |
| is_admin | boolean | default false |
| text_size | text | `standard` (default) or `large` |
| created_at | timestamptz | |

### allowed_emails

| Column | Type | Notes |
| --- | --- | --- |
| email | text | primary key, stored lowercase and trimmed |
| added_by | uuid | nullable, references players |
| created_at | timestamptz | |

Joined status is derived by matching `auth.users.email` to a player, not stored.

### settings

A single row: `id boolean primary key default true check (id)`.

| Column | Type | Default |
| --- | --- | --- |
| regular_points | int | 1 |
| special_points | int | 2 |
| false_call_points | int | -1 |
| special_categories | text[] | Alien Green, Racing stripes, Exterior graphics, Brown paint (display order) |
| updated_at | timestamptz | now() |

### weeks

| Column | Type | Notes |
| --- | --- | --- |
| starts_at, ends_at | timestamptz | `ends_at > starts_at`; `starts_at` unique |
| closed_at | timestamptz | null until the week is closed |
| results | jsonb | final standings: list of `{player_id, display_name, rank, points, souls}` |

### challenges

| Column | Type | Notes |
| --- | --- | --- |
| name | text | |
| starts_at, ends_at | timestamptz | `ends_at > starts_at` |
| rules | jsonb | `{regular, special, false_call, bonuses: {category: points}}`, copied from settings on create |
| created_by | uuid | references players |
| created_at | timestamptz | |

Status (running, coming up, finished) and winners are derived from times and sightings.

### sightings

| Column | Type | Notes |
| --- | --- | --- |
| player_id | uuid | references players |
| photo_path | text | path in the `photos` bucket |
| taken_at | timestamptz | when the photo was taken |
| created_at | timestamptz | when the server received it |
| claim_type | text | `regular` or `special` |
| categories | text[] | empty for regular, at least one for special |
| points | int | set at send time |
| latitude, longitude | double precision | nullable, both or neither |
| status | text | `waiting_review` (default), `counted` or `false_call` |
| flagged | boolean | default false |
| check_note | text | short, shown to players |
| verification_notes | text | full model reasoning, shown to admins |
| week_id, challenge_id | uuid | exactly one is set |

Indexes on `week_id`, `challenge_id` and `player_id`, and a partial index on flagged sightings.

### score_adjustments

| Column | Type | Notes |
| --- | --- | --- |
| player_id, admin_id | uuid | reference players |
| week_id, challenge_id | uuid | exactly one is set |
| change | int | not zero |
| reason | text | required, not blank |
| created_at | timestamptz | |

### audit_log

| Column | Type | Notes |
| --- | --- | --- |
| admin_id | uuid | references players |
| type | text | `photo`, `score`, `emails`, `rules` or `challenge` |
| target_id | uuid | nullable |
| before, after | jsonb | nullable |
| reason | text | nullable |
| created_at | timestamptz | indexed, newest first |

### Storage

A private `photos` bucket with no storage policies, so only the server key can use it.

## Left to later issues

- Sign-in attempts and lockout table: email code auth.
- Verification retry tracking on sightings: background verification.
- Creating the first open week in a new environment: weekly close-out.

## Seed data (local only)

- Players Alice (admin), Bob and Carol, with `auth.users` rows and emails `alice@example.test`, `bob@example.test`, `carol@example.test`, all in `allowed_emails`.
- The default settings row.
- An open week starting at the most recent Monday 00:00 America/Los_Angeles.

## Tests

One pgTAP file per table. Each covers its constraints, and every table is checked to be unreadable and unwritable as `anon` and `authenticated`. Further files check that the photos bucket is private and that the seed loads three players, one admin and one open week.
