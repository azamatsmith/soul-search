begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'sightings', 'reviewed_at', 'reviewed_at exists');
select has_column('public', 'sightings', 'reviewed_by', 'reviewed_by exists');
select has_index('public', 'sightings', 'sightings_false_call_queue_idx', 'unreviewed false calls are indexed');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'one@example.test');
insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000001', 'Mom');
insert into public.weeks (id, starts_at, ends_at)
  values ('10000000-0000-0000-0000-000000000001', '2030-01-07 08:00+00', '2030-01-14 08:00+00');

select lives_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, reviewed_at, reviewed_by)
    values ('00000000-0000-0000-0000-000000000001', 'p/1.jpg', now(), 'regular', 1,
      '10000000-0000-0000-0000-000000000001', now(), '00000000-0000-0000-0000-000000000001')$$,
  'a review with a reviewer is accepted'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, reviewed_at)
    values ('00000000-0000-0000-0000-000000000001', 'p/2.jpg', now(), 'regular', 1,
      '10000000-0000-0000-0000-000000000001', now())$$,
  '23514', null, 'a review needs a reviewer'
);

select * from finish();
rollback;
