create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  closed_at timestamptz,
  results jsonb,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.weeks enable row level security;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  rules jsonb not null,
  created_by uuid references public.players (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.challenges enable row level security;
