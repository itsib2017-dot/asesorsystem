# F4 — Database Schema & Architecture

- **Project:** AsesorKompetensi
- **Database:** Supabase PostgreSQL (`oiplhsmmfuqriaqrxjud`)
- **Date:** 2026-11-18
- **Authority:** `ground_rules_v5.md` (§A.4) & ADR-0002

---

## 1. Tables Overview

| Table | Primary Key | Tenancy Key | Description | RLS Enabled |
| :--- | :--- | :--- | :--- | :--- |
| `public.lsps` | `id uuid` | Self (`id`) | LSP organizations / tenants | YES |
| `public.assessors` | `id uuid` (FK `auth.users`) | via membership | Assessor profiles and active signatures | YES |
| `public.lsp_memberships` | `(lsp_id, assessor_id)` | `lsp_id` | Role per LSP (`assessor`, `lsp_admin`, `tuk_admin`) | YES |
| `public.schemes` | `id uuid` | `lsp_id` | Certification schemes with JSONB manifest | YES |
| `public.batches` | `id uuid` | `lsp_id` | Assessment batches linked to Google Drive | YES |
| `public.batch_assessors` | `(batch_id, assessor_id)` | `lsp_id` | Assessor assignments per batch | YES |
| `public.assessees` | `id uuid` | `lsp_id` | Candidate / assessee records | YES |
| `public.app_config` | `id uuid` | `lsp_id` (optional) | Config parameters (global, lsp, scheme) | YES |
| `public.audit_log` | `id bigint` | `lsp_id` (optional) | Append-only immutable audit trail | YES |
| `public.jobs` | `id uuid` | via `created_by` | Background worker queue jobs | YES |
| `public.assessor_llm_config` | `id uuid` | via `assessor_id` | Encrypted BYOK AI credentials per assessor | YES |

---

## 2. Applied Migrations

1. `20261118000001_foundation.sql`: Core tables, helper functions, and base RLS policies.
2. `20261118000002_hardening.sql`: Isolated helper functions to schema `private`, fixed init-plan RLS optimization.
3. `20261118000003_jobs_and_byok.sql`: Added `jobs` queue and `assessor_llm_config` table for encrypted BYOK.
4. `20261118000004_fix_advisor.sql`: Resolved multiple permissive policies advisor finding.
