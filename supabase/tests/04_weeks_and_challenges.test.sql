begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'weeks', 'weeks table exists');
select has_table('public', 'challenges', 'challenges table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.weeks'::regclass),
  true,
  'RLS is enabled on weeks'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.challenges'::regclass),
  true,
  'RLS is enabled on challenges'
);
select fk_ok('public', 'challenges', 'created_by', 'public', 'players', 'id', 'created_by references players');

select lives_ok(
  $$insert into public.weeks (starts_at, ends_at) values ('2026-11-09 08:00+00', '2026-11-16 08:00+00')$$,
  'a valid week is accepted'
);
select throws_ok(
  $$insert into public.weeks (starts_at, ends_at) values ('2026-11-09 08:00+00', '2026-11-23 08:00+00')$$,
  '23505',
  null,
  'two weeks cannot start at the same time'
);
select throws_ok(
  $$insert into public.weeks (starts_at, ends_at) values ('2026-11-23 08:00+00', '2026-11-16 08:00+00')$$,
  '23514',
  null,
  'a week must end after it starts'
);
select lives_ok(
  $$insert into public.challenges (name, starts_at, ends_at, rules)
    values ('Brown Week', '2026-11-20 16:00+00', '2026-11-20 20:00+00',
            '{"regular": 1, "special": 2, "false_call": -1, "bonuses": {"Brown paint": 3}}')$$,
  'a valid challenge is accepted'
);
select throws_ok(
  $$insert into public.challenges (name, starts_at, ends_at, rules)
    values ('Backwards', '2026-11-20 20:00+00', '2026-11-20 16:00+00', '{}')$$,
  '23514',
  null,
  'a challenge must end after it starts'
);

set local role anon;
select is_empty('select * from public.weeks', 'anon cannot read weeks');
reset role;

set local role authenticated;
select throws_ok(
  $$insert into public.challenges (name, starts_at, ends_at, rules)
    values ('Sneaky', '2026-11-20 16:00+00', '2026-11-20 20:00+00', '{}')$$,
  '42501',
  null,
  'authenticated cannot create challenges'
);
reset role;

select * from finish();
rollback;
