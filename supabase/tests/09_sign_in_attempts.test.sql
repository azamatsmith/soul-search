begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_table('public', 'sign_in_attempts', 'sign_in_attempts table exists');
select col_is_pk('public', 'sign_in_attempts', 'email', 'email is the primary key');
select is(
  (select relrowsecurity from pg_class where oid = 'public.sign_in_attempts'::regclass),
  true,
  'RLS is enabled'
);

select lives_ok(
  $$insert into public.sign_in_attempts (email) values ('bob@example.test')$$,
  'a lowercase trimmed email is accepted'
);
select throws_ok(
  $$insert into public.sign_in_attempts (email) values ('Bob@Example.test')$$,
  '23514',
  null,
  'emails must be stored lowercase'
);
select throws_ok(
  $$insert into public.sign_in_attempts (email, failed_count) values ('neg@example.test', -1)$$,
  '23514',
  null,
  'failed_count cannot be negative'
);

set local role anon;
select is_empty('select * from public.sign_in_attempts', 'anon cannot read sign in attempts');
reset role;

set local role authenticated;
select throws_ok(
  $$insert into public.sign_in_attempts (email) values ('sneaky@example.test')$$,
  '42501',
  null,
  'authenticated cannot insert sign in attempts'
);
reset role;

select * from finish();
rollback;
