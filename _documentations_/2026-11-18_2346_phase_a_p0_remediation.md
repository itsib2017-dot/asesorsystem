# Phase A Remediation Report — P0 Functional & Pipeline Blockers

**Timestamp:** 2026-11-18 23:46 WIB  
**Tickets Completed:** T1, T2, T3, T4, T5 (Round 6 Brief Cacat 1, Cacat 2, Cacat 3, Cacat 5 + Drive Extraction Pipeline Gap)  
**Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2)

---

## 1. Summary of Changes

### T1 — Fix `classifyDriveFileName` for `Tugas DIT` `.pptx` Presentations (Cacat 5)
- **File:** `src/services/drive.ts`, `src/services/__tests__/drive.test.ts`
- **Root Cause:** Bare `\bdit\b` token matched `04a` before `04b`, `04b` omitted `presentasi`, and `tugas dit` folder fallback classified `.pptx` as `04a` — causing all 13 flat `.pptx` presentations in Demo Data `Tugas DIT` to misclassify as `04a`.
- **Fix:**
  - Keep explicit `04a` (`\b04a\b|ia[\s._-]*04a|instruksi\s*terstruktur`) as `04a`.
  - Match `04b` and `\bpresentasi\b` as `04b`.
  - Route `tugas dit` / `\bdit\b` `.pptx`/`.ppt` slides to `04b` and `.docx`/`.pdf` to `04a`.
  - Added `\d+\.\s*pengantar\s*pelatihan\b` to `materi_pelatihan`.
  - Added unit tests covering all Demo Data `Tugas DIT` filename patterns.

### T2 — SSRF-Guarded On-Demand Public Drive Download & Extraction + `similarity_pairs` Scope Fix
- **Files:** `src/services/extract.ts`, `src/services/drive-extract.ts`, `src/worker/index.ts`, `src/services/__tests__/extract-and-drive-download.test.ts`
- **Root Cause:** `handleDriveScanJob` crawled Drive metadata only (`extractedText` remained `null`), leaving `dit_analysis`, `written_grading`, and `similarity_run` starved for text. Also, `handleSimilarityRunJob` wrote `scope: "06c"`, violating the `CHECK (scope in ('dit','written'))` constraint in `migrations/000005:225`.
- **Fix:**
  - Added `extractTextFromPdfBasic` (pure Node `zlib`) and `extractTextFromBuffer` in `src/services/extract.ts`.
  - Created `src/services/drive-extract.ts` with `downloadPublicDriveFileBuffer` (strict file ID regex, manual redirect validation against `ALLOWED_DRIVE_DOWNLOAD_DOMAINS`, 15 MB size limit, 15s timeout, HTML interstitial rejection), `ensureDriveFileExtracted`, and `resolveAssesseeDitInputs`.
  - Wired on-demand extraction into `handleExtractFileJob`, `handleDitAnalysisJob`, `handleWrittenGradingJob`, and `handleSimilarityRunJob`; mapped `similarity_pairs.scope` to `"dit" | "written"`.

### T3 — Explicit DIT Analysis Trigger UI & DB Completeness Gate (Cacat 1)
- **Files:** `src/app/api/v1/dit/[assesseeId]/analyse/route.ts`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/_components/dit-analysis-trigger.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/page.tsx`, `src/app/api/v1/dit/[assesseeId]/analyse/__tests__/route.test.ts`
- **Fix:**
  - Updated `POST /api/v1/dit/[assesseeId]/analyse` to validate UUID, resolve `04a`/`04b`/`cv` texts from DB (`resolveAssesseeDitInputs`) when omitted from POST body, and enforce `checkDitCompletenessGate`.
  - Added `<DitAnalysisTrigger />` on `/dit` displaying readiness status per document, optional manual text inputs (for image-scanned PDFs), double-submit prevention, and job feedback.

### T4 — Shared FR.AK.05 Decision Roll-Up Across Preview, Exports, and Worker (Cacat 2)
- **Files:** `src/repositories/assessment.repository.ts`, `src/lib/ak05/rollup.ts`, `src/services/export.ts`, `src/app/(app)/batches/[id]/ak05/page.tsx`, `src/components/ak05/ak05-preview.tsx`, `src/app/api/v1/batches/[id]/ak05/export/route.ts`, `src/worker/index.ts`, `src/lib/ak05/__tests__/rollup.test.ts`
- **Fix:**
  - Added `listDecisionsForBatch` in `assessment.repository.ts` (eliminates N+1 queries).
  - Created `computeAk05RowForAssessee` & `resolveAk05BatchRows`: any `"BK"` unit rolls up to `"BK"` with BK unit code+title in `keterangan`; `"K"` only when decided and 0 `"BK"`; undecided assessees render `"-"` and `"Belum diputuskan"` (never `"K"`).
  - Applied uniformly across `ak05/page.tsx`, `ak05/export/route.ts`, and `handleAk05ExportJob`.

### T5 — `FR.IA.09` Interview Migration, UI Route, Multi-Channel VATM Roll-Up & FK Fix (Cacat 3)
- **Files:** `supabase/migrations/20261118000008_interview_assessments.sql`, `tests/rls-multi-lsp.test.sql`, `src/db/schema.ts`, `src/services/vatm-rollup.ts`, `src/lib/forms/sync-vatm-decisions.ts`, `src/repositories/assessment.repository.ts`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/actions.ts`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/page.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/interview/*`, `src/lib/forms/assessee-forms.ts`, `src/app/api/v1/batches/[id]/assessees/[assesseeId]/export/route.ts`, `src/services/__tests__/vatm-rollup.test.ts`
- **Fix:**
  - Applied migration `20261118000008_interview_assessments.sql` to Supabase remote (`oiplhsmmfuqriaqrxjud`) with strict multi-LSP RLS (`ia09_select`, `ia09_insert`, `ia09_update`).
  - Built `computeVatmUnitRollup` & `syncAssesseeVatmRecommendations` combining DIT, Written `06C`, and Interview `FR.IA.09` into `decisions` per unit.
  - Fixed composite FK bug in `saveUnitDecisionAction` (`batch.lspId` instead of `batchId`), seeded all scheme units on `AssesseeDetailPage`, added `/interview` page showing scanned `09`/portfolio files and Ya/Tidak/K/BK evaluation form, and wired `hasInterview` into `FR.AK.02` `pihak_ketiga` evidence column.

---

## 2. Verification Evidence

- `supabase db push --remote --yes`: Applied `20261118000008_interview_assessments.sql`.
- `supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql`: **32/32 PASS** (`RLS-01`..`RLS-32`).
- `supabase db advisors --linked`: 0 table/RLS advisor issues.
- `npm run typecheck`: **PASS (0 errors)**.
- `npm run lint`: **PASS (0 errors, 0 warnings)**.
- `npm test`: **PASS (18 test files, 63 tests)**.
- `npm run build`: Verified prior to Phase A commit.
