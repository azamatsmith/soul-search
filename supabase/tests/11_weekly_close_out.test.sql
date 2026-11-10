begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_function('public', 'run_weekly_close_out', 'run_weekly_close_out exists');
select is(
  (select schedule from cron.job where jobname = 'weekly-close-out'),
  '5 * * * *',
  'close-out is scheduled hourly'
);
select ok(
  not has_function_privilege('anon', 'public.run_weekly_close_out()', 'execute')
    and not has_function_privilege('authenticated', 'public.run_weekly_close_out()', 'execute'),
  'browsers cannot trigger the close-out'
);
select is(public.run_weekly_close_out(), null, 'does nothing until Vault has the url and secret');

select vault.create_secret('http://api.test/close-out', 'close_out_url');
select vault.create_secret('vault-close-out-secret', 'close_out_secret');
select isnt(public.run_weekly_close_out(), null, 'queues a request once Vault is set');
select is(
  (select url || ' ' || (headers ->> 'X-Close-Out-Secret')
   from net.http_request_queue order by id desc limit 1),
  'http://api.test/close-out vault-close-out-secret',
  'posts to the close-out url with the shared secret'
);

select * from finish();
rollback;
