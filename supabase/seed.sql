insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'alice@example.test'),
  ('b2222222-2222-2222-2222-222222222222'::uuid, 'bob@example.test'),
  ('c3333333-3333-3333-3333-333333333333'::uuid, 'carol@example.test')
) as test_users (id, email);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where email like '%@example.test';

insert into public.players (id, display_name, is_admin) values
  ('a1111111-1111-1111-1111-111111111111', 'Alice', true),
  ('b2222222-2222-2222-2222-222222222222', 'Bob', false),
  ('c3333333-3333-3333-3333-333333333333', 'Carol', false);

insert into public.allowed_emails (email, added_by) values
  ('alice@example.test', null),
  ('bob@example.test', 'a1111111-1111-1111-1111-111111111111'),
  ('carol@example.test', 'a1111111-1111-1111-1111-111111111111');

insert into public.settings default values;

insert into public.weeks (starts_at, ends_at)
select
  monday at time zone 'America/Los_Angeles',
  (monday + interval '7 days') at time zone 'America/Los_Angeles'
from (select date_trunc('week', now() at time zone 'America/Los_Angeles') as monday) as current_week;
