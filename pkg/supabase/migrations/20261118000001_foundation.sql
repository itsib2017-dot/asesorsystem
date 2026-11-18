-- UNVERIFIED: written without a Postgres instance. Run `supabase db reset` + RLS tests before trusting.
-- Multi-LSP (tenant = lsp), per-assessor visibility. Ref: docs/rbac-matrix.md, ADR-0002.
create extension if not exists pgcrypto;

create type public.lsp_role as enum ('assessor','lsp_admin','tuk_admin');

create table public.lsps (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assessors (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null,
  active_signature_path text,
  onboarded_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lsp_memberships (
  lsp_id uuid not null references public.lsps(id) on delete restrict,
  assessor_id uuid not null references public.assessors(id) on delete restrict,
  role public.lsp_role not null,
  created_at timestamptz not null default now(),
  primary key (lsp_id, assessor_id)
);
create index on public.lsp_memberships (assessor_id);

create table public.schemes (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null references public.lsps(id) on delete restrict,
  code text not null,
  name text not null,
  manifest jsonb not null default '{}'::jsonb,   -- D17/D21: file set, counts, rules from config, never code
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lsp_id, code),
  unique (id, lsp_id)
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  scheme_id uuid not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','ingesting','triage','in_assessment','closed')),
  created_by uuid not null references public.assessors(id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scheme_id, lsp_id) references public.schemes(id, lsp_id),  -- scheme must belong to same LSP
  unique (id, lsp_id)
);
create index on public.batches (lsp_id, status);

create table public.batch_assessors (
  batch_id uuid not null,
  lsp_id uuid not null,
  assessor_id uuid not null,
  primary key (batch_id, assessor_id),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade,
  foreign key (lsp_id, assessor_id) references public.lsp_memberships(lsp_id, assessor_id)
);
create index on public.batch_assessors (assessor_id);

create table public.assessees (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  assigned_assessor_id uuid references public.assessors(id),
  display_name text not null,           -- PII: listed in docs/data-inventory.md (to create)
  status text not null default 'new',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete restrict
);
create index on public.assessees (batch_id);
create index on public.assessees (assigned_assessor_id);

create table public.app_config (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global','lsp','scheme')),
  lsp_id uuid references public.lsps(id),
  scheme_id uuid references public.schemes(id),
  key text not null,
  value jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  check ((scope='global' and lsp_id is null and scheme_id is null)
      or (scope='lsp' and lsp_id is not null and scheme_id is null)
      or (scope='scheme' and lsp_id is not null and scheme_id is not null))
);
create unique index app_config_uq on public.app_config (scope, lsp_id, scheme_id, key) nulls not distinct;

create table public.audit_log (
  id bigint generated always as identity primary key,
  lsp_id uuid,
  actor_id uuid,
  action text not null,
  resource text not null,
  resource_id text,
  before_summary jsonb,
  after_summary jsonb,
  break_glass_reason text,
  correlation_id text not null,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.audit_log (lsp_id, created_at desc);

-- ===== helpers (SECURITY DEFINER, fixed search_path; avoid RLS recursion) =====
create function public.auth_is_member(p_lsp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lsp_memberships m where m.lsp_id = p_lsp and m.assessor_id = auth.uid())
$$;
create function public.auth_has_role(p_lsp uuid, p_roles public.lsp_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lsp_memberships m
                 where m.lsp_id = p_lsp and m.assessor_id = auth.uid() and m.role = any (p_roles))
$$;
create function public.auth_on_batch(p_batch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.batch_assessors b where b.batch_id = p_batch and b.assessor_id = auth.uid())
$$;
create function public.touch_row() returns trigger language plpgsql as $$
begin new.version := old.version + 1; new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['lsps','assessors','schemes','batches','assessees','app_config'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_row()', t||'_touch', t);
  end loop; end $$;

-- ===== append-only audit =====
create function public.audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_no_update before update or delete on public.audit_log for each row execute function public.audit_immutable();
create trigger audit_no_truncate before truncate on public.audit_log for each statement execute function public.audit_immutable();

-- ===== RLS =====
alter table public.lsps enable row level security;            alter table public.lsps force row level security;
alter table public.assessors enable row level security;       alter table public.assessors force row level security;
alter table public.lsp_memberships enable row level security; alter table public.lsp_memberships force row level security;
alter table public.schemes enable row level security;         alter table public.schemes force row level security;
alter table public.batches enable row level security;         alter table public.batches force row level security;
alter table public.batch_assessors enable row level security; alter table public.batch_assessors force row level security;
alter table public.assessees enable row level security;       alter table public.assessees force row level security;
alter table public.app_config enable row level security;      alter table public.app_config force row level security;
alter table public.audit_log enable row level security;       alter table public.audit_log force row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.lsps, public.lsp_memberships, public.schemes, public.batch_assessors to authenticated;
grant select, update on public.assessors to authenticated;
grant insert, update, delete on public.lsp_memberships, public.schemes, public.batch_assessors to authenticated;
grant select, insert, update on public.batches, public.assessees to authenticated;
grant select, insert, update on public.app_config to authenticated;
grant select, insert on public.audit_log to authenticated;

create policy lsps_select on public.lsps for select to authenticated using (public.auth_is_member(id));

create policy assessors_select on public.assessors for select to authenticated
  using (id = auth.uid() or exists (select 1 from public.lsp_memberships me
        join public.lsp_memberships o on o.lsp_id = me.lsp_id
        where me.assessor_id = auth.uid() and me.role = 'lsp_admin' and o.assessor_id = assessors.id));
create policy assessors_update_self on public.assessors for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy mem_select on public.lsp_memberships for select to authenticated
  using (assessor_id = auth.uid() or public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));
create policy mem_admin_write on public.lsp_memberships for all to authenticated
  using (public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) and assessor_id <> auth.uid())
  with check (public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) and assessor_id <> auth.uid()); -- cannot grant/revoke own role

