# Round 9 Deep Review & Complexity Remediation Plan

**Date:** 2026-11-19 11:16 WIB  
**Target Branch / HEAD:** `main` @ `9b44292`  
**Mode:** Code Complexity Audit Review (`ground_rules_v5.md` FAST/AUDIT gate discipline — zero code edits yet; waiting for owner confirmation)

---

## 1. OODA Observation & Verification Against Current Codebase

All 11 developer items and 6 owner-decision notes in the Round 9 Complexity Audit (`HEAD 9b44292`) were verified directly against source files on disk:

| Item | Ref | Verified Location & Exact Findings | Critical Implementation Nuance Caught |
| :--- | :--- | :--- | :--- |
| **1** | T5a, T5c | `SCAN_EXTRACTABLE_EXT_RE` (`src/worker/index.ts:129`) === `EXTRACTABLE_EXT_RE` (`src/services/drive-extract.ts:32`), vs `ZIP_EXTRACTABLE_EXT_RE` (`src/services/extract.ts:29`). `handleExtractFileJob` (`src/worker/index.ts:568-626`) downloads and parses directly without checking cached `extractedText`. | `handleExtractFileJob` receives raw queue payload (`fileId`, `base64Content`, `text`, `driveFileId`, `fileName`, `mimeType`), not a `DriveFileRecord`. Must add `getDriveFileById(userId, fileId)` (preserving `base64Content` / inline `text` fast paths) before calling `ensureDriveFileExtracted`. |
| **2** | T2, T3 | `04b` Tugas DIT logic appears 3 times (`src/services/drive.ts:122-132`, `:202-213`, `:244-245`+`:369-375`) at `0.88`/`0.85`/`0.84`. `dit_form` keywords appear 3 times (`drive.ts:135-147`, `drive.ts:307-324`, `src/services/drive-revisions.ts:187-194`). | Precedence in `classifyDriveFileName` is deliberate: rule 3 handles `.pptx?` BEFORE `dit_form`/`cv`/`ijazah`/`surat_tugas` (`:134-199`), while rule 6 handles `.pptx?\|.pdf\|.docx?` AFTER specific admin docs. Merging rules 3 & 6 above line 134 would misclassify `Tugas DIT/CV.pdf` or `Tugas DIT/Form IBPR.pdf` as `04b`. Keep precedence; unify predicate `isDitTaskContext`. |
| **3** | T4, T12 | `getField` (`src/lib/forms/assessee-forms.ts:332-334`), `getArrayField` (`src/services/vatm-rollup.ts:17-25`), inline `??` chains (`src/lib/ak05/decision-rules.ts`). Filename normalization in `fnBase` (`drive.ts:54-59`), `cleanCandidateLabel` (`drive.ts:590-600`), `extractMultiPartSlotKey` (`drive-revisions.ts:178-185`). | `fnBase` MUST retain classification words (`tugas`, `dit`, `ibpr`, `kelompok`), whereas `cleanCandidateLabel` strips them to isolate person names. Extract low-level `stripExtensionAndDupSuffix` + shared `NON_PERSON_TOKENS` without altering `fnBase` behavior. |
| **4** | T11 | `src/app/(app)/batches/[id]/assessees/[assesseeId]/page.tsx:84-88` calls `resolveAssesseeOverallDecision`, then `buildAk02Payload` (`:122-137` -> `src/lib/forms/assessee-forms.ts:400-404`) recalculates it. Prose lives inline in `_components/overall-decision-override.tsx:117-121`. | Pure additive parameter (`resolvedOverall?: ResolvedOverallDecision`) on `buildAk02Payload` + shared formatter `formatOverallRuleSummary(totalUnits)` in `decision-rules.ts`. |
| **5** | T6 | `src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/page.tsx:54-78` duplicates `resolveAssesseeDitInputs` (`src/services/drive-extract.ts:294-314`) selection/deduplication line-for-line. | Extract IO-free pure `selectDitInputFiles(files, batchFiles)` so DIT page gate/preview and `POST /api/v1/dit/[assesseeId]/analyse` + worker read the exact same file set. |
| **6** | M1 | `resolveSchemeUnitsList` (`src/lib/forms/assessee-forms.ts:245-257`) checks `units -> kelompokPekerjaan -> getFallbackAk3uUnits()`; `resolveUnitsForScheme` (`src/lib/forms/sync-vatm-decisions.ts:15-21`) skips `kelompokPekerjaan`. Both are called on the same render in `assessees/[assesseeId]/page.tsx:83,92`. | Delegate `resolveUnitsForScheme` to `resolveSchemeUnitsList` normalizing `code: u.code ?? ""`. Eliminates live divergence on schemes configured via `kelompokPekerjaan`. |
| **7** | T8, T7 | `findBestMatchingCandidate` called 4x in `handleDriveScanJob` (`src/worker/index.ts:437, 447, 457, 486`); `listAssesseesByBatch` called at `:365`, `:479`, and inside `upsertAssesseesForBatch` (`src/repositories/assessees.repository.ts:304, 355`). `compareDriveFileFreshnessDesc` (`src/services/drive-revisions.ts:137-141`) ties breaks by `textLenB - textLenA`. | Cache normalized candidate match lookups once in scan; remove `textLen` tie-break (use `classificationConfidence` then deterministic `fileName.localeCompare`); derive `SINGLETON_DOC_TYPES` from shared `DOC_TYPES` registry. |
| **8** | T5b | `enrichAmbiguousFilesByContent` (`src/worker/index.ts:232-297`) vs `reclassifyBatchFilesByContent` (`src/services/drive-extract.ts:373-467`). | Scan runs BEFORE `drive_files` rows have DB `id`s (mutates `ScanCandidateFile[]` in memory), while Triage runs post-DB (persists updates, inspects `!assesseeId`, runs candidate reassignment). Parameterize `{ persistUpdates, includeUnmatched, reassignAssessee, assessees }` cleanly on one shared function. |
| **9** | T1 | `classifyDriveFileName` (`drive.ts:49`) vs `classifyDocumentTextContent` (`drive.ts:235`) duplicate rules with differing confidences (`04a` `0.92/0.91`, `apl01` `0.95/0.93`, `06c` `0.92/0.90`, `dit_form` `0.90/0.88`, `cv` `0.90/0.88`). | `worker/index.ts:252` checks `byText.confidence > file.confidence`. Needs owner pick between harmonized single confidence per `docType` vs explicit `{ nameConfidence, contentConfidence }` columns on the unified rule table. |
| **10** | T9, T10 | `scoreCandidateNameMatch` (`src/lib/names.ts:51-130`) vs `computeNameSimilarity` (`names.ts:195-205`, used by `name-jury.ts:45-47`). Repeated batch/scheme/API-key loads in `worker/index.ts:696-718, 805-835, 938, 1016-1040`. | Document role split in `names.ts` header + keep thresholds untouched (`0.78`, `0.85/0.70/0.85`); add `loadBatchWithScheme` and `resolveDriveApiKeyIfNeeded` in `src/worker/index.ts`. |
| **11** | R5, T10 | Verified `hasDatabaseUrl` / `runRepositoryDualPath` counts across all 10 repos (`config` `2/0`, `provider` `4/0`, `schemes` `3/0`, `signatures` `3/0`; total 39 `hasDatabaseUrl`). Drizzle `upsertDriveFilesForBatch` (`batches.repository.ts:340-385`) awaits row-by-row vs Supabase REST chunk-100 / concurrent-20 (`:459-475`). | `config.repository.ts:99-114` intentionally uses `getDb()` WITHOUT `withRlsTransaction(userId, ...)` because `app_config` reads have no `userId` parameter. Either extend `DualPathOptions` with optional `userId` / unauthenticated DB mode, or keep `config.repository.ts` documented as intentional; `signatures.repository.ts` keeps Supabase Storage while moving DB query into `runRepositoryDualPath`. |

