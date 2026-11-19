# Round 11 Audit Remediation Report

**Timestamp:** 2026-11-19 14:57 WIB  
**Previous Commit:** `326f436`  
**Remediation Commit:** `9a4fd86`  
**Live Target:** `https://assessor-zeta.vercel.app`  
**Remote Supabase:** `oiplhsmmfuqriaqrxjud` (`20261118000001..20261119000012` synced)

---

## 1. Summary of Changes (Round 11 Cacat 1 & Cacat 2)

| Item | Defect / Scope | Files Changed | Resolution |
|---|---|---|---|
| **Cacat 1 (Tinggi)** | Blanko `FR.IA.06B` from `AK3U LSP K3 Nasional.zip` (`227,328` bytes, OLE-encrypted `d0cf11e0a1b11ae1`, `extracted_text = null`) auto-displayed as `"Aktif"` on Batch Detail and Written Grading pages; ZIP timestamp also outranked manual uploads in `pickLatestDriveFile` | `supabase/migrations/20261119000012_batch_active_key_and_roster_notes.sql`, `src/db/schema.ts`, `src/repositories/batches.repository.ts`, `src/lib/written/master-key.ts`, `src/worker/index.ts`, `src/services/grading.ts`, `src/app/(app)/batches/[id]/actions.ts`, `src/components/batch/batch-key-upload-panel.tsx`, `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/{page.tsx,actions.ts,_components/written-key-form.tsx}`, `src/app/(app)/batches/[id]/triage/page.tsx`, `src/app/(app)/settings/audit/page.tsx`, tests | Added explicit active key governance columns (`active_master_key_file_id`, `active_master_key_source`, `active_master_key_validation_status`, `active_master_key_validation_summary`, `active_master_key_activated_at`, `active_master_key_activated_by`) on `public.batches` (default `NULL` — deactivating the blanko in `Demo Audit R4` without deleting the `drive_files` row). Built pure validator `validateMasterKey06bContent` (rejects empty files, image-only placeholders, unaltered BNSP `06B`/`06C` blanko skeletons, and `FR.IA.06A` question sheets) and single resolver `resolveBatchActiveMasterKey`. `expandZipArchivesForScan` never auto-activates MUK archive `06b` files and labels encrypted/blanko entries explicitly. Added `activateBatchMasterKey06bAction` & `deactivateBatchMasterKey06bAction` (`lsp_admin`/`assessor` RBAC + audit trail), candidate list with origin/validation metadata in `BatchKeyUploadPanel`, and multi-layer blocking gates in `WrittenKeyForm`, `runWrittenGradingWithKeyAction`, `handleWrittenGradingJob`, and `runWrittenGradingPipeline`. |
| **Cacat 2 (Menengah)** | Retroactive `26 → 23` roster change from Round 9/10 rescan `96c64849` had no UI explanation in Triage | `supabase/migrations/20261119000012_batch_active_key_and_roster_notes.sql`, `src/db/schema.ts`, `src/repositories/batches.repository.ts`, `src/app/(app)/batches/[id]/triage/{page.tsx,actions.ts}`, `tests/rls-multi-lsp.test.sql` | Created RLS-protected append-only `public.batch_roster_notes` table (`SELECT, INSERT` only — never touches or fabricates `public.audit_log`). Seeded idempotent, PII-free retroactive `26 → 23` note for `Demo Audit R4` (`source_label = "Berdasarkan laporan remediasi developer 19 Nov 2026, bukan entri log sistem"`). Updated `/batches/[id]/triage` **Jejak Penyelarasan Daftar Asesi** to display both `Log Sistem (Otomatis)` (`batch.roster.reconciled`) and `Catatan Non-Log Sistem` (`batch_roster_notes`) with explicit source attribution, plus a collapsible manual note form (`addBatchRosterNoteAction`) for future out-of-band adjustments. |
| **Panduan BYOK** | Attached assessor guide for OpenCode Zen & NVIDIA NIM | Verified read-only (`src/app/(app)/settings/provider/*`, `src/ai/llm.ts`) | Confirmed `/settings/provider` already supports both gateways via `OpenAI-compatible` tab (`Temperature = 0`, `Max Tokens = 16000/51200`, `Thinking Budget = 0`, `Test connection` hitting `/models`). Kept untouched per minimal diff rule. |

---

## 2. Verification Results

| Gate | Command | Result |
|---|---|---|
| TypeScript Strict | `npm run typecheck` | **PASS** (0 errors) |
| ESLint Zero Warnings | `npx eslint . --max-warnings 0` | **PASS** (0 errors, 0 warnings) |
| Vitest Unit Suite | `npm test` | **PASS** (`26/26` files, `110/110` tests) |
| Production Build | `npm run build` | **PASS** (`Compiled successfully in 59s`, 36 routes + Proxy Middleware) |
| Remote Supabase Migration | `npx supabase db push --remote --yes` & `migration list --remote` | **PASS** (`20261118000001..20261119000012` synced) |
| Remote Multi-LSP RLS | `npx supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | **PASS** (`40/40` PASS, `0` FAIL incl. `RLS-38..RLS-40` `batch_roster_notes`) |
| Remote Demo Audit R4 DB State | `npx supabase db query --remote --read-only ...` | **PASS** (`batches.active_master_key_file_id = null`; blanko `drive_files` row `2179b19b-1c9e-4ad6-a2f6-d7816ec9f7ab` preserved untouched with `doc_type = '06b'`, `triage_status = 'not_needed'`; `batch_roster_notes` row `[26 → 23]` present with honest `source_label`) |
| Secret Hygiene Scan | Regex scan across `src/`, `supabase/`, `tests/` | **PASS** (`0` real secrets) |

---

## 3. Codebase Footprint (Explicit `wc -l`-Equivalent Methodology)

Measured via Node `fs` counting `\n` bytes across all `src/**/*.{ts,tsx}` files:
- **Total `src/` (`*.ts`, `*.tsx`, including tests):** `164` files / **`30,565` lines** (was `163` files / `28,516` lines at `326f436`).
- **Non-test `src/` (`*.ts`, `*.tsx`, excluding `__tests__`, `*.test.*`, `*.spec.*`):** `138` files / **`26,404` lines** (was `138` files / `24,746` lines at `326f436`).
