create table public.sign_in_attempts (
  email text primary key check (email = lower(btrim(email))),
  failed_count integer not null default 0 check (failed_count >= 0),
  locked_until timestamptz,
  code_sent_at timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sign_in_attempts enable row level security;
