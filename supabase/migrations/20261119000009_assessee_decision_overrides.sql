-- Migration 20261119000009: Manual Assessor Final-Call Override for AK.02 & AK.05 (Cacat 2 / T2)
-- Forward-only schema + strict Multi-LSP & RBAC RLS (assessor / lsp_admin only; tuk_admin read-only)

create table if not exists public.assessee_decision_overrides (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  assessee_id uuid not null references public.assessees(id) on delete cascade,
  override_decision text check (override_decision in ('K', 'BK')),
  override_reason text not null default '',
  overridden_by uuid references public.assessors(id),
  overridden_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade,
  unique (assessee_id),
  constraint ado_reason_required_when_active check (
    override_decision is null or char_length(btrim(override_reason)) >= 5
  )
);

create index if not exists ado_batch_lsp_idx on public.assessee_decision_overrides (batch_id, lsp_id);
create index if not exists ado_assessee_idx on public.assessee_decision_overrides (assessee_id);

drop trigger if exists assessee_decision_overrides_touch on public.assessee_decision_overrides;
create trigger assessee_decision_overrides_touch
  before update on public.assessee_decision_overrides
  for each row execute function public.touch_row();

alter table public.assessee_decision_overrides enable row level security;
alter table public.assessee_decision_overrides force row level security;

grant select, insert, update on public.assessee_decision_overrides to authenticated;

create policy ado_select on public.assessee_decision_overrides for select to authenticated
  using (
    private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
    or private.auth_on_batch(batch_id)
  );

create policy ado_insert on public.assessee_decision_overrides for insert to authenticated
  with check (
    private.auth_has_role(lsp_id, array['lsp_admin','assessor']::public.lsp_role[])
    and (
      private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[])
      or private.auth_on_batch(batch_id)
    )
  );

create policy ado_update on public.assessee_decision_overrides for update to authenticated
  using (
    private.auth_has_role(lsp_id, array['lsp_admin','assessor']::public.lsp_role[])
    and (
      private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[])
      or private.auth_on_batch(batch_id)
    )
  )
  with check (
    private.auth_has_role(lsp_id, array['lsp_admin','assessor']::public.lsp_role[])
    and (
      private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[])
      or private.auth_on_batch(batch_id)
    )
  );
