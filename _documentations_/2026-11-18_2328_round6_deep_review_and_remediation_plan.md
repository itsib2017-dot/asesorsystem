# Round 6 Deep Review & OODA Remediation Plan

**Timestamp:** 2026-11-18 23:28 WIB  
**Mode:** ENTERPRISE AUDIT MODE (`ground_rules_v5.md` §0.2) — Read-Only Review & Planning (No code edited yet)  
**Repo HEAD:** `2daf75a` (`chore(graphify,docs): update knowledge graph and document BlankoA4Sheet layout verification`)  
**Authority:** `D:\PRIVATES\Documents\Kimi\ground_rules_v5.md` (matches repo `ground_rules_v5.md` except Part B line 13 punctuation & Chrome MWG bullet in `D:\PRIVATES\Documents\Kimi\`)

---

## 1. Startup Confirmation: Stack, Tooling & Environment Audit

### 1.1 Confirmed Stack (`package.json`, `tsconfig.json`, `vitest.config.ts`)
- **Framework:** Next.js `16.4.6` (App Router), React `19.3.0`, TypeScript `^5` (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Styling:** Tailwind CSS `4.3.3` + `@tailwindcss/turbopack` (`4.3.3`), `lucide-react` `^1.74.0` (note: `@tanstack/react-query` and `shadcn/ui` from `ground_rules_v5.md` §A.2 are not installed)
- **Database & Auth:** Supabase Auth (`@supabase/ssr` `^0.12.7`, `@supabase/supabase-js` `^2.119.0`) + PostgreSQL (`supabase/migrations/20261118000001..000007`) + Drizzle ORM `^0.45.4` (`postgres` `^4.1.1`)
- **AI / Validation / Docs:** `ai` `^7.0.176` (`@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`), `zod` `^4.6.7`, `docx` `^9.15.4`, `pdf-lib` `^1.17.1`, `exceljs` `^4.4.0`, `jszip` `^3.10.2`, `mammoth` `^1.13.0`
- **Testing & Lint:** Vitest `^2.1.9` (`include: ["src/**/*.{test,spec}.{ts,tsx}"]`), ESLint `^9` (`eslint-config-next: 16.4.6`)
- **Baseline Check (verified 2026-11-18 23:26 WIB):**
  - `npm run typecheck` (`tsc --noEmit`): **PASS (0 errors)**
  - `npm run lint` (`eslint`): **PASS (0 errors, 0 warnings)**
  - `npm test` (`vitest run`): **PASS — 14 test files, 47 tests passed**

### 1.2 Environment Config Status (Keys Only — No Values Read/Logged)
- **Present in `.env.local`:** `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `BYOK_ENCRYPTION_SECRET`
- **Missing from `.env.local` (vs `.env.example` / `src/db/index.ts`):**
  - `DATABASE_URL`, `DIRECT_URL`, `ENABLE_DIRECT_DB` (note: `ENABLE_DIRECT_DB` is required by `src/db/index.ts:15` for Drizzle `withRlsTransaction`, yet is absent from `.env.example`)
  - `SUPABASE_SERVICE_ROLE_KEY` (optional in `src/lib/env.ts:9`, admin scripts only)
- **Dead in `.env.example` (0 references in `src/`):** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`

### 1.3 Skill Bootstrap Status (`ground_rules_v5.md` §A.7)
- **Active:** `context7` MCP, Vitest, TypeScript, ESLint, local skills in `.agents/skills/` (`caveman`, `tdd`, `code-review`, `graphify`, `diagnosing-bugs`).
- **Emulated / Unavailable on Vercel Hobby:** Docker local worker (`tesseract` OCR, `msoffcrypto-tool` Python sidecar per `ADR-0004`), Playwright E2E runner, Sentry SDK, Turnstile verification, `gitleaks` binary.

---

## 2. OODA Deep Review Findings (Code + Demo Data + Sources Verified)

### 2.1 Google Drive Demo Data & Sources Inspection (Metadata/Patterns Only, No PII Logged)
- **Demo Data (`1PnJkNc8mc7SLCk109d3l419oFmsOwHJg`):**
  - `Persyaratan Pelatihan AK3 umum BNSP`: 23 candidate subfolders holding `KTP`, `FR.APL.01`, `FR.APL.02`, `Ijazah`, `CV`, `Surat Tugas/SK`, `Foto`, `Sertifikat`.
  - `Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Materi`: 12 instructional files (11 `.pdf`, 1 `.png`).
  - `Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026/Tugas DIT`: **21 entries** — 8 candidate subdirectories (6–10 `.docx`/`.pptx` files each) + **13 flat `.pptx` files**:
    - 0 of 13 contain `04a` or `04b` in filename.
    - 6 contain `presentasi` + `dit`; 5 contain `dit` without `presentasi`; 2 contain neither.
- **Sources (`1e_VNP7ZodAkiM6Pon8ZOc8xUKGwkwgFY`):**
  - `SKEMA`: 3 schemes (`00. Pengawas K3 Migas`, `1. Ahli Keselamatan dan Kesehatan Kerja Umum`, `3. ICT Project Manager`). `AK3U` includes official `.docx` forms including `FR.IA.04A`, `FR.IA.04B`, `FR.IA.06A/B/C`, `FR.IA.09. PERTANYAAN WAWANCARA.docx`, plus `PASSWORD FR.IA.06B.xlsx`.
  - `ASESMEN (DONE)`: `ONLINE` and `ONSITE` completed batch examples.

### 2.2 Verification & Extensions of Round 6 Brief (Cacat 1–5 + Checklist P1)

| Item | Round 6 Brief Claim | Deep Code & Data Verification |
|---|---|---|
| **Cacat 1 (P0) — No DIT Trigger in UI** | `POST /api/v1/dit/[assesseeId]/analyse` has no UI caller. | **CONFIRMED + CRITICAL PIPELINE GAP FOUND:** `dit/page.tsx` has no trigger button/form. Furthermore: (1) `analyse/route.ts:51` runs `checkDitCompletenessGate(parsed.data)` on the HTTP body instead of loading `drive_files` from DB; (2) `handleDriveScanJob` (`worker/index.ts:161-230`) crawls Drive metadata only and leaves `extractedText = null` for all scanned Drive files; `handleExtractFileJob` (`worker/index.ts:233-290`) is never called from `drive_scan`, `dit_analysis`, `written_grading`, or `similarity_run`. Adding a UI button alone will fail with 422 unless `analyse/route.ts` reads DB files and Drive OOXML files (`.docx`/`.pptx`) get extracted. |
| **Cacat 2 (P0) — AK.05 Hardcoded `"K"`** | `ak05/page.tsx:85` hardcodes `recommendation: "K"`. | **CONFIRMED + SECOND LOCATION FOUND:** Both `batches/[id]/ak05/page.tsx:82-87` AND `api/v1/batches/[id]/ak05/export/route.ts:112-117` hardcode `recommendation: "K" as const, keterangan: ""`. Also, `handleAk05ExportJob` (`worker/index.ts:626-640`) computes BK vs K from `listDecisionsForAssessee`, yet defaults to `"K"` even when `unitDecisions.length === 0` (undecided). |
| **Cacat 3 (P0) — No Wawancara / `FR.IA.09` UI** | No interview route/tab/component in `src/app`. | **CONFIRMED + SPEC CONFLICT:** `drive.ts:92-94` classifies `09`, and `FR.IA.09. PERTANYAAN WAWANCARA.docx` exists in `Sources/SKEMA`. However, `_documentations_/docs/01-project-overview.md:194` (`D4`) deferred `FR.IA.09` to P1, `migrations/000005` has no `interview_assessments` table, and `src/ai/prompts/source/prompt_wawancara_k3.md` is actually the DIT RCTFA prompt (`04A` + presentation), not `FR.IA.09`. Needs schema + UI confirmation. |
| **Cacat 4 (High) — Premature Positive Defaults** | UI shows positive verdicts before assessment. | **CONFIRMED** in all 3 places: (1) `assessees/[assesseeId]/page.tsx:100-103` (`ocrConfidence ?? 0.92`, `verdict ?? "match"`); (2) `written/page.tsx:130-137` (green `CheckCircle2` when `plagiarism` is undefined); (3) `load-batch-similarity.ts:57-60` (`plagiarismStatus: "Bersih"` before any check runs). |
| **Cacat 5 (High) — Classifier Regression (`04b` → `04a`)** | `Tugas DIT` `.pptx` files misclassify as `04a`. | **CONFIRMED AGAINST DEMO DATA:** In `drive.ts:77-82,131-133`, `\bdit\b` runs before `04b`, `04b` lacks `presentasi`, and `tugas dit` fallback forces `.pptx` to `04a`. All 13 flat `.pptx` presentations in Demo Data `Tugas DIT` classify as `04a`, starving `dit/page.tsx:44` (`docType === "04b"`). Note also `inferCandidateNameFromDrivePath` (`drive.ts:376-386`) only parses flat files starting with `tugas`/`dit` (the 2 `.pptx` without prefix go to triage). |
| **P1: Triage Controls** | Cannot fix `docType`, no pagination/search. | **CONFIRMED + GOOD NEWS:** `triage/actions.ts:14,24` already accepts `docType` — only `triage/page.tsx` lacks `<select name="docType">`, search/filter, pagination (`ground_rules_v5.md` §C.7), and `overflow-x-auto`. |
| **P1: Encrypted `06B` Password Path (`D12`)** | Claims error says text not found. | **NUANCE:** `extractTextFromDocx` (`extract.ts:20-22`) *does* detect OLE magic bytes and throws `KEY_ENCRYPTED: Dokumen OOXML terenkripsi memerlukan kata sandi runtime.` However, neither `BatchKeyUploadPanel` nor `WrittenKeyForm` has a password input, and no runtime decryptor (`msoffcrypto-tool` or pure-JS OOXML Agile decryptor) is wired on Vercel. |
| **P1: Similarity Thresholds (`D19` / `OQ-08`)** | Unconfirmed defaults shown as authoritative. | **CONFIRMED + DRIFT FOUND:** `services/similarity.ts:1-4` defines `{ exact: 0.9, near: 0.75, partial: 0.5 }`, whereas `migration 000005:409` seeds `{"exact":0.85,"near":0.65,"partial":0.45,"unconfirmed":true}` in `app_config`. `similarity/page.tsx:58-62` does not mark defaults as uncalibrated/provisional. |
| **P1: Combined Report Per-Assessee Section** | `verdicts: []` & `ringkasanKesalahan: []`. | **CONFIRMED:** `load-batch-similarity.ts:52-61` never loads `getLatestWrittenGrading`. |
| **P1: Small-Medium Items** | Date, logos, footer, schemeNumber, edit audit, rescan guard, etc. | **CONFIRMED:** `assessmentDate` defaults to today in 3 files (`ak05/page.tsx:78`, `ak05/export/route.ts:111`, `load-assessee-page-data.ts:38`); `extractSchemeNumber` falls back to `decisionRuleRef` in 3 files; `BlankoSheetHeader` hardcodes AK3U logos; `BlankoSheetFooter` missing on `Ia04bBlankoPreview` and `Ia06cBlankoPreview`; `DEFAULT_DOC_COLUMNS` hardcoded in `batches/[id]/page.tsx:29`; `rescanBatchDriveAction` lacks submit disable/pending UI; `studentAnswerText` manual edits lack audit log/badge; `dashboard/page.tsx` caps jobs at 100 (`api/v1/jobs/route.ts` at 50) and hardcodes `"Otoritas KTP Aktif"`. |

### 2.3 Complexity Audit (R1–R15) Reconciled Against `ground_rules_v5.md`
- **Safe Low-Risk Quick Wins (R9–R12, R14):** Remove `hello` job + empty `src/worker/handlers/`, remove unused Turnstile/Sentry vars from `.env.example` (or wire if approved), remove duplicate `src/ai/prompts/source/*.md` (keep SHA provenances in `.v1.ts` and originals in `_documentations_/research/prompts/`), refresh `graphify-out/` after changes.
- **High-Risk / Rule-Conflict Items Requiring Explicit Decision:**
  - **R5 (Dual Drizzle + Supabase REST, 40 `hasDatabaseUrl()` branches):** `ground_rules_v5.md` §A.2 explicitly locks **Drizzle ORM through `src/repositories/`** (Supabase client for Auth/Storage only). Removing Drizzle without an approved ADR violates §A.2; conversely, leaving `ENABLE_DIRECT_DB` unset on Vercel leaves 40 dead branches. Recommended staged path: keep Drizzle per §A.2 (or extract `runWithDirectDbFallback` helper first while measuring Vercel `DATABASE_URL` usage).
  - **R1–R4 (Harness files & `docs/` vs `_documentations_/`):** `tests/` (253 files, 17 importing nonexistent `../src/*.js`), `scripts/`, `configs/`, `hooks/`, `.claude*`, etc. are agent-harness artifacts unused by Next.js/Vitest/CI, **but `.agents/` and `ground_rules_v5.md` are actively used by the coding workspace (`AGENTS.md`)**, and `ground_rules_v5.md` §A.1/§A.4 expects `docs/` for F-sections while user global rules mandate `_documentations_/` for session docs. Do not delete `.agents/` or `ground_rules_v5.md` blindly.
  - **R6–R7 (AK.05 PDF + 04B Manifest):** Vercel Hobby lacks LibreOffice headless, so PDF generation should retain `pdf-lib` while extracting shared AK.05 layout constants (`R6 Option A`); `IA04B_KELOMPOK_PEKERJAAN` & `AK3U_OFFICIAL_UNITS` should migrate into `SchemeManifestConfig` (`R7`).

---

## 3. Ordered Remediation Plan & Tickets (1 Focused Change Per Ticket)

> **Execution Discipline (`ground_rules_v5.md` §0.2 & §0.4):** Every ticket below waits for user approval and resolution of the 3 blocking questions in §4. After each ticket: `npm run typecheck && npm run lint && npm test` must pass. `AUDIT MODE` applies to schema/RLS, uploads, auth, audit log, external fetches, and official export integrity.

### Phase A — P0 Functional & Pipeline Blockers
1. **T1 [AUDIT] — Fix `classifyDriveFileName` for `Tugas DIT` `.pptx` Presentations (Cacat 5):**
   - Update `src/services/drive.ts` so `.pptx` files with `presentasi` (or in `Tugas DIT` without explicit `04a`) classify as `04b` before `04a`/fallback rules, while preserving `FR_IA_04A*.pptx` as `04a`. Add regression tests in `src/services/__tests__/drive.test.ts` covering all Demo Data `Tugas DIT` filename patterns.
2. **T2 [AUDIT] — Wire On-Demand Public Drive OOXML Extraction (`04a`/`04b`/`cv`/`06c`/`09`) (Pipeline Gap):**
   - Add SSRF-guarded (`drive.google.com` / `googleapis.com`) public Drive file download + `extractTextFromDocx`/`extractTextFromPptx` helper invoked on demand when `extractedText` is null (for `dit_analysis`, `written_grading`, `similarity_run`), persisting `extractedText` via `updateDriveFileExtraction`. Keep KTP images local-only (`ADR-0005`, never sent to LLM).
3. **T3 [AUDIT] — Wire DIT Analysis Trigger UI + DB Completeness Gate (Cacat 1):**
   - Update `POST /api/v1/dit/[assesseeId]/analyse` (`analyse/route.ts`) to resolve `04a`, `04b`, and `cv` texts from DB (extracting on demand via T2 if missing) before evaluating `checkDitCompletenessGate`.
   - Add client `"Jalankan Analisis DIT"` trigger component on `dit/page.tsx` with pending/double-submit lock and job error/status display.
4. **T4 [AUDIT] — Fix AK.05 Roll-Up in Preview, PDF/DOCX Export, & Worker (Cacat 2):**
   - Extract shared helper `resolveAk05CandidateRows(userId, assessees)` reading `listDecisionsForAssessee`: `"BK"` if any unit is `"BK"` (with `keterangan` listing BK unit codes/titles), `"K"` only when unit decisions exist and none are `"BK"`, and `"-"` / `"Belum diputuskan"` when 0 decisions exist.
   - Apply identically to `ak05/page.tsx`, `api/v1/batches/[id]/ak05/export/route.ts`, and `worker/index.ts:handleAk05ExportJob` (plus block final AK.05 PDF/DOCX export if any assessee has undecided units, or confirm rule).
5. **T5 [AUDIT] — Interview / `FR.IA.09` Flow (Cacat 3 — Gated on Q1):**
   - Pending Q1 decision: add forward-only migration (`interview_assessments` with multi-LSP RLS + two-LSP test) or record against `decisions`, add interview UI section on assessee detail showing scanned `09` files and saving K/BK VATM contribution + audit log.

### Phase B — High / P1 Data Integrity & UX Accuracy
6. **T6 [FAST] — Remove Premature Positive Defaults Before Assessment (Cacat 4):**
   - `NameJuryCard` + `assessees/[assesseeId]/page.tsx`: represent unrun jury as neutral `"Belum dijalankan"` (no `"Cocok"` badge or `92%` confidence).
   - `written/page.tsx`: use neutral grey icon when `plagiarism` is absent (`"Belum dianalisis"`).
   - `load-batch-similarity.ts`: distinguish `"Belum diperiksa"` vs `"Bersih"` vs `"Waspada"` when no similarity/written grading exists.
7. **T7 [AUDIT] — Triage `docType` Correction UI + Pagination/Search + Overflow Fix (P1):**
   - Expose `<select name="docType">` (already accepted by `assignDriveFileAction`) in `triage/page.tsx`, add search/filter + pagination (25–50 rows/page per §C.7) and `overflow-x-auto`.
8. **T8 [AUDIT] — Encrypted `06B` Runtime Password UX / Decryption (P1 + D12 — Gated on Q2):**
   - Add optional runtime password field (never persisted or logged) to `BatchKeyUploadPanel` and `WrittenKeyForm`; ensure `KEY_ENCRYPTED` guidance is clear and wire decryption if pure-JS Agile OOXML decryption is approved.
9. **T9 [FAST] — Similarity Threshold Provisional Label & Per-Assessee Written Summary (P1):**
   - Align `DEFAULT_SIMILARITY_THRESHOLDS` with `app_config` (`0.85/0.65/0.45` + `unconfirmed: true` per `migration 000005:409`), show `"Sementara / Belum Dikalibrasi"` badge in `similarity/page.tsx` and Markdown/DOCX report; load `getLatestWrittenGrading` in `load-batch-similarity.ts` to populate `verdicts` & `ringkasanKesalahan`.
10. **T10 [FAST] — Blanko Metadata & Chrome Polish (P1 Small-Medium):**
    - Replace `new Date().toISOString().slice(0, 10)` fallback in `ak05/page.tsx`, `ak05/export/route.ts`, and `load-assessee-page-data.ts` with `"Belum ditentukan"` / `""`.
    - Fix `extractSchemeNumber` fallback so `decisionRuleRef` is never rendered as scheme number (`"-"` if absent); extract one shared helper.
    - Add `BlankoSheetFooter` to `Ia04bBlankoPreview` and `Ia06cBlankoPreview`; add submit-disable pending state + surfaced audit warning to `rescanBatchDriveAction` (`batches/[id]/page.tsx`); log & badge manual edits to `studentAnswerText` (`written-key-form.tsx`).

### Phase C — Config Portability (D21) & Low-Risk Code Cleanup
11. **T11 [FAST] — Migrate `AK3U_OFFICIAL_UNITS` & `IA04B_KELOMPOK_PEKERJAAN` to `SchemeManifestConfig` (R7):**
    - Extend `SchemeManifestConfig` (`schemes.repository.ts`, `config/types.ts`) with optional `kelompokPekerjaan` & `branding` (logos) + `docColumns`; keep AK3U fallback only as temporary compatibility while seeding AK3U manifest, resolving `BlankoSheetHeader` logos & `DEFAULT_DOC_COLUMNS` from manifest.
12. **T12 [FAST] — Low-Risk Dead Code Cleanup (R9, R10, R11, R12, R6 Option A):**
    - Remove `hello` job type (`queue.ts`, `worker/index.ts`, `jobs/enqueue/route.ts`, `worker.test.ts`) and empty `src/worker/handlers/`.
    - Remove dead Turnstile/Sentry keys from `.env.example` (unless installing them is preferred).
    - Remove duplicate `src/ai/prompts/source/*.md` (retain SHA pin in `.v1.ts` & originals in `_documentations_/research/prompts/`).
    - Extract shared AK.05 layout constants (`#4472C4`, `#A8D08D`, `#92D050`, form code) between `export.ts` and `ak05-preview.tsx` (`R6 Option A`).

### Phase D — Architectural & Repo Hygiene Decisions (Gated on Q3)
13. **T13 [AUDIT] — Standardize Single Data Access Pattern or Helper (`R5` vs `ground_rules_v5.md` §A.2):**
    - Either extract `runWithDirectDbFallback` helper and verify `ENABLE_DIRECT_DB` on Vercel, or formally record an ADR choosing one path (Drizzle vs Supabase REST).
14. **T14 [FAST] — Separate Dead Agent Harness Artifacts (`R1–R4`, `R14`):**
    - Split/remove dead harness artifacts (`tests/` importing missing `../src/*.js`, `scripts/`, `configs/`, `hooks/`) without breaking active workspace `.agents/` or `ground_rules_v5.md`, then regenerate `graphify-out/`.

---

## 4. Clarifying Questions Required Before Implementation (`ground_rules_v5.md` §0.4)

1. **Cacat 3 (`FR.IA.09` Interview Flow vs `D4`):** `_documentations_/docs/01-project-overview.md:194` deferred `FR.IA.09` to P1, and `migrations/000005` has no `interview_assessments` table. Do you want us to add a new `interview_assessments` migration + UI section + VATM roll-up now (AUDIT MODE), or keep `FR.IA.09` out of MVP per `D4`?
2. **Drive Text Extraction & Encrypted `06B` Scope on Vercel:** Should we add on-demand public Drive download + JS OOXML (`.docx`/`.pptx`) extraction inside the app for `dit_analysis`/`written_grading`/`similarity_run`, and for encrypted `06B` do you want pure-JS Agile OOXML decryption implemented or only a clearer encrypted-file UX + plain-`.docx` guidance (given Docker `msoffcrypto-tool`/Tesseract is absent on Vercel Hobby)?
3. **Architecture & Hygiene (`R1–R5` vs `ground_rules_v5.md`):**
   - Keep Drizzle ORM as authoritative per `§A.2` (and configure `DATABASE_URL`/`ENABLE_DIRECT_DB`) or standardize on Supabase REST via an ADR?
   - For `R1–R4`, should we remove only dead harness directories (`tests/`, `scripts/`, `configs/`, `hooks/`) while retaining `.agents/` and `ground_rules_v5.md` that this coding workspace actively reads?
