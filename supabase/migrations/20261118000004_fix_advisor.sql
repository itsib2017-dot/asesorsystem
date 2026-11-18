-- Migration 20261118000004: Fix multiple permissive policies advisor finding on assessor_llm_config

drop policy if exists llm_config_write on public.assessor_llm_config;

create policy llm_config_insert on public.assessor_llm_config for insert to authenticated
  with check (assessor_id = (select auth.uid()));

create policy llm_config_update on public.assessor_llm_config for update to authenticated
  using (assessor_id = (select auth.uid()))
  with check (assessor_id = (select auth.uid()));

create policy llm_config_delete on public.assessor_llm_config for delete to authenticated
  using (assessor_id = (select auth.uid()));
