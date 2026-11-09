create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (display_name = btrim(display_name) and display_name ~ '^[A-Za-z0-9 .''-]{2,20}$'),
  is_admin boolean not null default false,
  text_size text not null default 'standard' check (text_size in ('standard', 'large')),
  created_at timestamptz not null default now()
);

create unique index players_display_name_lower_key on public.players (lower(display_name));

alter table public.players enable row level security;
