alter table public.sightings
  add column verify_attempts integer not null default 0 check (verify_attempts >= 0),
  add column next_attempt_at timestamptz not null default now(),
  add column verified_at timestamptz,
  add column last_verify_error text,
  add column plate_number text check (plate_number ~ '^[A-Z0-9]{1,8}$'),
  add column plate_state text check (plate_state ~ '^[A-Z]{2}$'),
  add check (plate_state is null or plate_number is not null);

create index sightings_unverified_idx on public.sightings (next_attempt_at)
  where verified_at is null;
