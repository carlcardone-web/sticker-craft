
-- Required extensions
create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- ================== private settings table for worker URL + secret ==================
create schema if not exists private;

create table if not exists private.app_settings (
  key text primary key,
  value text not null
);

revoke all on schema private from public, anon, authenticated;
revoke all on private.app_settings from public, anon, authenticated;

-- Seed the worker URL and a generated HMAC secret. The URL points at the
-- stable preview hostname (works for both preview and published once promoted).
insert into private.app_settings (key, value)
values
  ('generation_worker_url',
   'https://project--fc0ebfce-7c53-40ec-845b-a2169186c280-dev.lovable.app/api/public/run-generation-job'),
  ('generation_worker_secret', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ================== generation_jobs table ==================
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending','running','done','failed')),
  prompt text not null,
  negative_prompt text,
  seed bigint,
  reference_images jsonb not null default '[]'::jsonb,
  image_url text,
  error_message text,
  error_detail jsonb,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);
create index if not exists generation_jobs_status_created_idx
  on public.generation_jobs (status, created_at)
  where status in ('pending','running');

alter table public.generation_jobs enable row level security;

drop policy if exists "users select own jobs" on public.generation_jobs;
create policy "users select own jobs" on public.generation_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own jobs" on public.generation_jobs;
create policy "users insert own jobs" on public.generation_jobs
  for insert with check (auth.uid() = user_id);

-- updated_at trigger reuses existing public.update_updated_at_column()
drop trigger if exists generation_jobs_updated_at on public.generation_jobs;
create trigger generation_jobs_updated_at
before update on public.generation_jobs
for each row execute function public.update_updated_at_column();

-- ================== stale-job reaper ==================
create or replace function public.reap_stale_generation_jobs()
returns void
language sql
security definer
set search_path = public
as $$
  update public.generation_jobs
     set status = 'failed',
         error_message = coalesce(error_message, 'Generation timed out.'),
         finished_at = now()
   where status in ('pending','running')
     and created_at < now() - interval '180 seconds';
$$;

revoke all on function public.reap_stale_generation_jobs() from public;
grant execute on function public.reap_stale_generation_jobs() to anon, authenticated, service_role;

-- ================== trigger: dispatch job to worker via pg_net ==================
create or replace function public.dispatch_generation_job()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  worker_url text;
  worker_secret text;
  body_text text;
  signature text;
begin
  select value into worker_url from private.app_settings where key = 'generation_worker_url';
  select value into worker_secret from private.app_settings where key = 'generation_worker_secret';

  if worker_url is null or worker_secret is null then
    raise warning 'generation worker not configured; job % left pending', new.id;
    return new;
  end if;

  body_text := json_build_object('jobId', new.id::text)::text;
  signature := encode(extensions.hmac(body_text, worker_secret, 'sha256'), 'hex');

  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-generation-signature', signature
    ),
    body := body_text::jsonb,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists generation_jobs_dispatch on public.generation_jobs;
create trigger generation_jobs_dispatch
after insert on public.generation_jobs
for each row execute function public.dispatch_generation_job();
