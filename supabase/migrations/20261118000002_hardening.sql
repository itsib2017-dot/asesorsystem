-- UNVERIFIED (no Postgres in authoring sandbox). Fixes Supabase Security + Performance advisor findings.
-- New migration; never edit 000001 (already applied).

-- 1) Private schema for RLS helpers: not exposed by the Data API, no anon access.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.auth_is_member(uuid) set schema private;
alter function public.auth_has_role(uuid, public.lsp_role[]) set schema private;
alter function public.auth_on_batch(uuid) set schema private;

create or replace function private.auth_is_member(p_lsp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lsp_memberships m
                 where m.lsp_id = p_lsp and m.assessor_id = (select auth.uid()))
$$;
create or replace function private.auth_has_role(p_lsp uuid, p_roles public.lsp_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lsp_memberships m
                 where m.lsp_id = p_lsp and m.assessor_id = (select auth.uid()) and m.role = any (p_roles))
$$;
create or replace function private.auth_on_batch(p_batch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.batch_assessors b
                 where b.batch_id = p_batch and b.assessor_id = (select auth.uid()))
$$;
revoke execute on function private.auth_is_member(uuid), private.auth_has_role(uuid, public.lsp_role[]),
  private.auth_on_batch(uuid) from public, anon;
grant execute on function private.auth_is_member(uuid), private.auth_has_role(uuid, public.lsp_role[]),
  private.auth_on_batch(uuid) to authenticated;

-- 2) Mutable search_path on trigger functions
alter function public.touch_row() set search_path = '';
alter function public.audit_immutable() set search_path = '';

-- 3) Supabase-provided event-trigger helper: not meant to be callable via API
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 4) Policies: (select auth.uid()) init-plan fix + remove overlapping permissive policies
drop policy if exists assessors_select on public.assessors;
drop policy if exists assessors_update_self on public.assessors;
drop policy if exists mem_select on public.lsp_memberships;
drop policy if exists mem_admin_write on public.lsp_memberships;
drop policy if exists schemes_admin_write on public.schemes;
drop policy if exists batches_insert on public.batches;
drop policy if exists ba_select on public.batch_assessors;
drop policy if exists ba_write on public.batch_assessors;
drop policy if exists assessees_select on public.assessees;
drop policy if exists assessees_insert on public.assessees;
drop policy if exists assessees_update on public.assessees;
drop policy if exists audit_insert on public.audit_log;

create policy assessors_select on public.assessors for select to authenticated
  using (id = (select auth.uid()) or exists (
    select 1 from public.lsp_memberships me join public.lsp_memberships o on o.lsp_id = me.lsp_id
    where me.assessor_id = (select auth.uid()) and me.role = 'lsp_admin' and o.assessor_id = assessors.id));
create policy assessors_update_self on public.assessors for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy mem_select on public.lsp_memberships for select to authenticated
  using (assessor_id = (select auth.uid()) or private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));
create policy mem_insert on public.lsp_memberships for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) and assessor_id <> (select auth.uid()));
create policy mem_update on public.lsp_memberships for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) and assessor_id <> (select auth.uid()))
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) and assessor_id <> (select auth.uid()));
create policy mem_delete on public.lsp_memberships for delete to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]) and assessor_id <> (select auth.uid()));

create policy schemes_insert on public.schemes for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));
create policy schemes_update on public.schemes for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]))
  with check (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));
create policy schemes_delete on public.schemes for delete to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[]));

create policy batches_insert on public.batches for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin','assessor']::public.lsp_role[])
              and created_by = (select auth.uid()));

create policy ba_select on public.batch_assessors for select to authenticated
  using (assessor_id = (select auth.uid()) or private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]));
create policy ba_insert on public.batch_assessors for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]));
create policy ba_update on public.batch_assessors for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]))
  with check (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]));
create policy ba_delete on public.batch_assessors for delete to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[]));

create policy assessees_select on public.assessees for select to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
         or (assigned_assessor_id = (select auth.uid()) and private.auth_on_batch(batch_id)));
create policy assessees_insert on public.assessees for insert to authenticated
  with check (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
              or private.auth_on_batch(batch_id));
create policy assessees_update on public.assessees for update to authenticated
  using (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
         or (assigned_assessor_id = (select auth.uid()) and private.auth_on_batch(batch_id)))
  with check (private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
         or (assigned_assessor_id = (select auth.uid()) and private.auth_on_batch(batch_id)));

create policy audit_insert on public.audit_log for insert to authenticated
  with check (actor_id = (select auth.uid()) and (lsp_id is null or private.auth_is_member(lsp_id)));

-- 5) Covering indexes for foreign keys
create index if not exists batches_created_by_idx on public.batches (created_by);
create index if not exists batches_scheme_lsp_idx on public.batches (scheme_id, lsp_id);
create index if not exists batch_assessors_batch_lsp_idx on public.batch_assessors (batch_id, lsp_id);
create index if not exists batch_assessors_lsp_assessor_idx on public.batch_assessors (lsp_id, assessor_id);
create index if not exists assessees_batch_lsp_idx on public.assessees (batch_id, lsp_id);
create index if not exists app_config_lsp_idx on public.app_config (lsp_id);
create index if not exists app_config_scheme_idx on public.app_config (scheme_id);
