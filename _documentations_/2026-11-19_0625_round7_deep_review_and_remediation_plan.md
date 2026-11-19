# Round 7 Deep Review & OODA Remediation Plan

- **Timestamp:** 2026-11-19 06:25 WIB
- **Repo HEAD:** `792027e` (`refactor(db,docs): complete Phase D dual-path helper, graphify update, and final verification`)
- **Mode:** ENTERPRISE AUDIT MODE (`ground_rules_v5.md` §0.2) — Read-only deep review & planning (no application code modified yet)
- **Authority:** `D:\PRIVATES\Documents\Kimi\ground_rules_v5.md` (via `AGENTS.md`)

---

## 1. Startup, Tooling & Baseline Confirmation

### 1.1 Confirmed Stack & Baseline Gates (`HEAD 792027e`)
- **Stack:** Next.js `16.4.6` (App Router), React `19.3.0`, TypeScript `^5` (`strict`, `noUncheckedIndexedAccess`), Tailwind CSS `4.3.3`, Supabase Auth/Storage (`@supabase/ssr` `^0.12.7`, `@supabase/supabase-js` `^2.119.0`), Drizzle ORM `^0.45.4` (`postgres` `^4.1.1`), Zod `^4.6.7`, Vitest `^2.1.9`, ESLint `^9`, Vercel AI SDK `ai` `^7.0.176`.
- **Baseline Checks (run 2026-11-19 ~06:21 WIB):**
  - `npm run typecheck` (`tsc --noEmit`): **PASS** (0 errors)
  - `npm run lint` (`eslint`): **PASS** (0 warnings, 0 errors)
  - `npm test` (`vitest run`): **PASS** — **22 test files, 73 tests passed**
