-- Migration 20261118000007: Allow lsp_admin to inspect historical null-lsp_id audit rows
-- scoped strictly to actors who are members of that LSP, while keeping audit_log append-only.
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (
    (
      lsp_id is not null
      and private.auth_has_role(lsp_id, array['lsp_admin']::public.lsp_role[])
    )
    or (
      lsp_id is null
      and actor_id is not null
      and exists (
        select 1
        from public.lsp_memberships me
        join public.lsp_memberships target on target.lsp_id = me.lsp_id
        where me.assessor_id = (select auth.uid())
          and me.role = 'lsp_admin'
          and target.assessor_id = audit_log.actor_id
      )
    )
  );
