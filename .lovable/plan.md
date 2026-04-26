## Why the timeout keeps happening (recap)

Hosted URLs are now confirmed flowing through, yet generation still 504s. The bottleneck is wall-clock time of the Lovable AI image call exceeding the Worker request window. Trimming payload won't help further — we need to stop blocking the HTTP response on the AI call.

## Keeping the worker alive — chosen approach

You're right that bare fire-and-forget will be killed when the response flushes. I checked the project: `@tanstack/react-start` on this Worker target does **not** expose `ctx.waitUntil`, and there's no native queue wired up. So neither "fire-and-forget promise" nor `waitUntil` is reliable here.

**Chosen pattern: self-invoked HTTP worker via a public route, kicked off by Postgres `pg_net` (with a synchronous fallback).**

Flow:
```text
client → enqueueGeneration server fn
            ├─ insert generation_jobs row (status=pending, attempts=0)
            ├─ trigger fires → pg_net.http_post → /api/public/run-generation-job
            │     (fully detached HTTP request; survives independent of the
            │      original client request)
            └─ returns { jobId } immediately

/api/public/run-generation-job (server route, signed payload)
   ├─ verifies HMAC signature using GENERATION_WORKER_SECRET
   ├─ claims the job (UPDATE … SET status='running' WHERE id=$1 AND status='pending')
   ├─ calls Lovable AI gateway (this is the long call, in its own request budget)
   ├─ persists artwork
   └─ UPDATE generation_jobs SET status='done'|'failed', image_url, error_detail

client → polls getGenerationStatus(jobId) every 2s → updates UI
```

Why this works:
- The `pg_net.http_post` call from the DB trigger is decoupled from the original Worker request — it runs even after `enqueueGeneration` returns.
- Each Worker invocation only does one thing inside its own timeout budget: enqueue is fast (DB insert + trigger), worker is the slow AI call but not bound to the user's connection.
- No reliance on `waitUntil` or any runtime-specific promise lifetime.

**Fallback** if `pg_net` isn't available in this Cloud project: the migration falls back to invoking the worker route via `fetch()` from inside the server fn handler, but **without** `await` and **without** consuming the response body — using `fetch(url, { signal: AbortSignal.timeout(0) }).catch(() => {})` is unreliable, so the trigger path is the primary. We'll verify `pg_net` is enabled in the migration; if not, we enable it (`create extension if not exists pg_net`).

## Security & robustness (your requirements)

1. **Service-role key stays server-side only.** The worker route imports `supabaseAdmin` from `src/integrations/supabase/client.server.ts` (already exists, server-only). Never referenced from client code.
2. **Worker route is signed.** `/api/public/run-generation-job` requires an HMAC of the body using `GENERATION_WORKER_SECRET` (new runtime secret). The DB trigger computes the HMAC via `pgcrypto`. Without a valid signature → 401. This means even though the route is public, only our own DB can call it.
3. **Full upstream error detail stored.** On failure the worker writes `{ status:'failed', error_message, error_detail jsonb }` containing HTTP status, response body, model, prompt length, ref count. Client surfaces `error_message`; full detail kept for debugging.
4. **Stale-job timeout.** Two layers:
   - Hard cap: `running` jobs older than 180s are considered dead. A simple SQL function `reap_stale_generation_jobs()` flips them to `failed` with `error_message='timed out'`. Called opportunistically at the start of `enqueueGeneration` and `getGenerationStatus` (cheap, indexed query) — no cron needed.
   - Client cap: polling stops after 180s and shows a timeout error if the job hasn't reached a terminal state.
5. **Idempotent claim.** Worker uses `UPDATE … WHERE id=$1 AND status='pending' RETURNING *` to atomically claim the job; if no row returned, exit (already claimed/reaped). Prevents double-processing if `pg_net` ever retries.
6. **Attempts column.** `attempts int default 0`, incremented on claim. We don't auto-retry now, but the column is in place.

## Schema

```sql
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending','running','done','failed')),
  prompt text not null,
  negative_prompt text,
  seed bigint,
  reference_images jsonb not null default '[]',
  image_url text,
  error_message text,
  error_detail jsonb,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index on public.generation_jobs (user_id, created_at desc);
create index on public.generation_jobs (status, created_at) where status in ('pending','running');

alter table public.generation_jobs enable row level security;
create policy "users select own jobs" on public.generation_jobs
  for select using (auth.uid() = user_id);
create policy "users insert own jobs" on public.generation_jobs
  for insert with check (auth.uid() = user_id);
-- updates only by service role (worker)
```

Plus: `update_updated_at` trigger, `enqueue_generation_job_trigger` (after insert → `pg_net.http_post` with HMAC header), `reap_stale_generation_jobs()` function.

## Files

- **migration**: create table, RLS, triggers, `reap_stale_generation_jobs()`, ensure `pg_net`/`pgcrypto`
- **add_secret**: `GENERATION_WORKER_SECRET` (random, server-only) + `GENERATION_WORKER_URL` set to the stable preview/production URL `project--{id}.lovable.app/api/public/run-generation-job`
- **edited** `src/server/generate-sticker.ts`:
  - `enqueueGeneration` (POST, requires auth): validates input (existing rules), inserts job, calls `reap_stale_generation_jobs()`, returns `{ jobId }`
  - `getGenerationStatus` (POST, requires auth, scoped to user): returns `{ status, imageUrl, errorMessage }`
- **new** `src/routes/api/public/run-generation-job.ts`: signed worker route — claims job, calls Lovable AI, persists artwork, writes final status. Uses `supabaseAdmin`.
- **edited** `src/routes/studio.create.tsx`: `runGeneration` calls `enqueueGeneration`, starts polling `getGenerationStatus` every 2s, stops on terminal state or 180s, surfaces errors via existing toast.

## What stays the same
- Lovable AI gateway, model, prompt format, reference upload flow, artwork persistence, text-layer flow, all existing UI, all existing validation.

## Expected outcome
- Generation never returns `upstream request timeout` to the client again — the user-facing request is just a fast DB insert.
- Long generations complete reliably; the worker call has its own request budget.
- Real failures (rate limit, credits, model error, true timeout) report a clear message backed by `error_detail` for debugging.
- Service role key never touches the client; worker route is HMAC-signed; stale jobs self-heal within 180s.
