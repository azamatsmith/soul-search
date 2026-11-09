begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is(
  (select count(*)::int from storage.buckets where id = 'photos'),
  1,
  'the photos bucket exists'
);
select is(
  (select public from storage.buckets where id = 'photos'),
  false,
  'the photos bucket is private'
);

set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'sneaky.jpg')$$,
  '42501',
  null,
  'authenticated cannot upload to the photos bucket'
);
reset role;

select * from finish();
rollback;
