-- Migration 20261118000006: Allow authenticated job owners to update their own job progress/status
drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