- **Env Config Status (Keys Only):**
  - `.env.local` defines: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `BYOK_ENCRYPTION_SECRET`.
  - `.env.example` also documents optional `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `ENABLE_DIRECT_DB`, `GOOGLE_DRIVE_API_KEY`.
- **Knowledge Graph & UI Verification Tools:**
  - **Graphify:** Active (`python -m graphify query`, `5069 nodes`, `12246 edges`); `GRAPH_REPORT.md` build tag (`2c35644a`) will be refreshed after code edits.
  - **`agent-browser` (`vercel-labs/agent-browser`):** **Not installed** locally (absent from `PATH`, global npm, and `node_modules/.bin`). Requires user approval to install/run for ~390px and desktop UI/UX verification (`ground_rules_v5.md` §B & §C.8).

---

## 2. OODA Deep Review of Round 7 Critique

### Cacat 1 (High) — Job & Rescan Events Missing From Audit Log
- **Codebase Findings (`HEAD 792027e`):**
  1. **Incomplete lifecycle logging:** `enqueueJob` / `enqueueJobRecord` (`src/worker/queue.ts:110-134`, `src/repositories/jobs.repository.ts:51-97`) does **not** record `created`, and `executeJob` (`src/worker/queue.ts:28-36`) does **not** record `started`. Only completion/failure is logged at `src/worker/queue.ts:81-105`.
  2. **Missing `lsp_id` & silent catch in `executeJob`:** `src/worker/queue.ts:83-105` omits `lsp_id`, forcing `writeAuditLog` (`src/lib/audit/write-audit-log.ts:30-45`) to query `lsp_memberships` with `.limit(1).maybeSingle()`. If an actor belongs to >1 LSP, `.limit(1)` can pick the wrong tenant so the log is hidden from `LSP-K3-ID2`'s `/settings/audit`, and `catch {}` swallows any failure silently.
  3. **Wrong resource & missing retry logging:**
     - `rescanBatchDriveAction` (`src/app/(app)/batches/[id]/page.tsx:71-85`) logs `resource: "batches"` and `resource_id: batchId` instead of `resource: "jobs", resource_id: jobId`.
     - `retryJobAction` (`src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx:77-83`) logs no explicit retry/rescan audit action.
  4. **No clickable ingest job link in `/settings/audit`:** `AuditLogPage` (`src/app/(app)/settings/audit/page.tsx:81`) only renders a link for `row.resource === "batches"`, not `row.resource === "jobs"` (`/batches/[batchId]/ingest/[jobId]`). Also `formatAuditSummary` (`page.tsx:14`) does not prioritize `type`, `batchId`, or `error`.
  5. **Performance & live anomaly flag:** `upsertDriveFilesForBatch` (`src/repositories/batches.repository.ts:375-411`) executes 315 sequential HTTP row updates/inserts in a `for` loop on the REST path during rescan. Additionally, because `queue.ts:83` and `batches/[id]/page.tsx:71` already exist in `792027e` yet neither appeared on live `/settings/audit` at 05:47 WIB, we must verify (once approved) whether live Vercel/Supabase matches `792027e` + `000007` migration or hit an `audit_insert` / multi-LSP / serverless timeout failure.

### Cacat 2 (High) — Premature Positive / Affirmative Verdicts on Blanko Previews (AK.02 + Siblings)
- **Confirmed in AK.02 (`src/lib/forms/assessee-forms.ts:342-422`, `src/components/forms/ak02-blanko-preview.tsx:110-141`, `src/services/export.ts:773-797`):**
  - `buildAk02Payload` sets `overallRecommendation = bkDecisions.length > 0 ? "BK" : "K"` and `assessorComment = "Asesi memenuhi seluruh persyaratan bukti kompetensi sesuai skema sertifikasi."` even when **0 real decisions** exist (or when `decisions` rows only carry `ai_recommendation` with `decision: null`).
  - `buildAk02Payload:378-390` also adds `"portofolio"` ticks whenever `matched` exists (even if `matched.decision === null`).
  - `generateAk02Docx` (`src/services/export.ts:790-791`) falls back to `"Asesmen dilaksanakan sesuai prosedur dan bukti portofolio serta uji terstruktur."` when `assessorComment` is empty.
- **Confirmed Same Defect Pattern in Sibling Blankos (Rule 2 Audit):**
  - **FR.IA.04B (`assessee-forms.ts:424-495`, `ia04b-blanko-preview.tsx:162-213`, `export.ts:870-917`):** When no DIT analysis and no unit decision exist, `itemAchievedFlags` defaults all 13 items to `false` (rendering `☑ Tidak`), sets `overallRecommendation` to **`"BK"`** (striking through `"memenuhi"` and checking `☑ Belum Kompeten`), and if `decisions` contains `decision: null` rows (`params.decisions.length > 0 && !anyBk`), flips prematurely to **`"K"`**!
  - **FR.IA.06C (`assessee-forms.ts:497-576`, `ia06c-blanko-preview.tsx:112-120`, `export.ts:1010-1028`):** When `writtenGrading` is null (`sorted.length === 0`), `overallAchieved` is `false`, causing `"tercapai"` to be struck through (`belum tercapai` emphasized) before any test is graded.
  - **FR.IA.09 (`interview/page.tsx:124,235`, `interview-assessment-form.tsx:46`):** Editable form defaults `initialOverall` and unit `recommendation` to `"K"` before any interview is saved (though the page header badge correctly shows `"Belum dinilai"`).
  - **FR.AK.05 (`src/lib/ak05/rollup.ts`):** Already neutral (`"-"`, `"Belum diputuskan"`, unchecked `☐`).
  - **04A / AK.07:** No separate blanko preview components exist in `src/components/`.

### Cacat 3 (Medium) — Misclassified `.pptx` in `Tugas DIT` (`portofolio`)
- **Confirmed Root Cause (`src/services/drive.ts:80-138`):**
  - `"DIT kelompok _1 IBPR.pptx"` (in `"Tugas DIT/WIWI"`) does not match rule `04b` at line 80 (`04b|ia04b|observasi demonstrasi|presentasi`), so evaluation falls through to line 113 (`/portofolio|ibpr|hiradc|\berp\b|work\s*permit|inspeksi|investigasi|.../i`), returning `portofolio` (0.85) before reaching the `tugas dit` / `\bdit\b` `.pptx -> 04b` rule at lines 131–138.
  - Other K3 presentation topics (e.g., `pelatihan`/`pembinaan` at line 126 or `hiradc`/`work permit`/`inspeksi` at line 113) would hit the same trap if saved as `.pptx` in `Tugas DIT`.
  - Scoping early `04b` matching specifically to **presentation extensions (`.pptx`/`.ppt`)** inside `Tugas DIT` or matching `\bdit\b` (after `materi`, `04a`, `04b`, `06a/06b/06c`, `09`, `apl01/02`, `ktp`) fixes `"DIT kelompok _1 IBPR.pptx"` without breaking `.pdf`/`.docx` portfolio files (`IBPR.pdf`, `Work Permit.docx`) inside candidate subfolders.
  - Duplicate `FR_IA_04A` files remain distinguishable via full `drivePath` already displayed in `src/app/(app)/batches/[id]/triage/page.tsx:208-210`.

### Cacat 4 (Medium) — Similarity Threshold Origin & Missing Source Attribution
- **Root Cause & History Explanation:**
  - `supabase/migrations/20261118000005_full_platform_schema.sql:409` seeded `app_config` (`scope = 'global'`, `lsp_id = null`) with `{"exact": 0.85, "near": 0.65, "partial": 0.45, "unconfirmed": true}`.
  - Commit `0047511` (`19:09 WIB`) initially coded `DEFAULT_SIMILARITY_THRESHOLDS` in `src/services/similarity.ts:1-5` as `{ exact: 0.9, near: 0.75, partial: 0.5 }`, then commit `992bbac` (`23:58 WIB`, in `HEAD 792027e`) aligned `DEFAULT_SIMILARITY_THRESHOLDS` to `{ exact: 0.85, near: 0.65, partial: 0.45 }`.
  - **Code Gap Found (`src/repositories/config.repository.ts:7-37`):** `findConfigValue("similarity.flag_thresholds", { lspId: batch.lspId })` filters strictly by `eq(lspId, batch.lspId)` and **does not fall back** to `scope = 'global'` when a tenant has no row in `app_config`, AND does not return config provenance (`scheme` vs `tenant` vs `global` vs `default`).
  - Neither `similarity/page.tsx`, `renderCombinedWrittenReportMarkdown`, nor `generateSimilarityReportDocx` currently labels the threshold source (`Konfigurasi Tenant`, `Konfigurasi Global`, or `Default Aplikasi`).

### Checklist P1 — Ingest Page Empty Log Area & Narrow Viewport
- **Ingest Page (`src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`):** Currently displays status/progress card and file count only, with no log list/section (nor `logs` column in `public.jobs`). Adding a dedicated log section showing job audit trail entries (or `"Belum ada log untuk job ini"` when empty) closes this P1 item cleanly.
- **Viewport ~390px:** `BlankoA4Sheet` wraps blankos in `overflow-x-auto`, and `app/(app)/layout.tsx` uses responsive stacking (`flex-col md:flex-row`). Needs live/local verification via `agent-browser` once approved.

---

## 3. Ordered Ticket Plan (Definition of Ready Applied)

> **Execution Gate:** Awaiting user approval + clarifying question confirmation before writing any application code. Every ticket runs `npm run typecheck && npm run lint && npm test` and records results in `docs/testing/feature-test-report.md`.

### Ticket T1 [AUDIT MODE] — Full Job Audit Lifecycle + Clickable Job Links (`Cacat 1` + `P1 Ingest Logs`)
- **Outcome:** Assessors/LSP Admins can trace every job lifecycle event (`created`, `started`, `completed`, `failed`, `rescan`/`retried`) in `/settings/audit` and click directly to `/batches/[batchId]/ingest/[jobId]`.
- **Files:** `src/worker/queue.ts`, `src/repositories/jobs.repository.ts`, `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`, `src/app/(app)/settings/audit/page.tsx`, `src/repositories/audit.repository.ts`, `src/repositories/batches.repository.ts` (batch/chunk drive_file upsert optimization if approved), plus unit tests.
- **Trust Boundary:** Authenticated LSP member / `lsp_admin` scoped strictly by `batch.lspId` / `lsp_id` (no cross-tenant leakage; `audit_log` stays append-only).
- **F-Section Target:** `docs/data-integrity.md`, `docs/testing/feature-test-report.md`.
- **Observable Acceptance Criteria:**
  1. Clicking `"Pindai Ulang Drive"` records job audit entries (`created`, `started`, `completed`/`failed`, `rescan`) with matching `Job ID`, `batchId`, actor, and event timestamp under the batch's `lsp_id`.
  2. Clicking a job `Resource ID` in `/settings/audit` navigates to `/batches/[batchId]/ingest/[jobId]`.
  3. `ingest/[jobId]/page.tsx` renders job log entries or `"Belum ada log untuk job ini"` when empty.

### Ticket T2 [AUDIT MODE] — Neutral Undecided State Across AK.02 & All Blanko Previews/DOCX (`Cacat 2`)
- **Outcome:** Zero affirmative or failing verdicts, checkmarks, strikethroughs, or fulfillment comments appear on official blankos before real assessor/AI decisions exist.
- **Files:** `src/lib/forms/assessee-forms.ts`, `src/components/forms/ak02-blanko-preview.tsx`, `src/components/forms/ia04b-blanko-preview.tsx`, `src/components/forms/ia06c-blanko-preview.tsx`, `src/services/export.ts`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/interview/page.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/interview/_components/interview-assessment-form.tsx`, plus unit tests in `src/services/__tests__/official-forms-export.test.ts`.
- **Trust Boundary:** Official BNSP certification records (`FR.AK.02`, `FR.IA.04B`, `FR.IA.06C`, `FR.IA.09`); must reflect persisted decisions only.
- **F-Section Target:** `docs/specs/00-product-scope.md`, `docs/testing/feature-test-report.md`.
- **Observable Acceptance Criteria:**
  1. For an undecided assessee: AK.02 shows `☐ Kompeten / ☐ Belum Kompeten` unchecked, status `"Belum diputuskan"`, and no `"Asesi memenuhi seluruh persyaratan..."` comment (both UI and DOCX).
  2. IA.04B leaves all 13 `Ya/Tidak` checkboxes unchecked, `"memenuhi / belum memenuhi"` unstruck, and `☐ Kompeten ☐ Belum Kompeten` unchecked until DIT/unit decisions exist.
  3. IA.06C leaves `"tercapai/belum tercapai"` unstruck until written grading exists.
  4. Once real K/BK decisions are saved, AK.02/IA.04B/IA.06C reflect them accurately.

