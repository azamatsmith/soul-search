create table public.settings (
  id boolean primary key default true check (id),
  regular_points integer not null default 1,
  special_points integer not null default 2,
  false_call_points integer not null default -1,
  special_categories text[] not null
    default array['Alien Green', 'Racing stripes', 'Exterior graphics', 'Brown paint'],
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
