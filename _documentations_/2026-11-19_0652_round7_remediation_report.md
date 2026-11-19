# Round 7 Audit Remediation Report — AsesorKompetensi

- **Timestamp:** `2026-11-19 06:52 WIB`
- **Target Repo:** `https://github.com/itsib2017-dot/asesorsystem` (Base commit: `792027e`)
- **Live Target Audited:** `https://assessor-zeta.vercel.app` (Tenant: `LSP-K3-ID2`, Batch `"Demo Audit R4"`, Scheme `AK3U`)
- **Database Project:** Supabase `oiplhsmmfuqriaqrxjud`

---

## 1. Executive Summary of Root Causes & Fixes

### Cacat 1 (High) — Job & Drive Rescan Audit Observability + Ingest Log View + Rescan Speed
- **Forensic DB Finding:** Job `b629abf7-84a2-4ece-b755-0ffe24ef841b` took **92.1s** (`22:46:03.901Z` → `22:47:36.039Z`) because `upsertDriveFilesForBatch` ran 315 sequential single-row HTTP updates. Events `id=34` (`job.drive_scan.completed`) and `id=35` (`job.drive_scan.rescan`) landed at `22:47:36-37Z` *after* the auditor reloaded `/settings/audit` at ~`22:46Z`, because `created`/`started` were never logged. Moreover, `rescanBatchDriveAction` logged `resource: "batches"` instead of `"jobs"`, `retryJobAction` logged nothing, `executeJob` omitted `lsp_id`, `/settings/audit` had no link handler for `resource === "jobs"`, and `ingest/[jobId]` lacked a log card.
- **Fixes Applied:**
  - `src/worker/queue.ts`: Added `resolveJobLspId` and `recordJobAuditEvent` covering `created`, `rescan`, `retried`, `started`, `completed`, and `failed` with explicit `lsp_id` and `resource: "jobs"`.
  - `src/lib/audit/job-audit.ts`: Added `resolveAuditResourceHref` routing `jobs` → `/batches/[batchId]/ingest/[jobId]` and `batches` → `/batches/[id]`.
  - `src/repositories/audit.repository.ts` & `src/app/(app)/settings/audit/page.tsx`: Added `listAuditLogsForResource`, `export const dynamic = "force-dynamic"`, clickable job links, and richer metadata summary formatting (`type`, `status`, `scannedFiles`, `attempts`, `batchId`, `error`).
  - `src/repositories/batches.repository.ts`: Replaced sequential 315-request loop in `upsertDriveFilesForBatch` (Supabase path) with chunked bulk `.insert` (100/chunk) + parallel chunked `.update` (concurrency 20), preserving `extracted_text`.
  - `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`: Wired `retryJobAction` with `triggerAction: "retry"`, `/settings/audit` revalidation, and added `"Log Eksekusi Job"` card with empty-state `"Belum ada log untuk job ini."`.
  - Pass-through `lspId`/`batchId` added in `written/actions.ts`, `api/v1/batches/route.ts`, and `api/v1/dit/[assesseeId]/analyse/route.ts`.

### Cacat 2 (High) — Neutral Unassessed Forms + Automatic BK Roll-Up + Authorized Manual Override
- **Assessor Rules Applied:**
  1. Zero unit decisions (`decision === "K" | "BK"`) → Undecided (`null` / `"-"` / `"Belum diputuskan"`) across **FR.AK.02**, **FR.AK.05**, **FR.IA.04B**, **FR.IA.06C**, and **FR.IA.09**. AI-only `ai_recommendation` rows (`decision = null`) no longer count as confirmed decisions or tick `"portofolio"` blindly.
  2. **Even 1 unit marked `"BK"`** immediately and automatically resolves BOTH **FR.AK.02** and **FR.AK.05** to **`"BK"`** (regardless of other `K` or undecided units).
  3. Partial `"K"` (zero `"BK"`, remaining scheme units undecided) remains **Undecided** (`"Belum diputuskan (X/Y unit K)"`) until all scheme units are decided.
  4. **Authorized Assessor / LSP Admin Manual Final-Call Override:** New table `public.assessee_decision_overrides` (migration `supabase/migrations/20261119000009_assessee_decision_overrides.sql`) allows `assessor` (assigned to batch) and `lsp_admin` — never `tuk_admin` — to override the final recommendation to `"K"` or `"BK"` with a mandatory audit reason (`>= 5` chars) or reset back to automatic roll-up.