---

## 2. Architecture & Trade-offs Requiring Owner Decisions Before Coding

1. **Owner Decision #4 — AI VATM Rollup Dual Truth (`assessees/[assesseeId]/page.tsx:91-118` vs `syncAssesseeVatmRecommendations`):**
   - **Option A (Recommended):** Use live `computeVatmUnitRollup` as the sole UI display source (avoiding stale DB `ai_recommendation` wins over scheme changes via `??`), while keeping persisted `ai_unit_recommendations` purely for batch/export compatibility (or dropping stale reads).
   - **Option B:** Keep saved DB override priority and render a visible `"Disinkronkan pada <timestamp>"` indicator.

2. **Owner Decision #5 — Synthetic Kelompok Pekerjaan Fallback (`assessee-forms.ts:266-284`):**
   - **Option A:** Keep fallback generation so schemes with `units` but empty `kelompokPekerjaan` don't crash, AND display an explicit warning banner/label that the questions are generic (not official BNSP FR.IA.04B items).
   - **Option B:** Remove synthetic generation and show a configuration prompt directing admins to populate `kelompokPekerjaan`.

3. **Item 9 — Classifier Confidence Strategy (`drive.ts`):**
   - **Option A:** Harmonize each `docType` to one shared confidence matching filename confidence (`04a: 0.92`, `apl01/apl02: 0.95/0.92`, `06c: 0.92`, `dit_form: 0.90`, `cv: 0.90`) — keeps `>= 0.85` re-inspection threshold untouched.
   - **Option B:** Keep both `nameConfidence` and `contentConfidence` columns in one shared rule table (100% numeric preservation).

