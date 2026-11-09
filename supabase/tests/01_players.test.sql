begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'players', 'players table exists');
select col_is_pk('public', 'players', 'id', 'id is the primary key');
select fk_ok('public', 'players', 'id', 'auth', 'users', 'id', 'id references auth.users');
select col_default_is('public', 'players', 'is_admin', 'false', 'is_admin defaults to false');
select col_default_is('public', 'players', 'text_size', 'standard'::text, 'text_size defaults to standard');
select is(
  (select relrowsecurity from pg_class where oid = 'public.players'::regclass),
  true,
  'RLS is enabled'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'two@example.test');

select lives_ok(
  $$insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000001', 'Mom')$$,
  'a valid display name is accepted'
);
select throws_ok(
  $$insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000002', 'mom')$$,
  '23505',
  null,
  'display names are unique ignoring case'
);
select throws_ok(
  $$insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000002', 'M')$$,
  '23514',
  null,
  'names shorter than 2 characters are rejected'
);
select throws_ok(
  $$insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000002', 'Abcdefghijklmnopqrstu')$$,
  '23514',
  null,
  'names longer than 20 characters are rejected'
);
select throws_ok(
  $$insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000002', 'Bob!')$$,
  '23514',
  null,
  'names with other characters are rejected'
);
select throws_ok(
  $$insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000002', ' Bob')$$,
  '23514',
  null,
  'untrimmed names are rejected'
);
select lives_ok(
  $$insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000002', 'Mary-Jo O''Neil Jr.')$$,
  'names with spaces, periods, apostrophes and hyphens are accepted'
);
select throws_ok(
  $$update public.players set text_size = 'huge' where id = '00000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'text_size only accepts standard or large'
);

set local role anon;
select is_empty('select * from public.players', 'anon cannot read players');
reset role;

set local role authenticated;
select throws_ok(
  $$insert into public.players (id, display_name) values ('00000000-0000-0000-0000-000000000003', 'Sneaky')$$,
  '42501',
  null,
  'authenticated cannot insert players'
);
reset role;

select * from finish();
rollback;
