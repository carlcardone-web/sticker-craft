
create or replace function public.get_generation_worker_secret()
returns text
language sql
security definer
set search_path = public, private
as $$
  select value from private.app_settings where key = 'generation_worker_secret';
$$;

revoke all on function public.get_generation_worker_secret() from public, anon, authenticated;
grant execute on function public.get_generation_worker_secret() to service_role;
