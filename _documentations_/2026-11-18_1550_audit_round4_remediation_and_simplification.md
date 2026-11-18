# Audit Round 4 Remediation, Codebase Simplification & Official Blanko Preservation

- **Timestamp:** 2026-11-18 15:50 WIB
- **Scope:** Response to external OODA Audit (`audit-lengkap-2026-11-18.md`, Rounds 1–4 + Scan Diagnostic) and direct Google Drive inspection (`ASESMEN (DONE)`, `SKEMA/1. AK3U`, `work_instructions_20250827.pdf`, and `WeekDemo`).

---

## 1. Root-Cause Findings Resolved

1. **Dual Drizzle/REST Latency & Invalid-UUID 500s (`src/db/index.ts`, repositories):**
   - `hasDatabaseUrl()` previously attempted direct Postgres TCP connections on Vercel whenever `DATABASE_URL` existed, stalling mutations for 10–20s and throwing unhandled `22P02 invalid input syntax for type uuid` on non-UUID routes like `/batches/does-not-exist`.
   - **Fix (Checkpoint 1, `844eb21`):** Gated `hasDatabaseUrl()` on `ENABLE_DIRECT_DB === "true"`, added `isUuid()` lookup guards across batch/assessee/job repositories so unknown IDs return `null` -> 404 (`notFound()`).
2. **Dead Code, Redundant RBAC & Unthrottled AI Routes:**
   - Consolidated `listUserMemberships` + `requireLspRole` into `resolveAuthorizedLsp` (`src/lib/auth/get-role.ts`).
   - Wired `checkRateLimit` (`20 req/min`) into `POST /api/v1/dit/[assesseeId]/analyse` and `POST /api/v1/jobs/enqueue`.
   - Removed unused npm packages (`@tanstack/react-query`, `framer-motion`) and unused Turnstile/Sentry keys in `src/lib/env.ts`.
3. **Round 4 `drive_scan` HTTP 403 & 0 Assessees (`src/services/drive.ts`, `src/worker/index.ts`):**
   - Live query on `public.jobs` proved Batch R4's scan failed with `"Drive API error: HTTP 403"`, and `handleDriveScanJob` lacked any `assessees` insert logic.
   - **Fix (Checkpoint 2, `8c13ec7`):** Added keyless public Drive crawler fallback (`crawlPublicDriveFolderEmbedded`) with bounded concurrency (6 subfolders in parallel), candidate name extraction (`inferCandidateNameFromDrivePath`), `upsertAssesseesForBatch`, `getLatestJobForBatch`, and surfaced scan status + error banner + **"Pindai Ulang Drive"** button directly on `batches/[id]/page.tsx`.
   - **Live Remote Result (`WeekDemo`):** Crawled **315 files**, discovered & populated **26 assessees**, and linked **315 `drive_files`** into Batch R4 (`f98e5671-fbcb-42cb-a724-9f69d24f780b`).
4. **FR.AK.05 Format Preservation, `Skema`/`TUK` Bugs & Missing Signature Image (`src/services/export.ts`, `ak05/`, `similarity/`):**
   - Verified against `ASESMEN (DONE)/ONLINE/03 Maret - Cendekia Azza Cemerlang - AK3U/` and `IK-LSP-AK-01` (*"Format file tidak boleh diubah"*).
   - **Fix (Checkpoint 3, `f1dd5cf`):** Resolved actual scheme code/name and `tukName` across `ak05/page.tsx`, `similarity/page.tsx`, `ak05-preview.tsx`, and `ak05/export/route.ts`. Updated `generateAk05Docx` to follow `FR.AK.05-2024` table layout (metadata table, `<w:strike/>` on unselected `TUK` types, 12-row minimum candidate table with `☑`/`☐`, signature table with `ImageRun`), and downloaded active signature bytes from Supabase Storage into both DOCX and PDF.
5. **Audit Log Completeness, Cache Revalidation & Safe BYOK Defaults (`9b7e18d`):**
   - Auto-resolved `lsp_id` in `writeAuditLog`, logged `batch.create` in `POST /api/v1/batches`, added `Aktor` column and non-overflow layout to `/settings/audit`, added `revalidatePath` + `router.refresh()` across settings actions/forms, and set safer Anthropic defaults (`claude-3-5-sonnet-20241022`, `temperature: 0.2`, `maxTokens: 8192`).

---

## 2. Verification Summary

- `npm run typecheck`: Passed (exit 0)
- `npx eslint . --ext .ts,.tsx --max-warnings 0`: Passed (exit 0, 0 warnings)
- `npm test`: Passed (13 test files, 38 tests)
- `npm run build`: Passed (exit 0)
- Live Supabase backfill & Drive sync (`sync_demo_batch_r4.ts`): 315 files, 26 assessees, 2 backfilled `audit_log` rows + 2 `batch.create` audit entries.
