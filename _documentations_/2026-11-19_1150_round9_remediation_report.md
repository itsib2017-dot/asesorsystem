# Round 9 Code Complexity Remediation & Verification Report

**Timestamp:** 2026-11-19 11:50 WIB  
**Target Branch:** `main` (remediating audit against `9b44292`)  
**Mode:** `ground_rules_v5.md` FAST + AUDIT verification  

---

## 1. Completed Remediation Items (Items 1–11 + Owner Decisions #4 & #5)

| Item | Change Summary | Files Touched | Verification |
| :--- | :--- | :--- | :--- |
| **1 (T5a, T5c)** | Exported shared `EXTRACTABLE_TEXT_EXT_RE` in `extract.ts`; added `getDriveFileById` and wired `handleExtractFileJob` (`driveFileId` path) to `ensureDriveFileExtracted` (skipping download & rewrite when `extractedText` is cached). | `src/services/extract.ts`, `src/repositories/batches.repository.ts`, `src/worker/index.ts` | `worker.test.ts` (9/9) + `extract-and-drive-download.test.ts` (9/9) |
| **2 (T2, T3)** | Extracted canonical taxonomy, `SINGLETON_DOC_TYPES`, `detectDitFormKind`, `isDitTaskContext`, and extension/token helpers into `drive-doc-types.ts`; removed duplicate 3x regex/slot lists across `drive.ts` & `drive-revisions.ts` while preserving rule precedence. | `src/services/drive-doc-types.ts`, `src/services/drive.ts`, `src/services/drive-revisions.ts` | `drive.test.ts` (8/8) + `drive-revisions.test.ts` (4/4) |
| **3 & 12 (T4, T12)** | Extracted shared camel/snake field reader `readField` / `readStringField` / `readArrayField` (`record-fields.ts`); unified shared non-candidate stop-words (`NON_CANDIDATE_SHARED_TOKENS`) and file-extension stripping across `names.ts` and `drive.ts`. | `src/lib/utils/record-fields.ts`, `src/services/vatm-rollup.ts`, `src/lib/ak05/decision-rules.ts`, `src/lib/forms/assessee-forms.ts`, `src/lib/names.ts`, `src/services/drive.ts` | `names.test.ts` (5/5) + `rollup.test.ts` (6/6) + `official-forms-export.test.ts` (7/7) |
| **4 (T11)** | `buildAk02Payload` now accepts optional pre-computed `resolvedOverall` from `assessees/[assesseeId]/page.tsx`; moved overall decision rule prose to `formatOverallDecisionRuleSummary` in `decision-rules.ts`. | `src/lib/forms/assessee-forms.ts`, `src/lib/ak05/decision-rules.ts`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/page.tsx`, `overall-decision-override.tsx` | `typecheck` + `official-forms-export.test.ts` |
| **5 (T6)** | Extracted IO-free pure `selectDitInputFiles` and `formatSchemeInstructionsText` into `src/lib/forms/dit-inputs.ts`, shared by both `dit/page.tsx` and `resolveAssesseeDitInputs` (`drive-extract.ts`). | `src/lib/forms/dit-inputs.ts`, `src/services/drive-extract.ts`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/page.tsx` | `dit-inputs.test.ts` (1/1) + `route.test.ts` (4/4) |
| **6 (M1)** | Delegated `resolveUnitsForScheme` (`sync-vatm-decisions.ts`) to `resolveSchemeUnitsList` (`assessee-forms.ts`) so `manifest.units -> manifest.kelompokPekerjaan -> fallback` stays consistent across VATM rollup, worker sync, and assessee page. | `src/lib/forms/sync-vatm-decisions.ts` | `scheme-manifest-portability.test.ts` (3/3) |
| **7 (T7, T8)** | Memoized canonical name matching (`Map`) inside `handleDriveScanJob`, passed `existingPool` into `upsertAssesseesForBatch`, removed redundant post-upsert `listAssesseesByBatch`; replaced `textLen` tie-break in `compareDriveFileFreshnessDesc` with deterministic `confidence` -> `fileName.localeCompare`. | `src/worker/index.ts`, `src/repositories/assessees.repository.ts`, `src/services/drive-revisions.ts` | `worker.test.ts` (9/9) + `drive-revisions.test.ts` (4/4) |
| **8 (T5b)** | Unified `enrichAmbiguousFilesByContent` and `reclassifyBatchFilesByContent` onto parameterized `enrichFilesByContent` in `drive-extract.ts`. | `src/services/drive-extract.ts`, `src/worker/index.ts` | `worker.test.ts` + `extract-and-drive-download.test.ts` |
| **9 (T1)** | Consolidated `classifyDriveFileName` and `classifyDocumentTextContent` onto `UNIFIED_CLASSIFIER_RULES` in `drive.ts` keyed by `DRIVE_DOC_TYPES` with harmonized confidences (`04a: 0.92`, `apl01/apl02: 0.95`, `06c: 0.92`, `dit_form: 0.90`, `cv: 0.90`). | `src/services/drive.ts`, `src/services/drive-doc-types.ts` | `drive.test.ts` (8/8) |
| **10 (T9, T10)** | Documented token (`scoreCandidateNameMatch`) vs Levenshtein (`computeNameSimilarity`) scorer roles in `names.ts` without changing thresholds; extracted `loadBatchWithScheme`, `resolveSchemeForBatch`, and `resolveDriveApiKeyIfNeeded` in `worker/index.ts`. | `src/lib/names.ts`, `src/worker/index.ts` | `names.test.ts` (5/5) + `worker.test.ts` (9/9) |
| **11 (R5, T10)** | Extended `runRepositoryDualPath` with strict `unscopedPublicRead: true` opt-in (for global `app_config` reads while remaining fail-closed for user RLS calls); migrated remaining 7 repositories (`config`, `provider`, `schemes`, `signatures`, `batches`, `assessees`, `assessment`) to `runRepositoryDualPath` with shared row mappers; chunked Drizzle inserts (`100`) + updates (`20`) in `upsertDriveFilesForBatch`; explicitly documented 3-tier fallback in `jobs.repository.ts`. | `src/db/index.ts`, `src/repositories/{config,provider,schemes,signatures,batches,assessees,assessment,jobs}.repository.ts` | `dual-path.test.ts` (5/5) + `get-config.test.ts` (3/3) + remote `RLS-01..RLS-36` (36/36) |
| **Owner #4** | Switched assessee detail UI (`assessees/[assesseeId]/page.tsx`) to use live `computeVatmUnitRollup` outputs as the sole display source (`u.aiRecommendation`, `u.vatmReasoning`), stopping stale DB `ai_recommendation` values from overriding live computations. | `src/app/(app)/batches/[id]/assessees/[assesseeId]/page.tsx` | `typecheck` + `vatm-rollup.test.ts` |
| **Owner #5** | Marked synthetic unit fallback in `resolveSchemeKelompokPekerjaan` with `isGenericFallback: true` + `hasGenericFallbackKelompok`; added UI warning banner in `Ia04bBlankoPreview` and prompt annotation in `formatSchemeInstructionsText`. | `src/repositories/schemes.repository.ts`, `src/lib/forms/assessee-forms.ts`, `src/lib/forms/dit-inputs.ts`, `src/components/forms/ia04b-blanko-preview.tsx` | `scheme-manifest-portability.test.ts` (3/3) + `official-forms-export.test.ts` (7/7) |

---

## 2. Verification Results

- `npm run typecheck` (`tsc --noEmit`): **0 errors**
- `npx eslint . --max-warnings 0`: **0 errors, 0 warnings**
- `npm test` (`vitest run`): **25/25 test files passed, 101/101 tests passed**
- `npm run build` (`next build`): **Compiled successfully in 42s (36 routes + Proxy Middleware)**
- `npx supabase migration list --remote`: **All 10 migrations (`20261118000001`–`20261119000010`) verified present**
- `npx supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql`: **36/36 RLS assertions PASS, 0 FAIL**
- Source footprint (`src/**/*.ts,*.tsx`): **162 files, 25,281 lines** (down from 26,951 lines in Round 9 baseline even with 5 new regression tests added)
