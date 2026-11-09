create table public.allowed_emails (
  email text primary key check (email = lower(btrim(email))),
  added_by uuid references public.players (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
