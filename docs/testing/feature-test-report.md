# Feature Test Report

- **Date:** 2026-11-19 (Round 11–13 Audit Remediation)
- **Environment:** Remote Supabase (`oiplhsmmfuqriaqrxjud`) + Local Node.js + Local Production Server (`next start -p 3199`) + Live Vercel (`https://assessor-zeta.vercel.app`)
- **Authority:** `ground_rules_v5.md` (§Feature/Module Testing)
- **Mode:** AUDIT MODE (§0.2 ground_rules_v5.md) — audit log scoping & 06B key activation trust boundary

---

## 1. PostgreSQL RLS Verification (`tests/rls-multi-lsp.test.sql`)

- **RLS-01..RLS-25**: Foundation tables (`lsps`, `schemes`, `batches`, `assessees`, `app_config`, `audit_log`) — **25/25 PASS**.
- **RLS-26..RLS-31**: Phase 1–5 tables (`scheme_form_manifests`, `drive_files`, `decisions`, `ak05_reports`, `assessor_llm_config`) — **6/6 PASS**.
- **RLS-32**: Phase A (`interview_assessments` cross-LSP isolation) — **1/1 PASS**.
- **RLS-33..RLS-35**: Migration `20261119000009_assessee_decision_overrides.sql` (`assessee_decision_overrides` cross-LSP isolation, `tuk_admin` write block, unassigned assessor batch block) — **3/3 PASS**.
- **RLS-36**: Migration `20261119000010_drive_file_metadata.sql` (`assessees_delete` cross-LSP `DELETE` blocked with `0` rows affected) — **1/1 PASS**.
- **RLS-37**: Migration `20261119000011_add_triage_unextractable.sql` (`drive_files.triage_status = 'unextractable'` permitted for authorized LSP assessor) — **1/1 PASS**.
- **RLS-38..RLS-40**: Migration `20261119000012_batch_active_key_and_roster_notes.sql` (`batch_roster_notes` cross-LSP isolation, assigned-batch insert allowed, unassigned-batch insert rejected) — **3/3 PASS** (`supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql`: **40/40 PASS**, **0 FAIL**).

---

## 2. Vitest Unit & Contract Suite (`npm test`)

