# Feature Test Report

- **Date:** 2026-11-19 (Round 7 Remediation)
- **Environment:** Remote Supabase (`oiplhsmmfuqriaqrxjud`) + Local Node.js + Live Vercel (`https://assessor-zeta.vercel.app`)
- **Authority:** `ground_rules_v5.md` (§Feature/Module Testing)

---

## 1. PostgreSQL RLS Verification (`tests/rls-multi-lsp.test.sql`)

- **RLS-01..RLS-25**: Foundation tables (`lsps`, `schemes`, `batches`, `assessees`, `app_config`, `audit_log`) — **25/25 PASS** (on remote DB after `000008`).
- **RLS-26..RLS-31**: Phase 1–5 tables (`scheme_form_manifests`, `drive_files`, `decisions`, `ak05_reports`, `assessor_llm_config`) — **6/6 PASS**.
- **RLS-32**: Phase A (`interview_assessments` cross-LSP isolation) — **1/1 PASS**.
- **RLS-33..RLS-35**: Migration `20261119000009_assessee_decision_overrides.sql` (`assessee_decision_overrides` cross-LSP isolation, `tuk_admin` write block, unassigned assessor batch block) — **3/3 PASS** (`supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql`: **35/35 PASS**, **0 FAIL**).

---

## 2. Vitest Unit & Contract Suite (`npm test`)

| Test File | Scenarios | Result | Evidence |
| :--- | :--- | :--- | :--- |
| `src/ai/__tests__/redact.test.ts` | 4 tests (NIK/phone/image redaction, Jury allow-list) | **PASS** | `npm test` |
| `src/lib/crypto/__tests__/encryption.test.ts` | 4 tests (AES-256-GCM roundtrip, tamper detect, missing secret) | **PASS** | `npm test` |
| `src/lib/security/__tests__/ssrf.test.ts` | 3 tests (private IP/localhost block, Drive allow-list) | **PASS** | `npm test` |
| `src/lib/security/__tests__/rate-limit.test.ts` | 2 tests (sliding rate limit throttle, internal redirect sanitizer) | **PASS** | `npm test` |
| `src/lib/__tests__/names.test.ts` | 4 tests (KTP authority, confidence floor, Declan Rice case) | **PASS** | `npm test` |
| `src/lib/audit/__tests__/write-audit-log.test.ts` | 5 tests (audit insert, error catch, `resolveAuditResourceHref` batch/job routing) | **PASS** | `npm test` |
| `src/lib/config/__tests__/get-config.test.ts` | 3 tests (hierarchical `scheme -> lsp -> global -> default` `app_config` resolution) | **PASS** | `npm test` |
| `src/services/__tests__/similarity.test.ts` | 1 test (copy-paste vs paraphrase vs unrelated calibration) | **PASS** | `npm test` |
| `src/services/__tests__/export.test.ts` | 5 tests (D8 format lock, AK.05 PDF/DOCX/XLSX, signatures, >12 rows, similarity DOCX w/ threshold source) | **PASS** | `npm test` |
| `src/services/__tests__/dit.test.ts` | 2 tests (completeness gate 422, dynamic count) | **PASS** | `npm test` |
| `src/services/__tests__/no-hardcoded-values.test.ts` | 2 tests (zero literal scheme counts, zero prohibited status) | **PASS** | `npm test` |
| `src/lib/supabase/__tests__/middleware.test.ts` | 2 tests (fail-closed auth redirect; public route pass) | **PASS** | `npm test` |
| `src/services/__tests__/drive.test.ts` | 5 tests (Drive crawl, keyless fallback, 04b `.pptx` over `IBPR`/`HIRADC` precedence, 404 skip) | **PASS** | `npm test` |
| `src/services/__tests__/extract-and-drive-download.test.ts` | 6 tests (OOXML/PDF text extraction, SSRF domain/redirect checks) | **PASS** | `npm test` |
| `src/app/api/v1/dit/[assesseeId]/analyse/__tests__/route.test.ts` | 4 tests (UUID guard, completeness gate, DB `drive_files` resolution) | **PASS** | `npm test` |
| `src/lib/ak05/__tests__/rollup.test.ts` | 6 tests (undecided neutral, partial-K undecided, >=1 BK auto-BK, manual assessor override/clear, DOCX/PDF export) | **PASS** | `npm test` |
| `src/services/__tests__/vatm-rollup.test.ts` | 2 tests (VATM multi-channel rollup incl. `FR.IA.09` interview) | **PASS** | `npm test` |
| `src/services/__tests__/official-forms-export.test.ts` | 6 tests (AK.02, IA.04B, IA.06C DOCX exports, neutral unassessed rendering, auto-BK & manual override) | **PASS** | `npm test` |
| `src/worker/__tests__/worker.test.ts` | 6 tests (`extract_file`, `similarity_run`, `ocr_ktp`, inline run, full job audit lifecycle, unknown error) | **PASS** | `npm test` |
| `src/lib/written/__tests__/ooxml-decrypt.test.ts` | 3 tests (CFB + MS-OFFCRYPTO Agile v4.4 missing/wrong/valid password) | **PASS** | `npm test` |
| `src/lib/similarity/__tests__/load-batch-similarity.test.ts` | 2 tests (threshold provenance label, uncalibrated notice, per-assessee summaries) | **PASS** | `npm test` |
| `src/lib/forms/__tests__/scheme-manifest-portability.test.ts` | 2 tests (Non-AK3U manifest units, KP, doc columns, branding) | **PASS** | `npm test` |
| `src/db/__tests__/dual-path.test.ts` | 4 tests (`runRepositoryDualPath` REST bypass, Drizzle RLS tx, fallback, strict) | **PASS** | `npm test` |

---

## 3. Static, Build & Live Browser Gates

| Gate | Command | Result |
| :--- | :--- | :--- |
| TypeScript Strict | `npm run typecheck` | **PASS (0 errors)** |
| ESLint Zero Warnings | `npm run lint` | **PASS (0 warnings)** |
| Vitest Unit Suite | `npm test` | **PASS (23 files, 83/83 tests)** |
| Production Build | `npm run build` | **PASS (36 routes compiled incl. `Proxy (Middleware)` and zero client/server bundle leaks)** |
| Live Browser UI/UX (`agent-browser`) | `https://assessor-zeta.vercel.app` (`/login`, `/register`, fail-closed `/batches/...`) | **PASS (0 console/page errors, `overflow: false` at `1440x900` and `390x844`)** |
| Multi-LSP Postgres RLS | `supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | **PASS (35/35 tests on remote Supabase after `000009`)** |
