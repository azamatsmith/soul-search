begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_table('public', 'settings', 'settings table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.settings'::regclass),
  true,
  'RLS is enabled'
);

delete from public.settings;
insert into public.settings default values;

select is((select regular_points from public.settings), 1, 'regular points default to 1');
select is((select special_points from public.settings), 2, 'special points default to 2');
select is((select false_call_points from public.settings), -1, 'false call points default to -1');
select is(
  (select special_categories from public.settings),
  array['Alien Green', 'Racing stripes', 'Exterior graphics', 'Brown paint'],
  'special categories default to the four categories in order'
);
select throws_ok(
  $$insert into public.settings default values$$,
  '23505',
  null,
  'there can only be one settings row'
);
select throws_ok(
  $$insert into public.settings (id) values (false)$$,
  '23514',
  null,
  'the settings row id can only be true'
);

set local role anon;
select is_empty('select * from public.settings', 'anon cannot read settings');
reset role;

set local role authenticated;
select throws_ok(
  $$insert into public.settings (regular_points) values (5)$$,
  '42501',
  null,
  'authenticated cannot write settings'
);
reset role;

select * from finish();
rollback;