| Test File | Scenarios | Result | Evidence |
| :--- | :--- | :--- | :--- |
| `src/ai/__tests__/redact.test.ts` | 4 tests (NIK/phone/image redaction, Jury allow-list) | **PASS** | `npm test` |
| `src/lib/crypto/__tests__/encryption.test.ts` | 4 tests (AES-256-GCM roundtrip, tamper detect, missing secret) | **PASS** | `npm test` |
| `src/lib/security/__tests__/ssrf.test.ts` | 3 tests (private IP/localhost block, Drive allow-list) | **PASS** | `npm test` |
| `src/lib/security/__tests__/rate-limit.test.ts` | 2 tests (sliding rate limit throttle, internal redirect sanitizer) | **PASS** | `npm test` |
| `src/lib/__tests__/names.test.ts` | 5 tests (KTP authority, confidence floor, Declan Rice, Wiwi vs Wiwik, R8 ambiguous BNSP spelling matching) | **PASS** | `npm test` |
| `src/lib/audit/__tests__/write-audit-log.test.ts` | 6 tests (audit insert, error catch, `resolveAuditResourceHref` batch/job routing, `formatAuditSummary` 06B rejection fields) | **PASS** | `npm test` |
| `src/repositories/__tests__/audit.repository.test.ts` | 3 tests (Supabase & Drizzle dual-path SQL `lsp_id IS NULL` actor scoping, deterministic `created_at DESC, id DESC`, `beforeId` cursor, `listAuditLogsForResource` scoping, ID deduplication) | **PASS** | `npm test` |
| `src/lib/config/__tests__/get-config.test.ts` | 3 tests (hierarchical `scheme -> lsp -> global -> default` `app_config` resolution) | **PASS** | `npm test` |
| `src/services/__tests__/similarity.test.ts` | 1 test (copy-paste vs paraphrase vs unrelated calibration) | **PASS** | `npm test` |
| `src/services/__tests__/export.test.ts` | 5 tests (D8 format lock, AK.05 PDF/DOCX/XLSX, signatures, >12 rows, similarity DOCX w/ threshold source) | **PASS** | `npm test` |
| `src/services/__tests__/dit.test.ts` | 2 tests (completeness gate 422, dynamic count) | **PASS** | `npm test` |
| `src/services/__tests__/no-hardcoded-values.test.ts` | 2 tests (zero literal scheme counts, zero prohibited status) | **PASS** | `npm test` |
| `src/lib/supabase/__tests__/middleware.test.ts` | 2 tests (fail-closed auth redirect; public route pass) | **PASS** | `npm test` |
| `src/services/__tests__/drive.test.ts` | 10 tests (Drive crawl, `dit_form` incl. `F.ERP_...`/`F.Investigasi_...`, `Cv.`, `template_muk`, `TUGAS DIT WIWI -> Wiwi`, raw folder-name guard) | **PASS** | `npm test` |
| `src/services/__tests__/drive-revisions.test.ts` | 4 tests (ISO/DD-MM-YYYY/compact/Indonesian date extraction, newest revision priority, multi-part KP/form slot grouping, deterministic confidence/filename tie-break without text-length bias) | **PASS** | `npm test` |
| `src/services/__tests__/extract-and-drive-download.test.ts` | 10 tests (OOXML/PDF extraction, SSRF checks, Drive `#download-form` virus-scan confirm, `ZIP_ENCRYPTED` detection, ZIP safe unpack + CRC repair + ZIP child download, multi-part DIT aggregation, content reclassification) | **PASS** | `npm test` |
| `src/app/api/v1/dit/[assesseeId]/analyse/__tests__/route.test.ts` | 4 tests (UUID guard, completeness gate, scheme & batch DB `drive_files` resolution) | **PASS** | `npm test` |
| `src/lib/ak05/__tests__/rollup.test.ts` | 6 tests (undecided neutral, partial-K undecided, >=1 BK auto-BK, manual assessor override/clear, DOCX/PDF export) | **PASS** | `npm test` |
| `src/services/__tests__/vatm-rollup.test.ts` | 2 tests (VATM multi-channel rollup incl. `FR.IA.09` interview) | **PASS** | `npm test` |
| `src/services/__tests__/official-forms-export.test.ts` | 7 tests (AK.02, IA.04B, IA.06C DOCX exports, neutral unassessed rendering, auto-BK, XML `pgMar`/`bodyPr` normalization, `dit_form` `proyek` flag) | **PASS** | `npm test` |
| `src/worker/__tests__/worker.test.ts` | 13 tests (`extract_file` raw + cached reuse, `similarity_run`, `ocr_ktp`, inline run, job audit lifecycle, two-pass roster merge + audit trail + ZIP unpack + duplicate pruning, in-place `TUGAS SUANGI -> Suangi` rename, `TUGAS DIT WIWI -> Wiwi`, encrypted ZIP `unextractable`, newest `06C` revision, MUK archive `06B` non-activation, `written_grading` blanko/inactive key block, terminal `failed` job re-execution guard) | **PASS** | `npm test` |
| `src/app/(app)/batches/[id]/__tests__/actions.test.ts` | 5 tests (encrypted MUK archive 06B & blanko 06B rejection -> `batch.key_06b.activate.rejected` audit write, RBAC deny, IDOR cross-batch guard, valid 06B activate, `BatchKeyUploadPanel` SSR per-file `"Coba Aktifkan / Uji Validasi"` render) | **PASS** | `npm test` |
| `src/lib/written/__tests__/master-key.test.ts` | 3 tests (`validateMasterKey06bContent` blanko/06A/empty rejection & working key acceptance, `resolveBatchActiveMasterKey` explicit pointer & MUK blanko isolation) | **PASS** | `npm test` |
| `src/lib/written/__tests__/ooxml-decrypt.test.ts` | 3 tests (CFB + MS-OFFCRYPTO Agile v4.4 missing/wrong/valid password) | **PASS** | `npm test` |
| `src/lib/similarity/__tests__/load-batch-similarity.test.ts` | 2 tests (threshold provenance label, uncalibrated notice, per-assessee summaries) | **PASS** | `npm test` |
| `src/lib/forms/__tests__/scheme-manifest-portability.test.ts` | 3 tests (Non-AK3U manifest units, KP, `resolveUnitsForScheme` parity on `kelompokPekerjaan`-only manifests, `isGenericFallback` indicator, doc columns, branding) | **PASS** | `npm test` |
| `src/lib/forms/__tests__/dit-inputs.test.ts` | 1 test (Shared `selectDitInputFiles` 04A/04B/`dit_form`/CV selector parity between DIT page & backend worker) | **PASS** | `npm test` |
| `src/db/__tests__/dual-path.test.ts` | 5 tests (`runRepositoryDualPath` REST bypass, Drizzle RLS tx, fallback, strict, `unscopedPublicRead` & missing-userId `AUTH_ERROR` guard) | **PASS** | `npm test` |

---

## 3. Static, Build & Remote DB Gates

