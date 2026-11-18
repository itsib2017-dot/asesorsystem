# Feature Test Report

- **Date:** 2026-11-18
- **Environment:** Remote Supabase (`oiplhsmmfuqriaqrxjud`) + Local Node.js `v24.22.1`
- **Authority:** `ground_rules_v5.md` (§Feature/Module Testing)

---

## 1. Remote PostgreSQL RLS Verification (`tests/rls-multi-lsp.test.sql`)

Executed via `supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql`:
- **RLS-01..RLS-25**: Foundation tables (`lsps`, `schemes`, `batches`, `assessees`, `app_config`, `audit_log`) — **25/25 PASS**.
- **RLS-26..RLS-31**: Phase 1–5 tables (`scheme_form_manifests`, `drive_files`, `decisions`, `ak05_reports`, `assessor_llm_config`) — **6/6 PASS**.
- **Total DB RLS Suite**: **31/31 PASS (0 FAIL)**.

---

## 2. Vitest Unit & Contract Suite (`npm test`)

| Test File | Scenarios | Result | Evidence |
| :--- | :--- | :--- | :--- |
| `src/ai/__tests__/redact.test.ts` | 4 tests (NIK/phone/image redaction, Jury allow-list) | **PASS** | `npm test` |
| `src/lib/crypto/__tests__/encryption.test.ts` | 4 tests (AES-256-GCM roundtrip, tamper detect, missing secret) | **PASS** | `npm test` |
| `src/lib/security/__tests__/ssrf.test.ts` | 3 tests (private IP/localhost block, Drive allow-list) | **PASS** | `npm test` |
| `src/lib/__tests__/names.test.ts` | 4 tests (KTP authority, confidence floor, Declan Rice case) | **PASS** | `npm test` |
| `src/lib/audit/__tests__/write-audit-log.test.ts` | 2 tests (audit insert, graceful error catch) | **PASS** | `npm test` |
| `src/services/__tests__/similarity.test.ts` | 1 test (copy-paste vs paraphrase vs unrelated calibration) | **PASS** | `npm test` |
| `src/services/__tests__/export.test.ts` | 2 tests (D8 format lock, real PDF/DOCX/XLSX generation) | **PASS** | `npm test` |
| `src/services/__tests__/dit.test.ts` | 2 tests (completeness gate 422, dynamic count 10 vs 13) | **PASS** | `npm test` |
| `src/services/__tests__/no-hardcoded-values.test.ts` | 2 tests (zero literal 13 count, zero prohibited status) | **PASS** | `npm test` |

---

## 3. Static & Build Gates

| Gate | Command | Result |
| :--- | :--- | :--- |
| TypeScript Strict | `npm run typecheck` | **PASS (0 errors)** |
| ESLint Zero Warnings | `npx eslint . --ext .ts,.tsx --max-warnings 0` | **PASS (0 warnings)** |
| Production Build | `npm run build` | **PASS (21 routes compiled)** |
| Supabase Advisors | `supabase db advisors --remote` | **PASS (0 issues)** |
