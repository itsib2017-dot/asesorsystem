-- Migration 20261119000010: Drive File Revision Timestamps, Archive Lineage & Assessee Pruning RLS (Round 8)

alter table public.drive_files
  add column if not exists drive_modified_time timestamptz,
  add column if not exists archive_parent_id uuid references public.drive_files(id) on delete cascade,
  add column if not exists archive_entry_path text;

create index if not exists drive_files_modified_idx
  on public.drive_files (batch_id, doc_type, drive_modified_time desc);

grant delete on public.assessees to authenticated;

drop policy if exists assessees_delete on public.assessees;
create policy assessees_delete on public.assessees for delete to authenticated
  using (
    private.auth_has_role(lsp_id, array['lsp_admin','tuk_admin']::public.lsp_role[])
    or (
      assigned_assessor_id = (select auth.uid())
      and private.auth_on_batch(batch_id)
    )
  );
