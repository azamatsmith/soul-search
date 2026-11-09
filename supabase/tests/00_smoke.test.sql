begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(1);

select ok(true, 'pgTAP runs against the local database');

select * from finish();
rollback;
