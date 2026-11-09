create table public.score_adjustments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  admin_id uuid not null references public.players (id),
  week_id uuid references public.weeks (id),
  challenge_id uuid references public.challenges (id),
  change integer not null check (change <> 0),
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  check (num_nonnulls(week_id, challenge_id) = 1)
);

create index score_adjustments_player_id_idx on public.score_adjustments (player_id);

alter table public.score_adjustments enable row level security;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.players (id),
  type text not null check (type in ('photo', 'score', 'emails', 'rules', 'challenge')),
  target_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