### Ticket T3 [FAST MODE] — Fix Classifier Precedence for DIT `.pptx` With K3 Portfolio Topics (`Cacat 3`)
- **Outcome:** `.pptx`/`.ppt` presentations in `Tugas DIT` (or tagged `DIT`) like `"DIT kelompok _1 IBPR.pptx"` classify as `04b` rather than `portofolio`, while preserving `FR_IA_04A*.pptx` as `04a` and `.pdf`/`.docx` portfolios as `portofolio`.
- **Files:** `src/services/drive.ts`, `src/services/__tests__/drive.test.ts`.
- **Trust Boundary:** Pure deterministic filename/path classification; no external network or PII exposure.
- **F-Section Target:** `docs/testing/feature-test-report.md`.
- **Observable Acceptance Criteria:**
  1. `classifyDriveFileName("DIT kelompok _1 IBPR.pptx", ".../Tugas DIT/WIWI")` returns `docType: "04b"`.
  2. `FR_IA_04A_*.pptx` still returns `04a`; `IBPR.pdf` still returns `portofolio`.

### Ticket T4 [FAST MODE] — Hierarchical Config Resolution & Threshold Source Display (`Cacat 4`)
- **Outcome:** Similarity threshold lookup resolves `scheme -> tenant (lsp) -> global -> default` cleanly and displays the exact threshold source in UI, Markdown, and DOCX export.
- **Files:** `src/repositories/config.repository.ts`, `src/lib/config/get-config.ts`, `src/lib/similarity/load-batch-similarity.ts`, `src/services/similarity.ts`, `src/services/export.ts`, `src/app/(app)/batches/[id]/similarity/page.tsx`, `src/worker/index.ts`, `src/lib/similarity/__tests__/load-batch-similarity.test.ts`, `src/services/__tests__/export.test.ts`.
- **Trust Boundary:** Read-only config lookup scoped by RLS (`global` or member's `lsp_id`).
- **F-Section Target:** `docs/specs/00-product-scope.md`, `docs/testing/feature-test-report.md`.
- **Observable Acceptance Criteria:**
  1. UI on `/batches/[id]/similarity` and exported DOCX/Markdown explicitly show threshold source (e.g. `Sumber: Konfigurasi Global (app_config)` / `Konfigurasi Tenant (app_config)` / `Default Aplikasi`).
  2. Written explanation reconciles `0.85/0.65/0.45` (`000005` + `992bbac`+) vs `0.9/0.75/0.5` (`0047511`).

### Ticket T5 [FAST MODE] — `agent-browser` UI/UX & 390px Viewport Verification + Graphify & Docs Sync
- **Outcome:** Automated UI/UX & responsive (`390×844` and `1440×900`) verification via `agent-browser`, Graphify graph refresh (`python -m graphify update . --force`), and updated test/docs records.
- **F-Section Target:** `docs/testing/feature-test-report.md`, `graphify-out/`, `_documentations_/`.

---

## 4. Clarifying Questions Before Coding (`ground_rules_v5.md` §0.4)

1. **Live Production Check (`Cacat 1` & `Cacat 4`):** Do you approve running read-only diagnostic checks against Vercel (`vercel ls` / logs) and remote Supabase (`supabase migration list` / non-PII `audit_log` action-count check) to confirm why `792027e`'s `job.drive_scan.rescan` / `completed` did not show at 05:47 WIB and which commit is currently live on `assessor-zeta.vercel.app`?
2. **`agent-browser` Setup & Target URL:** Do you approve installing `agent-browser` (`npm i -g agent-browser` / `npx agent-browser`) to verify UI/UX and ~390px mobile viewports, and should we run it against local `http://localhost:3000` (with safe mock/dev auth) or against `https://assessor-zeta.vercel.app`?
3. **Partial Unit Decisions on AK.02 (`Cacat 2`):** When an assessee has *some* units decided `"K"` and remaining units still undecided (0 `"BK"`), should AK.02 remain `"Belum diputuskan"` until all scheme units are decided (recommended for strict blanko accuracy), or follow AK.05's current rule (`decided.length > 0 && bkUnits.length === 0` -> `"K"`)?
