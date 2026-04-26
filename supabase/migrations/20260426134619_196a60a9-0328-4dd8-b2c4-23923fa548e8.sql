create or replace function public.reap_stale_generation_jobs()
returns void
language sql
security definer
set search_path = public
as $$
  update public.generation_jobs
     set status = 'failed',
         error_message = coalesce(error_message, 'Generation timed out.'),
         error_detail = coalesce(
           error_detail,
           jsonb_build_object(
             'stage', 'stale_job_reaper',
             'reason', 'worker_did_not_finish_before_timeout',
             'previousStatus', status,
             'createdAt', created_at,
             'startedAt', started_at,
             'timeoutSeconds', 180
           )
         ),
         finished_at = now()
   where status in ('pending','running')
     and created_at < now() - interval '180 seconds';
$$;

create or replace function public.dispatch_generation_job()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  worker_url text;
  worker_secret text;
  body_json jsonb;
  body_text text;
  signature text;
begin
  select value into worker_url from private.app_settings where key = 'generation_worker_url';
  select value into worker_secret from private.app_settings where key = 'generation_worker_secret';

  if worker_url is null or worker_secret is null then
    raise warning 'generation worker not configured; job % left pending', new.id;
    return new;
  end if;

  body_json := jsonb_build_object('jobId', new.id::text);
  body_text := body_json::text;
  signature := encode(extensions.hmac(body_text, worker_secret, 'sha256'), 'hex');

  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-generation-signature', signature
    ),
    body := body_json,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;