# Feature Test Report

- **Date:** 2026-11-19 (Round 8 Audit Remediation)
- **Environment:** Remote Supabase (`oiplhsmmfuqriaqrxjud`) + Local Node.js + Live Vercel (`https://assessor-zeta.vercel.app`)
- **Authority:** `ground_rules_v5.md` (§Feature/Module Testing)

---

## 1. PostgreSQL RLS Verification (`tests/rls-multi-lsp.test.sql`)

- **RLS-01..RLS-25**: Foundation tables (`lsps`, `schemes`, `batches`, `assessees`, `app_config`, `audit_log`) — **25/25 PASS**.
- **RLS-26..RLS-31**: Phase 1–5 tables (`scheme_form_manifests`, `drive_files`, `decisions`, `ak05_reports`, `assessor_llm_config`) — **6/6 PASS**.
- **RLS-32**: Phase A (`interview_assessments` cross-LSP isolation) — **1/1 PASS**.
- **RLS-33..RLS-35**: Migration `20261119000009_assessee_decision_overrides.sql` (`assessee_decision_overrides` cross-LSP isolation, `tuk_admin` write block, unassigned assessor batch block) — **3/3 PASS**.
- **RLS-36**: Migration `20261119000010_drive_file_metadata.sql` (`assessees_delete` cross-LSP `DELETE` blocked with `0` rows affected) — **1/1 PASS** (`supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql`: **36/36 PASS**, **0 FAIL**).

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
| `src/services/__tests__/drive.test.ts` | 8 tests (Drive crawl, `dit_form` 5 worksheets, multi-format `.pdf`/`.docx`/`.pptx` DIT, typos, underscore `DIT_Faradhila`, content classification) | **PASS** | `npm test` |
| `src/services/__tests__/drive-revisions.test.ts` | 3 tests (ISO/DD-MM-YYYY/compact/Indonesian date extraction, newest revision priority, multi-part KP/form slot grouping) | **PASS** | `npm test` |
| `src/services/__tests__/extract-and-drive-download.test.ts` | 9 tests (OOXML/PDF extraction, SSRF checks, ZIP safe unpack + CRC repair + ZIP child download, multi-part DIT aggregation, content reclassification) | **PASS** | `npm test` |
| `src/app/api/v1/dit/[assesseeId]/analyse/__tests__/route.test.ts` | 4 tests (UUID guard, completeness gate, scheme & batch DB `drive_files` resolution) | **PASS** | `npm test` |
| `src/lib/ak05/__tests__/rollup.test.ts` | 6 tests (undecided neutral, partial-K undecided, >=1 BK auto-BK, manual assessor override/clear, DOCX/PDF export) | **PASS** | `npm test` |
| `src/services/__tests__/vatm-rollup.test.ts` | 2 tests (VATM multi-channel rollup incl. `FR.IA.09` interview) | **PASS** | `npm test` |
| `src/services/__tests__/official-forms-export.test.ts` | 7 tests (AK.02, IA.04B, IA.06C DOCX exports, neutral unassessed rendering, auto-BK, XML `pgMar`/`bodyPr` normalization, `dit_form` `proyek` flag) | **PASS** | `npm test` |
| `src/worker/__tests__/worker.test.ts` | 8 tests (`extract_file`, `similarity_run`, `ocr_ktp`, inline run, job audit lifecycle, two-pass roster merge + ZIP unpack + duplicate pruning, newest `06C` revision) | **PASS** | `npm test` |
| `src/lib/written/__tests__/ooxml-decrypt.test.ts` | 3 tests (CFB + MS-OFFCRYPTO Agile v4.4 missing/wrong/valid password) | **PASS** | `npm test` |
| `src/lib/similarity/__tests__/load-batch-similarity.test.ts` | 2 tests (threshold provenance label, uncalibrated notice, per-assessee summaries) | **PASS** | `npm test` |
| `src/lib/forms/__tests__/scheme-manifest-portability.test.ts` | 2 tests (Non-AK3U manifest units, KP, doc columns, branding) | **PASS** | `npm test` |
| `src/db/__tests__/dual-path.test.ts` | 4 tests (`runRepositoryDualPath` REST bypass, Drizzle RLS tx, fallback, strict) | **PASS** | `npm test` |

---

## 3. Static, Build & Remote DB Gates

| Gate | Command | Result |
| :--- | :--- | :--- |
| TypeScript Strict | `npm run typecheck` | **PASS (0 errors)** |
| ESLint Zero Warnings | `npm run lint` | **PASS (0 errors, 0 warnings)** |
| Vitest Unit Suite | `npm test` | **PASS (24 files, 96/96 tests)** |
| Production Build | `npm run build` | **PASS (36 app routes incl. Proxy Middleware)** |
| Multi-LSP Postgres RLS | `supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | **PASS (36/36 tests on remote Supabase after `000010`)** |
