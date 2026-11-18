-- Migration 20261118000008: FR.IA.09 Interview Assessments & Multi-LSP RLS (Cacat 3 / T5)

create table if not exists public.interview_assessments (
  id uuid primary key default gen_random_uuid(),
  lsp_id uuid not null,
  batch_id uuid not null,
  assessee_id uuid not null references public.assessees(id) on delete cascade,
  source_file_id uuid references public.drive_files(id) on delete set null,
  questions jsonb not null default '[]'::jsonb,
  overall_recommendation text not null check (overall_recommendation in ('K','BK')),
  vatm_unit_recommendations jsonb not null default '[]'::jsonb,
  assessor_notes text not null default '',
  assessed_by uuid references public.assessors(id),
  assessed_at timestamptz not null default now(),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, lsp_id) references public.batches(id, lsp_id) on delete cascade
);

create index if not exists ia09_batch_lsp_idx on public.interview_assessments (batch_id, lsp_id);
create index if not exists ia09_assessee_idx on public.interview_assessments (assessee_id);

drop trigger if exists interview_assessments_touch on public.interview_assessments;
create trigger interview_assessments_touch
  before update on public.interview_assessments
  for each row execute function public.touch_row();

alter table public.interview_assessments enable row level security;
alter table public.interview_assessments force row level security;

grant select, insert, update on public.interview_assessments to authenticated;

create policy ia09_select on public.interview_assessments for select to authenticated
  using (
    private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
    or private.auth_on_batch(batch_id)
  );

create policy ia09_insert on public.interview_assessments for insert to authenticated
  with check (
    private.auth_has_role(lsp_id, array['lsp_admin','assessor']::public.lsp_role[])
    and (
      private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[])
      or private.auth_on_batch(batch_id)
    )
  );

create policy ia09_update on public.interview_assessments for update to authenticated
  using (
    private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[])
    or private.auth_on_batch(batch_id)
  )
  with check (
    private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[])
    or private.auth_on_batch(batch_id)
  );