| Gate | Command | Result |
| :--- | :--- | :--- |
| TypeScript Strict | `npx tsc --noEmit` | **PASS (0 errors)** |
| ESLint Zero Warnings | `npx eslint . --max-warnings 0` | **PASS (0 errors, 0 warnings)** |
| Vitest Unit Suite | `npm test` | **PASS (28 files, 120/120 tests)** |
| Production Build | `npm run build` | **PASS (36 app routes incl. Proxy Middleware)** |
| Multi-LSP Postgres RLS | `npx supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | **PASS (40/40 PASS, 0 FAIL on remote Supabase)** |
| Playwright Headless UI & Viewport (Local + Live) | `verify_ui_playwright.py` (`next start -p 3199`) & `verify_live_playwright.py` (`https://assessor-zeta.vercel.app`) | **PASS (15/15 local + 15/15 live checks at `1440x900` & `390x844`: `/api/health` 200, 0 overflow, 0 console/page/5xx errors, fail-closed auth redirects)** |

---

## 4. Round 12 Defect Fixes (per brief-developer-putaran-12-2026-11-19.md)

| Cacat | Severity | Issue | Fix | Files Changed | Verification Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cacat 1** | Menengah | 06B key activation rejection not written to audit log (`/settings/audit` shows no "06B"/"kunci" entries) | Added `batch.key_06b.activate.rejected` audit entry (extended in Round 13 to cover unextracted/encrypted MUK archive blankos) | `src/app/(app)/batches/[id]/actions.ts` | **PASS (unit + SSR; live UI interactive check after Round 14 deploy)** |
| **Cacat 2** | Rendah | Disabled "Simpan Kunci 06B & Jalankan Koreksi Tertulis" button looks teal solid (indistinguishable from active) | Changed disabled styling from `disabled:opacity-50` to `disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-200` | `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/_components/written-key-form.tsx` | **PASS (verified live by Round 13 auditor)** |
| **Cacat 3** | Rendah | Duplicate `job.drive_scan.failed` audit entries for same job | Added terminal-state guard in `executeJob`: skips re-execution of `done`/`failed` jobs unless explicit `triggerAction: "retry"` | `src/worker/queue.ts` | **PASS (unit test in `worker.test.ts` + DB forensics)** |

---

## 5. Round 13 Defect Fixes & Forensics (per brief-developer-putaran-13-2026-11-19.md)

| Item | Severity | Root Cause / Finding | Fix / Forensic Result | Files Changed | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cacat 1** | Menengah | Non-activatable 06B cards rendered only a static span (`Tidak dapat diaktifkan`) and `activateBatchMasterKey06bAction` returned early before writing `batch.key_06b.activate.rejected` when `tryResolveCandidate06bText` failed | Added per-file `"Coba Aktifkan / Uji Validasi"` button (`data-testid="try-activate-06b-<id>"`), `/settings/audit` link on rejection banner, rate limit (`20/60s`), unified rejection audit logging (`batch.key_06b.activate.rejected`) + `formatAuditSummary` support for `substantiveWords` & `rejectionReason` | `src/components/batch/batch-key-upload-panel.tsx`, `src/app/(app)/batches/[id]/actions.ts`, `src/lib/audit/job-audit.ts`, `src/app/(app)/batches/[id]/__tests__/actions.test.ts` | `tsc`, `eslint`, `vitest` (5/5 tests in `actions.test.ts`), `next build` |
| **Cacat 2** | Menengah | Read-only SQL on `public.audit_log` (42 rows; `LSP-K3-ID2` = 29 rows; contiguous `BIGSERIAL` `id` `14..19` between `06:02` and `08:55` UTC on 18 Nov) and `public.jobs` (`82988849` failed `06:16:32+00`, 18h before Round 7 added `recordJobAuditEvent`) proves no R3 `job.drive_scan.failed` row ever existed in `public.audit_log`. Hardened repository query window & ordering | Pushed `lsp_id IS NULL` actor membership scoping into SQL (`drizzle` + `supabase`), enforced deterministic `created_at DESC, id DESC`, added `beforeId` cursor pagination, deduplicated by `id`, and added cursor pagination UI on `/settings/audit` | `src/repositories/audit.repository.ts`, `src/app/(app)/settings/audit/page.tsx`, `src/repositories/__tests__/audit.repository.test.ts`, `src/lib/audit/__tests__/write-audit-log.test.ts`, `src/worker/__tests__/worker.test.ts` | `tsc`, `eslint`, `vitest` (120/120), `RLS` (40/40), Playwright local + live `1440x900` & `390x844` (15/15 each) |
| **Observasi R1/R2** | Info | `public.batches` contains 4 rows total (`Demo Audit R4` & `Demo Audit R3` in `LSP-K3-ID2`; 2 synthetic batches in `LSP-VERIFY-E2E`). No batches named `R1` or `R2` exist | Documented exact `public.batches` rows in `_documentations_/2026-11-19_1830_round13_remediation_report.md` | `_documentations_/2026-11-19_1830_round13_remediation_report.md` | Read-only SQL query verified |
