# Round 10 Audit Remediation Report

**Timestamp:** 2026-11-19 13:05 WIB  
**Previous Commit:** `c67b632`  
**Live Target:** `https://assessor-zeta.vercel.app`  
**Remote Supabase:** `oiplhsmmfuqriaqrxjud` (`20261118000001..20261119000011` synced)

---

## 1. Summary of Changes (5 Defects + Bonus `TUGAS DIT WIWI` & `Cv.` Fixes)

| Item | Defect / Scope | Files Changed | Resolution |
|---|---|---|---|
| **Cacat 1 (Tinggi)** | Roster `26 → 23` lacked audit trail | `src/repositories/assessees.repository.ts`, `src/worker/index.ts`, `src/app/(app)/settings/audit/page.tsx`, `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`, `src/app/(app)/batches/[id]/triage/page.tsx` | Confirmed zero real assessees lost (`23` real assessees in `Persyaratan/`; `ASESI-003 BAGAS K3`, `ASESI-013 M. RIYAN SYAHRONI`, `ASESI-017 tugas KIKI` were 18 Nov duplicates merged to canonical rows). `pruneOrphanedDuplicateAssessees` now returns `{ id, displayName }[]`; `handleDriveScanJob` builds structured `mergedAssessees` & `renamedAssessees` + `rosterChangeSummary`, writes append-only `batch.roster.reconciled` audit log, and surfaces the trail in `/settings/audit`, `/batches/[id]/ingest/[jobId]`, and `/batches/[id]/triage`. |
| **Cacat 2 (Menengah)** | `F.ERP_Lintang Trenggono.docx` labeled `04b` (+ `Cv. Suangi new.jpg`) | `src/services/drive-doc-types.ts`, `src/services/drive.ts`, `src/services/__tests__/drive.test.ts` | Replaced `(?:^|\s)erp(?:$|\s)` with `\berp\b` and `(?<!\S)in[ve]*stigasi(?!\S)` with `\bin[ve]*stigasi\b` in `detectDitFormKind`; replaced `(?:^|\s)cv(?:$|\s)` with `\bcv\b` in `UNIFIED_CLASSIFIER_RULES.cv`; added `template_muk` rule for LSP MUK admin templates (`FR.MAPA.*`, `FR.VA`, `FR.AK.*`, `FR.IA.07/08/10`, `SKKNI`, `Skema Sertifikasi`, `Daftar Periksa MUK`, `Peta Kelompok Pekerjaan`, `Berita Acara`, `Daftar Hadir`). Added unit tests incl. negative case `keperluan_administrasi.docx`. |
| **Cacat 3 (Menengah) + Bonus** | `TUGAS SUANGI` folder-prefixed assessee + `TUGAS DIT WIWI` misassigned to `WIWIK` | `src/services/drive.ts`, `src/repositories/assessees.repository.ts`, `src/worker/index.ts`, `src/services/__tests__/drive.test.ts`, `src/worker/__tests__/worker.test.ts` | Stopped auto-creating fake assessees from non-authoritative folders/filenames when an authoritative roster exists (`trulyNewNonAuth` files remain `unmatched`); tightened structural folder guards and removed raw fallback under `Tugas DIT/` and `Persyaratan/`. Stripped `TUGAS DIT ` before `isNonCandidateFolder` on `Tugas DIT/` subfolders so `TUGAS DIT WIWI` → `WIWI` → `Wiwi Widiawati, S.K.M` (score `0.90`, `0` for `WIWIK`). Added `updateAssesseeDisplayName` + `hasTaskOrFolderPrefix` for safe in-place cleanup of unconfirmed legacy names (`TUGAS SUANGI` → `Suangi`) without deleting rows or modifying confirmed names, logged in `batch.roster.reconciled`. |
| **Cacat 4 (Rendah)** | `.zip` failed with `DRIVE_HTML_INTERSTITIAL` & mixed into `unmatched` | `supabase/migrations/20261119000011_add_triage_unextractable.sql`, `src/services/drive-extract.ts`, `src/services/extract.ts`, `src/repositories/batches.repository.ts`, `src/worker/index.ts`, `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/triage/page.tsx`, `src/app/(app)/batches/[id]/triage/actions.ts`, tests | Added `extractDriveVirusScanConfirmUrl` in `fetchWithValidatedRedirects` to follow SSRF-validated Google Drive public `#download-form` (`confirm=t`, `uuid`) — enabling `AK3U LSP K3 Nasional.zip` (9.3 MB, 29 MUK files incl. `FR.IA.04A`, `FR.IA.06A`, `FR.IA.06B`, `FR.IA.09`) to unpack cleanly while skipping text extraction on `template_muk`/`materi_pelatihan`. Added `isEncryptedZipBuffer` (`ZIP_ENCRYPTED`) and `DRIVE_ACCESS_DENIED` detection. Applied migration `20261119000011_add_triage_unextractable.sql` adding `triage_status = 'unextractable'`, separated from `unmatched` with dedicated UI filter, badge, and manual action steps. |
| **Cacat 5 (Rendah)** | Batch page did not auto-refresh running job | `src/components/batch/job-status-poller.tsx` (new), `src/app/(app)/batches/[id]/_components/rescan-drive-button.tsx`, `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx` | Added lightweight client `JobStatusPoller` polling `/api/v1/batches/[id]` (or `/api/v1/jobs/[jobId]`) every 3s only when `pending`/`running` (or right after clicking Rescan), pausing when tab is hidden, aborting on unmount, updating badge live, and calling `router.refresh()` once on terminal state (`done`/`failed`). |

---

## 2. Verification Results

| Gate | Command | Result |
|---|---|---|
| TypeScript Strict | `npm run typecheck` | **PASS** (0 errors) |
| ESLint Zero Warnings | `npx eslint . --max-warnings 0` | **PASS** (0 errors, 0 warnings) |
| Vitest Unit Suite | `npm test` | **PASS** (`25/25` files, `105/105` tests) |
| Production Build | `npm run build` | **PASS** (`Compiled successfully in 46s`, 36 routes + Proxy Middleware) |
| Remote Supabase Migration | `npx supabase db push --remote --yes` & `migration list --remote` | **PASS** (`20261118000001..20261119000011` synced) |
| Remote Multi-LSP RLS | `npx supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | **PASS** (`37/37` PASS, `0` FAIL incl. `RLS-37` unextractable) |
| Secret Hygiene Scan | Regex scan across all modified files | **PASS** (`0` hits) |
| Live Vercel + `agent-browser` | Pending deploy & authenticated user sign-in on `Demo Audit R4` | Queued next |

---

## 3. Codebase Footprint (Explicit `wc -l`-Equivalent Methodology)

Measured via Node `fs` counting `\n` bytes across all `src/**/*.{ts,tsx}` files (avoiding PowerShell wildcard skipping on `[id]`/`[assesseeId]`/`[jobId]` dynamic segments):
- **Total `src/` (`*.ts`, `*.tsx`, including tests):** `163` files / **`28,514` lines** (was `162` files / `27,535` lines at `c67b632`).
- **Non-test `src/` (`*.ts`, `*.tsx`, excluding `__tests__`, `*.test.*`, `*.spec.*`):** `138` files / **`24,744` lines** (was `137` files / `24,031` lines at `c67b632`).