- **Fixes Applied:**
  - `supabase/migrations/20261119000009_assessee_decision_overrides.sql`, `src/db/schema.ts`, `tests/rls-multi-lsp.test.sql` (`RLS-33..35`).
  - `src/lib/ak05/decision-rules.ts` (pure client-safe logic) & `src/lib/ak05/rollup.ts` (batch DB resolver + re-exports).
  - `src/repositories/assessment.repository.ts`: `getAssesseeDecisionOverride`, `listBatchDecisionOverrides`, `upsertAssesseeDecisionOverride` (graceful read fallback if `000009` unmigrated; strict write enforcement).
  - `src/lib/forms/assessee-forms.ts`, `src/services/export.ts`, `src/components/forms/ak02-blanko-preview.tsx`, `ia04b-blanko-preview.tsx`, `ia06c-blanko-preview.tsx`: Nullable `overallRecommendation`, `itemAchievedFlags`, and `overallAchieved`; zero checked boxes or strikethroughs when unassessed; neutral text instead of affirmative filler.
  - `src/app/(app)/batches/[id]/assessees/[assesseeId]/interview/page.tsx` & `interview/_components/interview-assessment-form.tsx`: Neutral `null` initial state; blocks saving until assessor explicitly picks overall + per-unit decisions.
  - `src/app/(app)/batches/[id]/assessees/[assesseeId]/actions.ts`, `_components/overall-decision-override.tsx`, `page.tsx`, `dit/page.tsx`, `ak05/page.tsx`, `export/route.ts`, `ak05/export/route.ts`, `src/worker/index.ts`.

### Cacat 3 (Medium) — Classifier Precedence on `.pptx` DIT Presentations (`DIT kelompok _1 IBPR.pptx`)
- **Root Cause:** `portofolio` rule (`/ibpr|hiradc|erp|.../i`) executed before the `Tugas DIT` / `\bdit\b` `.pptx` fallback rule, misclassifying `"DIT kelompok _1 IBPR.pptx"` under `"Tugas DIT/WIWI"` as `portofolio`.
- **Fix Applied:** In `src/services/drive.ts` (`classifyDriveFileName`), `.ppt`/`.pptx` files inside `Tugas DIT` or carrying token `\bdit\b` now classify as `"04b"` (confidence `0.88`) right after `04a`/`04b`/`06*`/`09` and before `portofolio`/`sertifikat_pelatihan`, while non-PPT topic files like `IBPR_Area_Produksi.pdf` continue classifying as `portofolio`. Added regression tests in `src/services/__tests__/drive.test.ts`.

### Cacat 4 (Medium) — Written Explanation of Threshold Origin (`0.85/0.65/0.45`) & Hierarchical Provenance Display
- **Exact Root Cause Explanation (Code vs Live Supabase):**
  1. In remote Supabase `public.app_config`, the seeded global row `similarity.flag_thresholds` (`scope='global'`, `lsp_id=NULL`) already holds `{"exact": 0.85, "near": 0.65, "partial": 0.45, "unconfirmed": true}`.
  2. In commit `0047511` (`DEFAULT_SIMILARITY_THRESHOLDS` was `0.9/0.75/0.5`), commit `992bbac` already updated `DEFAULT_SIMILARITY_THRESHOLDS` to `0.85/0.65/0.45`. However, `findConfigValue("similarity.flag_thresholds", { lspId })` previously applied `.eq("lsp_id", options.lspId)` with NO fallback to `scope='global'`, silently returning `null`!
- **Fixes Applied:**
  - `src/lib/config/types.ts`, `src/repositories/config.repository.ts`, `src/lib/config/get-config.ts`: Added `findConfigWithSource` & `getConfigWithSource` resolving hierarchically `scheme -> lsp -> global -> default` and returning human-readable provenance (`Konfigurasi Skema (app_config)`, `Konfigurasi Tenant (app_config)`, `Konfigurasi Global (app_config)`, `Default Aplikasi`).
  - Surfaced `thresholdSourceLabel` across `src/lib/similarity/load-batch-similarity.ts`, `src/app/(app)/batches/[id]/similarity/page.tsx`, `src/services/similarity.ts`, `src/services/export.ts`, and `src/app/api/v1/batches/[id]/similarity/export/route.ts`, plus `handleSimilarityRunJob` in `src/worker/index.ts`.

---

## 2. Verification Summary

| Verification Gate | Result |
| :--- | :--- |
| `npm run typecheck` (`tsc --noEmit`) | **PASS (0 errors)** |
| `npm run lint` (`eslint`) | **PASS (0 warnings)** |
| `npm test` (`vitest run`) | **PASS (23 files, 83/83 tests)** |
| `npm run build` (`next build`) | **PASS (36 routes incl. `Proxy (Middleware)`)** |
| `agent-browser` on `https://assessor-zeta.vercel.app` (`/login`, `/register`, `/batches/...` fail-closed) | **PASS (`1440x900` & `390x844`, `overflow: false`, 0 console/page errors)** |
| `supabase db push --remote --yes` + `tests/rls-multi-lsp.test.sql` | **PASS — Migration `000009` applied; `RLS-01`..`RLS-35` (`35/35 PASS`, `0 FAIL`)** |

---

## 3. Rollout Execution Log

1. Applied migration `20261119000009_assessee_decision_overrides.sql` to remote Supabase (`oiplhsmmfuqriaqrxjud`) and verified `35/35` RLS assertions pass.
2. Checkpoint backup created in `_backups_/2026-11-19_0710_round7_verified` (excluding `node_modules`, `.next`, `.git`, `_backups_`, `.env*`).
3. Pushed to `origin/main` to trigger Vercel GitHub deployment on `https://assessor-zeta.vercel.app`.
