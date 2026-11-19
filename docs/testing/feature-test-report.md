# Feature Test Report

- **Date:** 2026-11-19 (Round 11 Audit Remediation + Round 12 Defect Fixes)
- **Environment:** Remote Supabase (`oiplhsmmfuqriaqrxjud`) + Local Node.js + Live Vercel (`https://assessor-zeta.vercel.app`)
- **Authority:** `ground_rules_v5.md` (§Feature/Module Testing)
- **Mode:** FAST MODE (§0.2 ground_rules_v5.md) — bug fixes in existing patterns, no trust boundary changes

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
| `src/lib/audit/__tests__/write-audit-log.test.ts` | 5 tests (audit insert, error catch, `resolveAuditResourceHref` batch/job routing) | **PASS** | `npm test` |
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
| `src/worker/__tests__/worker.test.ts` | 12 tests (`extract_file` raw + cached reuse, `similarity_run`, `ocr_ktp`, inline run, job audit lifecycle, two-pass roster merge + audit trail + ZIP unpack + duplicate pruning, in-place `TUGAS SUANGI -> Suangi` rename, `TUGAS DIT WIWI -> Wiwi`, encrypted ZIP `unextractable`, newest `06C` revision, MUK archive `06B` non-activation, `written_grading` blanko/inactive key block) | **PASS** | `npm test` |
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
| TypeScript Strict | `npm run typecheck` | **PASS (0 errors)** |
| ESLint Zero Warnings | `npx eslint . --max-warnings 0` | **PASS (0 errors, 0 warnings)** |
| Vitest Unit Suite | `npm test` | **PASS (26 files, 110/110 tests)** |
| Production Build | `npm run build` | **PASS (36 app routes incl. Proxy Middleware)** |
| Multi-LSP Postgres RLS | `supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | **PASS (40/40 tests on remote Supabase incl. `RLS-38..RLS-40` `batch_roster_notes`)** |

---

## 4. Round 12 Defect Fixes (per brief-developer-putaran-12-2026-11-19.md)

| Cacat | Severity | Issue | Fix | Files Changed | Verification Needed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cacat 1** | Menengah | 06B key activation rejection not written to audit log (`/settings/audit` shows no "06B"/"kunci" entries) | Added `batch.key_06b.activate.rejected` audit entry when activation is rejected due to invalid content validation, with actor, file, source, validation status, and rejection reason | `src/app/(app)/batches/[id]/actions.ts` | Live UI: activate blanko 06B → expect rejection entry in `/settings/audit` |
| **Cacat 2** | Rendah | Disabled "Simpan Kunci 06B & Jalankan Koreksi Tertulis" button looks teal solid (indistinguishable from active) | Changed disabled styling from `disabled:opacity-50` to `disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-200` for clear visual distinction | `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/_components/written-key-form.tsx` | Live UI: disabled grading button should appear gray/slate, not teal |
| **Cacat 3** | Rendah | Duplicate `job.drive_scan.failed` audit entries for same job | Added terminal-state guard in `executeJob`: skips re-execution of `done`/`failed` jobs unless explicit `triggerAction: "retry"` | `src/worker/queue.ts` | Live UI: `/settings/audit` should show exactly one `job.drive_scan.failed` per failed job |

**Gates pending (no Node.js/network in this sandbox — to be run in Claude Code / local checkout):**
- `npx tsc --noEmit` — must pass 0 errors
- `npx eslint . --ext .ts,.tsx --max-warnings 0` — must pass 0 warnings
- `npm test` — all existing tests must still pass (guard allows retries; pending jobs execute normally)
- Playwright E2E on preview — verify all three cacat fixes live
