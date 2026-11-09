begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_table('public', 'allowed_emails', 'allowed_emails table exists');
select col_is_pk('public', 'allowed_emails', 'email', 'email is the primary key');
select fk_ok('public', 'allowed_emails', 'added_by', 'public', 'players', 'id', 'added_by references players');
select is(
  (select relrowsecurity from pg_class where oid = 'public.allowed_emails'::regclass),
  true,
  'RLS is enabled'
);

select lives_ok(
  $$insert into public.allowed_emails (email) values ('nora.l@example.test')$$,
  'a lowercase trimmed email is accepted'
);
select throws_ok(
  $$insert into public.allowed_emails (email) values ('Nora.L@Example.test')$$,
  '23514',
  null,
  'emails must be stored lowercase'
);

set local role anon;
select is_empty('select * from public.allowed_emails', 'anon cannot read allowed emails');
reset role;

set local role authenticated;
select throws_ok(
  $$insert into public.allowed_emails (email) values ('sneaky@example.test')$$,
  '42501',
  null,
  'authenticated cannot insert allowed emails'
);
reset role;

select * from finish();
rollback;