4. **Item 11 — R5 Dual-Path Scope (`src/repositories/`):**
   - **Option A:** Migrate only the 4 repositories currently at `0` `runRepositoryDualPath` calls (`provider`, `schemes`, `signatures`, and `config` via optional non-RLS read mode or documented exception) + align `upsertDriveFilesForBatch` Drizzle batching.
   - **Option B:** Migrate all remaining 39 `hasDatabaseUrl` calls across all 8 repositories for 100% consistency (plus upsert batching alignment).

5. **Execution Sequence & Live Browser Verification (`agent-browser`):**
   - **Recommended Order:** Apply Round 9 complexity refactors (keeping API/route/export contracts identical) -> run full local verification (`typecheck`, `lint`, `test`, `build`, `graphify update .`) -> push/deploy -> perform authenticated **Round 10 Live Verification** (`Demo Audit R4` rescan, `dit_form` labels, shared `selectDitInputFiles` gate check, `/settings/audit` logs) with `agent-browser` once you sign in.

---

## 3. Proposed Modular Refactor Plan (Pending Confirmation)

Executed in small, isolated steps, running Vitest + `tsc --noEmit` after related groups:
1. Export `EXTRACTABLE_TEXT_EXT_RE` from `src/services/extract.ts`; add `getDriveFileById` and wire `handleExtractFileJob` `driveFileId` path to `ensureDriveFileExtracted`.
2. Add `src/lib/utils/record-fields.ts` (`readField`, `readStringField`, `readArrayField`) replacing copies in `vatm-rollup.ts`, `assessee-forms.ts`, and `decision-rules.ts`.
3. Extract `detectDitFormKind` & `isDitTaskContext` + shared `DOC_TYPES` / `SINGLETON_DOC_TYPES` metadata while preserving classifier rule order; extract shared `stripExtensionAndDuplicateMarkers`.
4. Extract pure `selectDitInputFiles` shared by `dit/page.tsx` and `resolveAssesseeDitInputs`; add `resolvedOverall` parameter + shared rule summary constant to `buildAk02Payload` & `overall-decision-override.tsx`.
5. Delegate `resolveUnitsForScheme` to `resolveSchemeUnitsList`; implement Owner Decisions #4 & #5 per your choice.
6. Optimize `handleDriveScanJob` canonical lookup cache (`Map`) & pre-fetched pool passing; remove `textLen` tie-break from `compareDriveFileFreshnessDesc`.
7. Unify `enrichAmbiguousFilesByContent` & `reclassifyBatchFilesByContent` into parameterized `enrichFilesByContent`.
8. Unify classifier rule table in `drive.ts` per Item 9 option; document `names.ts` scorers (`scoreCandidateNameMatch` vs `computeNameSimilarity`) without changing thresholds; add `loadBatchWithScheme` & `resolveDriveApiKeyIfNeeded` in `src/worker/index.ts`.
9. Complete R5 `runRepositoryDualPath` migration (`config`/`provider`/`schemes`/`signatures` or full 8-repo scope per choice) + align `upsertDriveFilesForBatch` Drizzle chunking/batching.
10. Verify (`npm run typecheck && npm run lint && npm test && npm run build`), run `python -m graphify update . --force`, update `_documentations_/` report + `_backups_/` checkpoint, and proceed to live Vercel + `agent-browser` verification upon login.
