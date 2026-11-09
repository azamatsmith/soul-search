create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  photo_path text not null,
  taken_at timestamptz not null,
  created_at timestamptz not null default now(),
  claim_type text not null check (claim_type in ('regular', 'special')),
  categories text[] not null default '{}',
  points integer not null,
  latitude double precision,
  longitude double precision,
  status text not null default 'waiting_review'
    check (status in ('waiting_review', 'counted', 'false_call')),
  flagged boolean not null default false,
  check_note text,
  verification_notes text,
  week_id uuid references public.weeks (id),
  challenge_id uuid references public.challenges (id),
  check (num_nonnulls(week_id, challenge_id) = 1),
  check (
    (claim_type = 'regular' and cardinality(categories) = 0)
    or (claim_type = 'special' and cardinality(categories) > 0)
  ),
  check ((latitude is null) = (longitude is null))
);

create index sightings_player_id_idx on public.sightings (player_id);
create index sightings_week_id_idx on public.sightings (week_id);
create index sightings_challenge_id_idx on public.sightings (challenge_id);
create index sightings_flagged_idx on public.sightings (created_at) where flagged;

alter table public.sightings enable row level security;
