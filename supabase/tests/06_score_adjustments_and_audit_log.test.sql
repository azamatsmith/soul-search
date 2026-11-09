begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public', 'score_adjustments', 'score_adjustments table exists');
select has_table('public', 'audit_log', 'audit_log table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.score_adjustments'::regclass),
  true,
  'RLS is enabled on score_adjustments'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  true,
  'RLS is enabled on audit_log'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'player@example.test');
insert into public.players (id, display_name, is_admin) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', true),
  ('00000000-0000-0000-0000-000000000002', 'Player', false);
insert into public.weeks (id, starts_at, ends_at)
  values ('10000000-0000-0000-0000-000000000001', '2026-11-09 08:00+00', '2026-11-16 08:00+00');

select lives_ok(
  $$insert into public.score_adjustments (player_id, admin_id, week_id, change, reason)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001', 3, 'Photo was lost in transit')$$,
  'a valid score adjustment is accepted'
);
select throws_ok(
  $$insert into public.score_adjustments (player_id, admin_id, week_id, change, reason)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001', 3, '   ')$$,
  '23514',
  null,
  'a score adjustment needs a non-blank reason'
);
select throws_ok(
  $$insert into public.score_adjustments (player_id, admin_id, week_id, change, reason)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001', 0, 'Nothing')$$,
  '23514',
  null,
  'a score adjustment cannot be zero'
);
select throws_ok(
  $$insert into public.score_adjustments (player_id, admin_id, change, reason)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 3, 'No period')$$,
  '23514',
  null,
  'a score adjustment must belong to a week or a challenge'
);

select lives_ok(
  $$insert into public.audit_log (admin_id, type, before, after)
    values ('00000000-0000-0000-0000-000000000001', 'rules', '{"special": 3}', '{"special": 2}')$$,
  'a valid audit entry is accepted'
);
select throws_ok(
  $$insert into public.audit_log (admin_id, type) values ('00000000-0000-0000-0000-000000000001', 'other')$$,
  '23514',
  null,
  'audit type only accepts photo, score, emails, rules or challenge'
);

set local role anon;
select is_empty('select * from public.audit_log', 'anon cannot read the audit log');
select is_empty('select * from public.score_adjustments', 'anon cannot read score adjustments');
reset role;

set local role authenticated;
select throws_ok(
  $$insert into public.audit_log (admin_id, type) values ('00000000-0000-0000-0000-000000000001', 'rules')$$,
  '42501',
  null,
  'authenticated cannot write the audit log'
);
reset role;

select * from finish();
rollback;
