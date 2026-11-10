create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function public.run_weekly_close_out() returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_url text;
  close_out_secret text;
begin
  select decrypted_secret into target_url
  from vault.decrypted_secrets where name = 'close_out_url';
  select decrypted_secret into close_out_secret
  from vault.decrypted_secrets where name = 'close_out_secret';

  if target_url is null or close_out_secret is null then
    return null;
  end if;

  return net.http_post(
    url := target_url,
    headers := jsonb_build_object('X-Close-Out-Secret', close_out_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.run_weekly_close_out() from public, anon, authenticated;

-- Hourly so the UTC offset of Pacific midnight never matters, and a failed call is retried.
select cron.schedule('weekly-close-out', '5 * * * *', 'select public.run_weekly_close_out()');
