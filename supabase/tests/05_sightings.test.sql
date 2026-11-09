begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'sightings', 'sightings table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.sightings'::regclass),
  true,
  'RLS is enabled'
);
select col_default_is('public', 'sightings', 'status', 'waiting_review'::text, 'status defaults to waiting_review');
select col_default_is('public', 'sightings', 'flagged', 'false', 'flagged defaults to false');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'one@example.test');
insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000001', 'Mom');
insert into public.weeks (id, starts_at, ends_at)
  values ('10000000-0000-0000-0000-000000000001', '2030-01-07 08:00+00', '2030-01-14 08:00+00');
insert into public.challenges (id, name, starts_at, ends_at, rules)
  values ('20000000-0000-0000-0000-000000000001', 'Brown Week', '2026-11-20 16:00+00', '2026-11-20 20:00+00', '{}');

create temporary table base as select
  '00000000-0000-0000-0000-000000000001'::uuid as player_id,
  'player/photo.jpg'::text as photo_path,
  now() as taken_at;

select lives_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id)
    select player_id, photo_path, taken_at, 'regular', 1, '10000000-0000-0000-0000-000000000001' from base$$,
  'a regular sighting in a week is accepted'
);
select lives_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, categories, points, challenge_id, latitude, longitude)
    select player_id, photo_path, taken_at, 'special', array['Brown paint'], 5, '20000000-0000-0000-0000-000000000001', 47.6, -122.3 from base$$,
  'a special sighting in a challenge with a location is accepted'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, challenge_id)
    select player_id, photo_path, taken_at, 'regular', 1, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001' from base$$,
  '23514',
  null,
  'a sighting cannot belong to both a week and a challenge'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points)
    select player_id, photo_path, taken_at, 'regular', 1 from base$$,
  '23514',
  null,
  'a sighting must belong to a week or a challenge'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, categories, points, week_id)
    select player_id, photo_path, taken_at, 'regular', array['Brown paint'], 1, '10000000-0000-0000-0000-000000000001' from base$$,
  '23514',
  null,
  'a regular claim cannot have categories'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id)
    select player_id, photo_path, taken_at, 'special', 2, '10000000-0000-0000-0000-000000000001' from base$$,
  '23514',
  null,
  'a special claim needs at least one category'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, latitude)
    select player_id, photo_path, taken_at, 'regular', 1, '10000000-0000-0000-0000-000000000001', 47.6 from base$$,
  '23514',
  null,
  'latitude and longitude must be set together'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id)
    select player_id, photo_path, taken_at, 'fancy', 1, '10000000-0000-0000-0000-000000000001' from base$$,
  '23514',
  null,
  'claim_type only accepts regular or special'
);
select throws_ok(
  $$update public.sightings set status = 'maybe'$$,
  '23514',
  null,
  'status only accepts waiting_review, counted or false_call'
);

set local role anon;
select is_empty('select * from public.sightings', 'anon cannot read sightings');
reset role;

set local role authenticated;
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id)
    values ('00000000-0000-0000-0000-000000000001', 'x.jpg', now(), 'regular', 1, '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'authenticated cannot insert sightings'
);
reset role;

select * from finish();
rollback;
