alter table public.challenges
  add constraint challenges_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&);
