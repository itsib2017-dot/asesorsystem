-- Migration 20261118000003: Jobs queue and Assessor BYOK LLM Configuration

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.assessors(id) on delete set null,
  type text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  progress int not null default 0,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessor_llm_config (
  id uuid primary key default gen_random_uuid(),
  assessor_id uuid not null references public.assessors(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai-compatible', 'gemini')),
  base_url text,
  model text not null,
  encrypted_api_key text not null,
  encrypted_gateway_token text,
  temperature numeric(3,2) not null default 0.90,
  max_tokens int not null default 51200,
  thinking_budget int not null default 0,
  google_drive_api_key_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessor_id, provider)
);

-- RLS
alter table public.jobs enable row level security;
alter table public.jobs force row level security;

alter table public.assessor_llm_config enable row level security;
alter table public.assessor_llm_config force row level security;

grant select, insert, update on public.jobs to authenticated;
grant select, insert, update, delete on public.assessor_llm_config to authenticated;

create policy jobs_select on public.jobs for select to authenticated
  using (created_by = (select auth.uid()));

create policy jobs_insert on public.jobs for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy llm_config_select on public.assessor_llm_config for select to authenticated
  using (assessor_id = (select auth.uid()));

create policy llm_config_write on public.assessor_llm_config for all to authenticated
  using (assessor_id = (select auth.uid()))
  with check (assessor_id = (select auth.uid()));

-- Indexes
create index if not exists jobs_created_by_idx on public.jobs (created_by);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists llm_config_assessor_idx on public.assessor_llm_config (assessor_id);