create policy schemes_select on public.schemes for select to authenticated using (public.auth_is_member(lsp_id));
create policy schemes_admin_write on public.schemes for all to authenticated
  using (public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]))
  with check (public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));

create policy batches_select on public.batches for select to authenticated
  using (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or public.auth_on_batch(id));
create policy batches_insert on public.batches for insert to authenticated
  with check (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin','assessor']::public.lsp_role[]) and created_by = auth.uid());
create policy batches_update on public.batches for update to authenticated
  using (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or public.auth_on_batch(id))
  with check (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or public.auth_on_batch(id));

create policy ba_select on public.batch_assessors for select to authenticated
  using (assessor_id = auth.uid() or public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]));
create policy ba_write on public.batch_assessors for all to authenticated
  using (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]))
  with check (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]));

create policy assessees_select on public.assessees for select to authenticated
  using (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
         or (assigned_assessor_id = auth.uid() and public.auth_on_batch(batch_id)));
create policy assessees_insert on public.assessees for insert to authenticated
  with check (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]) or public.auth_on_batch(batch_id));
create policy assessees_update on public.assessees for update to authenticated
  using (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
         or (assigned_assessor_id = auth.uid() and public.auth_on_batch(batch_id)))
  with check (public.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
         or (assigned_assessor_id = auth.uid() and public.auth_on_batch(batch_id)));

create policy cfg_select on public.app_config for select to authenticated
  using (scope = 'global' or public.auth_is_member(lsp_id));
create policy cfg_insert on public.app_config for insert to authenticated
  with check (scope <> 'global' and public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));
create policy cfg_update on public.app_config for update to authenticated
  using (scope <> 'global' and public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]))
  with check (scope <> 'global' and public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));

create policy audit_select on public.audit_log for select to authenticated
  using (lsp_id is not null and public.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));
create policy audit_insert on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid() and (lsp_id is null or public.auth_is_member(lsp_id)));
-- Bootstrapping LSP / first admin: service-role function only, 2-person approval (ADR-0004). Not in this migration.
