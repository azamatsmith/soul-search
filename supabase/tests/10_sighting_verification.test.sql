begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(12);

select col_default_is('public', 'sightings', 'verify_attempts', '0', 'verify_attempts defaults to 0');
select col_not_null('public', 'sightings', 'next_attempt_at', 'next_attempt_at is required');
select has_column('public', 'sightings', 'verified_at', 'verified_at exists');
select has_column('public', 'sightings', 'last_verify_error', 'last_verify_error exists');
select has_index('public', 'sightings', 'sightings_unverified_idx', 'unverified sightings are indexed');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'one@example.test');
insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000001', 'Mom');
insert into public.weeks (id, starts_at, ends_at)
  values ('10000000-0000-0000-0000-000000000001', '2030-01-07 08:00+00', '2030-01-14 08:00+00');

create temporary table base as select
  '00000000-0000-0000-0000-000000000001'::uuid as player_id,
  '10000000-0000-0000-0000-000000000001'::uuid as week_id;

select lives_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, plate_number, plate_state)
    select player_id, 'p/1.jpg', now(), 'regular', 1, week_id, '8ABC123', 'CA' from base$$,
  'a full plate with a state is accepted'
);
select lives_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id)
    select player_id, 'p/2.jpg', now(), 'regular', 1, week_id from base$$,
  'no plate is accepted'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, plate_number, plate_state)
    select player_id, 'p/3.jpg', now(), 'regular', 1, week_id, '8abc 123', 'CA' from base$$,
  '23514', null, 'plate numbers must be uppercase with no spaces'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, plate_number, plate_state)
    select player_id, 'p/4.jpg', now(), 'regular', 1, week_id, '8ABC123', 'Calif' from base$$,
  '23514', null, 'plate states must be two uppercase letters'
);
select lives_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, plate_number)
    select player_id, 'p/5.jpg', now(), 'regular', 1, week_id, '8ABC123' from base$$,
  'a plate number without a state is accepted'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, plate_state)
    select player_id, 'p/7.jpg', now(), 'regular', 1, week_id, 'CA' from base$$,
  '23514', null, 'a state needs a plate number'
);
select throws_ok(
  $$insert into public.sightings (player_id, photo_path, taken_at, claim_type, points, week_id, verify_attempts)
    select player_id, 'p/6.jpg', now(), 'regular', 1, week_id, -1 from base$$,
  '23514', null, 'verify_attempts cannot be negative'
);

select * from finish();
rollback;
