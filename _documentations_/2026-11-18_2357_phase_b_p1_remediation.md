# Phase B Remediation Report — High / P1 Data Integrity & UX Accuracy

**Timestamp:** 2026-11-18 23:57 WIB  
**Tickets Completed:** T6, T7, T8, T9, T10 (`Cacat 4`, Triage `docType` + Pagination, Encrypted `06B` Agile OOXML Decryption, Similarity Threshold Calibration Notice + Written Summary, Blanko & Dashboard Fidelity)  
**Mode:** AUDIT MODE (`T8` decryption/password/audit), FAST MODE (`T6`, `T7`, `T9`, `T10`)

---

## 1. Summary of Changes

### T6 — Neutral Unassessed Defaults (`Cacat 4`)
- **Files:** `src/components/identity/name-jury-card.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/page.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/page.tsx`, `src/services/similarity.ts`, `src/services/export.ts`, `src/lib/similarity/load-batch-similarity.ts`
- **Fix:**
  - Replaced misleading `"Bersih"` / `"Cocok"` / `"Layak (K)"` defaults on unassessed items with neutral `"Belum diperiksa"` / `"Belum dinilai"` / `"Menunggu"` states across assessee detail, written grading, name jury card, similarity report Markdown, and combined similarity DOCX export.

### T7 — Triage `docType` Selector, Search, Pagination & Responsive Table
- **Files:** `src/app/(app)/batches/[id]/triage/actions.ts`, `src/app/(app)/batches/[id]/triage/page.tsx`
- **Fix:**
  - Added server-side `docType` validation (Zod enum) and update support in triage assignment action with `audit_log` tracking (`triage.file.assign`).
  - Added search filter (`q`), status/page query parameters (`page`, page size `50`), inline `docType` `<select>` control, and `overflow-x-auto` wrapper for narrow viewports.

### T8 — Runtime-Only Password Decryptor for Encrypted `FR.IA.06B` OOXML (`.docx`)
- **Files:** `src/lib/written/ooxml-decrypt.ts`, `src/lib/written/master-key.ts`, `src/components/batch/batch-key-upload-panel.tsx`, `src/app/(app)/batches/[id]/actions.ts`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/_components/written-key-form.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/actions.ts`, `src/lib/written/__tests__/ooxml-decrypt.test.ts`
- **Fix:**
  - Implemented pure-Node CFB + MS-OFFCRYPTO Agile Encryption (`v4.4`) AES-CBC + SHA decryptor in `decryptAgileOoxmlBuffer(buffer, password)` with explicit `KEY_ENCRYPTED` and `KEY_WRONG_PASSWORD` error codes.
  - Added optional runtime `masterKeyPassword` input (`type="password"`, `autoComplete="off"`) on both batch 06B upload and assessee written grading forms; password is used strictly in memory and never persisted or written to logs/audit summaries.
  - Recorded `batch.key_06b.upload` and `written.grading.run` in `audit_log`, including `manualAnswerEdited` detection comparing submitted `studentAnswerText` against DB `06c` extracted text.
  - Added unit tests constructing a real CFB + Agile v4.4 encrypted OOXML package and verifying missing password, wrong password, and successful decryption + DOCX extraction.

### T9 — Similarity Provisional Thresholds Label & Per-Assessee Written Summary
- **Files:** `src/repositories/assessment.repository.ts`, `src/services/similarity.ts`, `src/lib/similarity/load-batch-similarity.ts`, `src/app/(app)/batches/[id]/similarity/page.tsx`, `src/services/export.ts`, `src/app/api/v1/batches/[id]/similarity/export/route.ts`, `src/lib/similarity/__tests__/load-batch-similarity.test.ts`
- **Fix:**
  - Aligned `DEFAULT_SIMILARITY_THRESHOLDS` to seeded defaults (`0.85` / `0.65` / `0.45`) and flagged `thresholdsUncalibrated = true` whenever `app_config["similarity.flag_thresholds"].unconfirmed !== false`.
  - Displayed `"Sementara / Belum Dikalibrasi (D19 / OQ-08)"` in UI, Markdown, and combined DOCX exports.
  - Added `listWrittenGradingsForBatch` (eliminates N+1) and populated `verdicts`, `ringkasanKesalahan`, and written/similarity `plagiarismStatus` per assessee in Markdown and DOCX exports.

### T10 — Blanko Metadata Dates, Footers, Rescan Pending Lock & Dashboard Accuracy
- **Files:** `src/lib/ak05/format.ts`, `src/lib/forms/assessee-forms.ts`, `src/lib/forms/load-assessee-page-data.ts`, `src/app/(app)/batches/[id]/ak05/page.tsx`, `src/app/api/v1/batches/[id]/ak05/export/route.ts`, `src/components/forms/ia04b-blanko-preview.tsx`, `src/components/forms/ia06c-blanko-preview.tsx`, `src/app/(app)/batches/[id]/_components/rescan-drive-button.tsx`, `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/dashboard/page.tsx`
- **Fix:**
  - Removed `decisionRuleRef` fallback from `extractSchemeMeta` and unified `ak05/page.tsx` and `ak05/export/route.ts` to call shared `extractSchemeMeta`.
  - Removed `new Date().toISOString().slice(0, 10)` synthetic date fallback across AK.05 and assessee form loaders; `formatAk05DateIndonesia("")` now returns `"Belum ditentukan"`.
  - Added `<BlankoSheetFooter />` to `Ia04bBlankoPreview` (`FR.IA.04B-2024`) and `Ia06cBlankoPreview` (`FR.IA.06C-2024`).
  - Added `<RescanDriveButton />` with `useFormStatus` pending state lock and logged warnings on audit failures in `rescanBatchDriveAction`.
  - Replaced static `"Otoritas KTP Aktif"` badge in `dashboard/page.tsx` with accurate per-assessee D6 confirmation status wording.

---

## 2. Verification Results (Post-Final-Edit)
- `npm run typecheck` (`tsc --noEmit`): **PASS** (0 errors)
- `npm run lint` (`eslint`): **PASS** (0 warnings, 0 errors)
- `npm test` (`vitest run`): **PASS** — **20 test files passed, 68 tests passed** (including `ooxml-decrypt.test.ts` and `load-batch-similarity.test.ts`)
- `npm run build` (`next build`): **PASS** — Compiled 35 routes cleanly
