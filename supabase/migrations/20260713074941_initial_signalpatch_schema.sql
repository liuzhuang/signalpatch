create schema if not exists signalpatch;

revoke all on schema signalpatch from public, anon, authenticated;
grant usage on schema signalpatch to anon, service_role;

create type signalpatch.repair_status as enum (
  'RECEIVED',
  'QUALIFYING',
  'BUILDING',
  'VERIFYING',
  'REPAIRING',
  'OBSERVING',
  'RELEASED',
  'NEEDS_INPUT',
  'HUMAN_REQUIRED'
);

create type signalpatch.automation_state as enum (
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'HUMAN_REQUIRED'
);

create table signalpatch.problems (
  id uuid primary key default gen_random_uuid(),
  fingerprint text unique,
  summary text,
  issue_number bigint unique,
  spec_ready boolean not null default false,
  repair_status signalpatch.repair_status not null default 'RECEIVED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table signalpatch.feedback (
  id uuid primary key default gen_random_uuid(),
  tracking_id uuid not null unique default gen_random_uuid(),
  problem_id uuid references signalpatch.problems(id) on delete set null,
  message text not null check (char_length(message) between 1 and 2000),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  synthetic boolean not null default false,
  intake_status text not null default 'PENDING'
    check (intake_status in ('PENDING', 'PROCESSING', 'PROCESSED', 'NEEDS_EVIDENCE')),
  processing_started_at timestamptz,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index feedback_pending_idx
  on signalpatch.feedback (created_at)
  where intake_status = 'PENDING';

create index feedback_problem_idx
  on signalpatch.feedback (problem_id)
  where problem_id is not null;

create table signalpatch.automation_runs (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references signalpatch.problems(id) on delete cascade,
  issue_number bigint not null,
  pull_request_number bigint,
  stage text not null,
  state signalpatch.automation_state not null default 'QUEUED',
  idempotency_key text not null unique,
  head_sha text,
  attempt smallint not null default 0 check (attempt between 0 and 3),
  failure_fingerprint text,
  preview_url text,
  production_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_runs_issue_idx
  on signalpatch.automation_runs (issue_number, created_at desc);

alter table signalpatch.feedback enable row level security;
alter table signalpatch.problems enable row level security;
alter table signalpatch.automation_runs enable row level security;

revoke all on all tables in schema signalpatch from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema signalpatch to service_role;

create or replace function signalpatch.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger problems_touch_updated_at
before update on signalpatch.problems
for each row execute function signalpatch.touch_updated_at();

create trigger automation_runs_touch_updated_at
before update on signalpatch.automation_runs
for each row execute function signalpatch.touch_updated_at();

create or replace function signalpatch.submit_feedback(
  p_message text,
  p_context jsonb default '{}'::jsonb,
  p_synthetic boolean default false
)
returns table (
  tracking_id uuid,
  repair_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted signalpatch.feedback;
  sanitized_context jsonb;
begin
  if p_message is null or char_length(btrim(p_message)) = 0 then
    raise exception 'feedback_message_required' using errcode = '22023';
  end if;
  if char_length(btrim(p_message)) > 2000 then
    raise exception 'feedback_message_too_long' using errcode = '22023';
  end if;
  if p_context is null or jsonb_typeof(p_context) <> 'object' then
    raise exception 'feedback_context_invalid' using errcode = '22023';
  end if;

  sanitized_context := jsonb_strip_nulls(jsonb_build_object(
    'feature', left(p_context ->> 'feature', 200),
    'route', left(p_context ->> 'route', 200),
    'commitSha', left(p_context ->> 'commitSha', 200),
    'errorCode', left(p_context ->> 'errorCode', 200),
    'occurredAt', left(p_context ->> 'occurredAt', 200)
  ));

  insert into signalpatch.feedback (message, context, synthetic)
  values (btrim(p_message), sanitized_context, coalesce(p_synthetic, false))
  returning * into inserted;

  return query
  select inserted.tracking_id, 'RECEIVED'::text, inserted.created_at;
end;
$$;

create or replace function signalpatch.get_repair_status(p_tracking_id text)
returns table (
  repair_status text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(problem.repair_status, 'RECEIVED'::signalpatch.repair_status)::text,
    coalesce(problem.updated_at, feedback.created_at)
  from signalpatch.feedback as feedback
  left join signalpatch.problems as problem on problem.id = feedback.problem_id
  where feedback.tracking_id::text = p_tracking_id
  limit 1;
$$;

revoke execute on all functions in schema signalpatch from public, anon, authenticated;
grant execute on function signalpatch.submit_feedback(text, jsonb, boolean) to anon, service_role;
grant execute on function signalpatch.get_repair_status(text) to anon, service_role;
grant execute on function signalpatch.touch_updated_at() to service_role;

alter default privileges in schema signalpatch revoke execute on functions from public;
alter default privileges in schema signalpatch revoke all on tables from public, anon, authenticated;
alter default privileges in schema signalpatch grant select, insert, update, delete on tables to service_role;
