alter table public.sightings
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.players (id),
  add check ((reviewed_at is null) = (reviewed_by is null));

create index sightings_false_call_queue_idx on public.sightings (taken_at)
  where status = 'false_call' and reviewed_at is null;
