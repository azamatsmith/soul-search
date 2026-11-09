begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is((select count(*)::int from public.players), 3, 'the seed has three players');
select is(
  (select array_agg(display_name order by display_name) from public.players where is_admin),
  array['Alice'],
  'Alice is the only admin'
);
select is(
  (select count(*)::int from public.allowed_emails
   where email in ('alice@example.test', 'bob@example.test', 'carol@example.test')),
  3,
  'all three test emails are allowed'
);
select is((select count(*)::int from public.settings), 1, 'the settings row exists');
select is(
  (select count(*)::int from public.weeks where closed_at is null),
  1,
  'one week is open'
);
select ok(
  (select starts_at <= now() and now() < ends_at from public.weeks where closed_at is null),
  'the open week contains the current time'
);

select * from finish();
rollback;
