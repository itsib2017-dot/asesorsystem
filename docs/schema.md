# F4 — Database Schema & Architecture

- **Project:** AsesorKompetensi
- **Database:** Supabase PostgreSQL (`oiplhsmmfuqriaqrxjud`)
- **Date:** 2026-11-19
- **Authority:** `ground_rules_v5.md` (§A.4) & ADR-0002

---

## 1. Tables Overview

| Table | Primary Key | Tenancy Key | Description | RLS Enabled |
| :--- | :--- | :--- | :--- | :--- |
| `public.lsps` | `id uuid` | Self (`id`) | LSP organizations / tenants | YES |
| `public.assessors` | `id uuid` (FK `auth.users`) | via membership | Assessor profiles and active signatures | YES |
| `public.lsp_memberships` | `(lsp_id, assessor_id)` | `lsp_id` | Role per LSP (`assessor`, `lsp_admin`, `tuk_admin`) | YES |
| `public.schemes` | `id uuid` | `lsp_id` | Certification schemes with JSONB manifest | YES |
| `public.scheme_form_manifests` | `id uuid` | `lsp_id` | Per-scheme form registry & versioned `.docx` blanko template references (`template_storage_path`, `template_file_name`, `template_sha256`, `template_version`, `template_uploaded_at`, `template_uploaded_by`) | YES |
| `public.batches` | `id uuid` | `lsp_id` | Assessment batches linked to Google Drive | YES |
| `public.batch_assessors` | `(batch_id, assessor_id)` | `lsp_id` | Assessor assignments per batch | YES |
| `public.assessees` | `id uuid` | `lsp_id` | Candidate / assessee records (unique partial index `assessees_batch_pseudonym_uidx` on `(batch_id, pseudonym)`) | YES |
| `public.app_config` | `id uuid` | `lsp_id` (optional) | Config parameters (global, lsp, scheme) | YES |
| `public.audit_log` | `id bigint` | `lsp_id` (optional) | Append-only immutable audit trail | YES |
| `public.jobs` | `id uuid` | via `created_by` | Background worker queue jobs | YES |
| `public.assessor_llm_config` | `id uuid` | via `assessor_id` | Encrypted BYOK AI credentials per assessor | YES |
| `public.interview_assessments` | `id uuid` | `lsp_id` | FR.IA.09 structured interview evaluations & VATM rollup | YES |
| `public.assessee_decision_overrides` | `id uuid` | `lsp_id` | Manual final-call override for AK.02 & AK.05 recommendations | YES |
| `public.batch_roster_notes` | `id uuid` | `lsp_id` | Append-only non-system roster reconciliation notes (distinct from `audit_log`) | YES |

---

## 2. Assessee CRUD RLS (roster management)

| Operation | Policy | Guard |
|-----------|--------|-------|
| SELECT assessees | `assessee_select` | `lsp_id = current_lsp_id()`; own batch for assessor, all in LSP for admin |
| INSERT assessees | `assessee_insert` | `lsp_id = current_lsp_id()`; actor must be batch owner or LSP admin |
| UPDATE assessees | `assessee_update` | `lsp_id = current_lsp_id()`; batch owner or LSP admin; cannot set `certificate_name_confirmed` via roster edit |
| DELETE assessees | `assessee_delete` | `lsp_id = current_lsp_id()`; only unconfirmed, zero linked files/decisions/gradings |

All assessee mutations are routed through `src/repositories/assessees.repository.ts` only — no Supabase client calls outside repositories (stack lock §A.2).

---

## 3. Applied Migrations

1. `20261118000001_foundation.sql`: Core tables, helper functions, and base RLS policies.
2. `20261118000002_hardening.sql`: Isolated helper functions to schema `private`, fixed init-plan RLS optimization.
3. `20261118000003_jobs_and_byok.sql`: Added `jobs` queue and `assessor_llm_config` table for encrypted BYOK.
4. `20261118000004_fix_advisor.sql`: Resolved multiple permissive policies advisor finding.
5. `20261118000005_full_platform_schema.sql`: Added signatures, manifests, prompt registry, drive_files, ocr_runs, name_jury_verdicts, decisions, dit_analyses, written_gradings, similarity_pairs, ak05_reports.
6. `20261118000006_jobs_update_policy.sql`: Added UPDATE RLS policy on `jobs`.
7. `20261118000007_audit_null_lsp_actor_scope.sql`: Scoped historical null-`lsp_id` logs to LSP admins.
8. `20261118000008_interview_assessments.sql`: Added `interview_assessments` table with multi-LSP RLS (`ia09_*`).
9. `20261119000009_assessee_decision_overrides.sql`: Added `assessee_decision_overrides` table (`ado_*`) storing assessor/admin final-call overrides (`K`/`BK`) with mandatory audit reason (`>= 5` chars when active).
10. `20261119000010_drive_file_metadata.sql`: Added `drive_modified_time`, `archive_parent_id`, `archive_entry_path` and `drive_files_modified_idx` on `public.drive_files`, plus `grant delete` and `assessees_delete` RLS policy on `public.assessees`.
11. `20261119000011_add_triage_unextractable.sql`: Expanded `drive_files.triage_status` CHECK constraint to include `'unextractable'`.
12. `20261119000012_batch_active_key_and_roster_notes.sql`: Added explicit active FR.IA.06B master key governance columns (`active_master_key_file_id`, `active_master_key_source`, `active_master_key_validation_status`, `active_master_key_validation_summary`, `active_master_key_activated_at`, `active_master_key_activated_by`) on `public.batches`, created append-only `public.batch_roster_notes` table with RLS (`brn_select`, `brn_insert`), and seeded the PII-free retroactive `26 -> 23` reconciliation note for `Demo Audit R4`.
13. `20261119000013_scheme_blanko_registry.sql`: Added `version` and `.docx` blanko template metadata columns (`template_storage_path`, `template_file_name`, `template_sha256`, `template_version`, `template_uploaded_at`, `template_uploaded_by`) on `public.scheme_form_manifests`, provisioned the private `scheme-blankos` Supabase Storage bucket with multi-tenant RLS (`scheme_blankos_bucket_select/insert/update/delete`), seeded 6 official `.docx` blanko references on `AK3U`, and seeded the second real non-K3 scheme `ICT-PM` (`Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)`) with 12 registered forms and 5 official `.docx` blankos.
14. `20261122000014_unique_assessee_pseudonym.sql`: Deduplicated any colliding non-null `pseudonym` rows per batch and added partial unique index `assessees_batch_pseudonym_uidx` on `public.assessees (batch_id, pseudonym) where pseudonym is not null`.
15. `20261122000015_refine_ak3u_manifest_and_adr0005_forms.sql`: Narrowed AK3U `04a` `file_patterns` (removing broad `'dit'` token that hijacked `04b` presentations), enriched `04b` with `'paparan'`, and registered ADR-0005 optional blanko/lampiran entries (`mapa01`, `mapa02`, `fr_va`, `ia07`, `ia08`, `ia10`, `ak03`, `ak04`, `ak06`, `ak07`, `berita_acara`) on AK3U schemes.
