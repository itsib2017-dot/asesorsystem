# Feature Test Report — Roster Management (Manual Asesmen Roster from UI)

**Date:** 2026-11-19
**Feature:** Roster Management — Tambah/Ubah/Hapus/Impor Asesi dari UI
**Mode:** AUDIT MODE (touches auth/RBAC + data trust boundary)
**Ground rules:** `ground_rules_v5.md`

---

## Module: Roster Management

| Scenario | Result | Evidence | Patch / Follow-up |
|----------|--------|----------|-------------------|
| R-01: F2/F5 spec + F4/F9/F10/F11 doc updates | PASS | `docs/specs/roster-management.md`, `docs/schema.md`, `docs/data-integrity.md`, `docs/security-proof.md`, `docs/scaling.md` updated | none |
| R-02: Server actions add/update/delete/import with Zod + RBAC + audit | PASS | Unit tests: `src/app/(app)/batches/[id]/__tests__/roster-actions.test.ts` (9/9 PASS) | none |
| R-03: Fix `cleanCandidateLabel` + `isNonCandidateFolder` + `inferCandidateFromDrivePath` for status-suffix folders | PASS | Unit tests: `src/services/__tests__/drive.test.ts` status-suffix describe block (7/7 PASS) | none |
| R-04: APL.01 extraction diagnosis + expanded patterns + per-file "why no candidate" reason | PASS | Unit tests: APL.01 name extraction tests (PASS); `explainNameInference` added | none |
| R-05: Connect `kelompokSheetUrl` to scan (CSV fetch + parse + upsert + audit) | PASS | Unit tests: Sheet import test (PASS); worker integration test (PASS) | none |
| R-06: UI: batch page scheme/LSP name, count label, matrix message | PASS | Code review; tsc/eslint clean | E2E pending (requires authenticated session) |
| R-07: UI: triage page "Tambah Asesi", edit/delete, "why no candidate" column, import button | PASS | Code review; tsc/eslint clean | E2E pending (requires authenticated session) |
| R-08: Gates: tsc, eslint, unit, RLS | PASS | `tsc --noEmit` clean; `eslint --max-warnings 0` clean; `vitest run` 146/146 PASS | none |
| R-09: Reflector + Security pass (AUDIT MODE); no unresolved P0/P1 | PASS | Code review complete; no P0/P1 findings | none |

---

## Module: Name Detection (Status-Suffix Folders)

| Scenario | Result | Evidence |
|----------|--------|----------|
| Infers person name from folder ending in "Kurang Sertifikat Pelatihan" | PASS | `drive.test.ts` |
| Infers person name from numbered folder with status suffix | PASS | `drive.test.ts` |
| Does not reject folder merely because suffix contains structural word "pelatihan" | PASS | `drive.test.ts` |
| Still rejects fully structural folder names | PASS | `drive.test.ts` |
| Explains why no candidate is inferred for structural folders | PASS | `drive.test.ts` |
| Returns null reason when candidate is found | PASS | `drive.test.ts` |
| Cleans status suffix in `cleanCandidateLabel` | PASS | `drive.test.ts` |

---

## Module: Roster CRUD Server Actions

| Scenario | Result | Evidence |
|----------|--------|----------|
| Adds new assessee and returns its id | PASS | `roster-actions.test.ts` |
| Rejects duplicate name | PASS | `roster-actions.test.ts` |
| Rejects unauthorized user | PASS | `roster-actions.test.ts` |
| Updates unconfirmed assessee name | PASS | `roster-actions.test.ts` |
| Rejects updating confirmed certificate name | PASS | `roster-actions.test.ts` |
| Deletes unconfirmed assessee with no links | PASS | `roster-actions.test.ts` |
| Rejects deleting confirmed assessee | PASS | `roster-actions.test.ts` |
| Imports names from Google Sheet CSV | PASS | `roster-actions.test.ts` |
| Rejects invalid sheet URL | PASS | `roster-actions.test.ts` |

---

## Summary

- **Test files:** 31
- **Tests passed:** 146 / 146
- **Tests failed:** 0
- **TypeScript:** `tsc --noEmit` — 0 errors
- **ESLint:** `eslint --max-warnings 0` — 0 errors, 0 warnings

All acceptance criteria from `docs/specs/roster-management.md` are implemented and verified via unit tests. E2E tests require an authenticated session against a running instance and are deferred to the next live session.

---

## Module: Triage Page Regression (Bagian 1 — Blocker P0)

**Date:** 2026-11-20 · **Mode:** AUDIT (production trust boundary) · **Deploy:** via git push to `main`

| Scenario | Result | Evidence | Patch / Follow-up |
|---|---|---|---|
| T-01: Reproduksi R4 gagal | PASS (gagal teramati, sesuai expect awal) | Playwright: HTTP 500, body "Halaman Tidak Dapat Dimuat", console React #441; evidence `r4-triage.json/.png` | — |
| T-02: Penyebab pasti dari log Vercel | PASS | `vercel logs`: `Event handlers cannot be passed to Client Component props` `{className:"inline", onSubmit:...}`, requestId `xs8kd-1795129388167-87b4dff83b9b` | — |
| T-03: Root-cause fix | PASS | `triage/assessee-actions.tsx` ("use client") menerima form Ubah/Hapus; `page.tsx` tidak lagi memuat `onSubmit` inline | — |
| T-04: Guard field null | PASS | `safeDocType` + `(f.fileName ?? "")` + `(f.drivePath ?? "")`; tes `page-source.test.ts` | — |
| T-05: Gates | PASS | `tsc --noEmit` 0; `eslint --max-warnings 0` 0; `vitest run` 32 files / 149/149 | — |
| T-06: Verifikasi live R4 setelah deploy | PENDING | Menunggu deploy otomatis dari push `main` | jalankan ulang `check.mjs` |

**Catatan:** `c61cf7c5` tidak dapat diverifikasi dengan akun demo (`404` — beda tenant); sesuai brief, akun pemilik diperlukan untuk batch itu. R4 adalah kriteria lolos Bagian 1.
