# Audit Remediation, Job Queue Activation & Modern Web Guidance Hardening

**Timestamp**: 2026-11-18 12:24 WIB  
**Scope**: Complete remediation of Points A–D from the independent code & live-site audit against `GoogleChrome/modern-web-guidance`, designed for **Vercel Hobby (Free Plan)** without sub-daily crons.

---

## 1. Point A — Worker Queue Activation & Vercel Hobby Inline Execution
- **Problem Identified**: `runWorkerJob` in `src/worker/index.ts` previously only handled `"hello"` and returned `{ status: "done", progress: 100 }` without executing real logic for `"drive_scan"`, `"extract_file"`, `"ocr_ktp"`, `"dit_analysis"`, `"written_grading"`, `"similarity_run"`, or `"ak05_export"`. Furthermore, `public.jobs` lacked an `UPDATE` RLS policy on Supabase despite having `GRANT UPDATE`.
- **Changes Made**:
  - Created migration [`supabase/migrations/20261118000006_jobs_update_policy.sql`](../supabase/migrations/20261118000006_jobs_update_policy.sql) and applied it to remote Supabase (`oiplhsmmfuqriaqrxjud`).
  - Added repository mutations & helpers with IPv4-safe `try/catch` Supabase REST fallbacks across [`src/repositories/jobs.repository.ts`](../src/repositories/jobs.repository.ts), [`src/repositories/batches.repository.ts`](../src/repositories/batches.repository.ts), [`src/repositories/assessees.repository.ts`](../src/repositories/assessees.repository.ts), and [`src/repositories/assessment.repository.ts`](../src/repositories/assessment.repository.ts).
  - Implemented all 7 job handlers in [`src/worker/index.ts`](../src/worker/index.ts) connecting `crawlPublicDriveFolder`, OOXML extractors (`extract.ts`), KTP Name Jury (`name-jury.ts`), DIT gap analysis (`dit.ts`), FR.IA.06 grading (`grading.ts`), pairwise similarity scoring (`similarity.ts`), and FR.AK.05 snapshot export (`ak05_reports`). Unknown job types fail loudly (`UNSUPPORTED_JOB_TYPE`).
  - Added `executeJob()` and `runImmediately = true` default execution in [`src/worker/queue.ts`](../src/worker/queue.ts) plus `POST /api/v1/jobs/[jobId]` in [`src/app/api/v1/jobs/[jobId]/route.ts`](../src/app/api/v1/jobs/[jobId]/route.ts), eliminating the need for sub-daily Vercel Cron jobs forbidden on the Free/Hobby plan.
  - Updated `POST /api/v1/batches` ([`src/app/api/v1/batches/route.ts`](../src/app/api/v1/batches/route.ts)) and `POST /api/v1/dit/[assesseeId]/analyse` ([`src/app/api/v1/dit/[assesseeId]/analyse/route.ts`](../src/app/api/v1/dit/[assesseeId]/analyse/route.ts)) to pass inputs cleanly and return executed job status.
  - Added unit tests in [`src/worker/__tests__/worker.test.ts`](../src/worker/__tests__/worker.test.ts).

## 2. Point B — CI Repair, Untracking Local State & README
- **Changes Made**:
  - Removed inherited harness workflows referencing nonexistent scripts (`.github/workflows/bundle.yml`, `openclaw-e2e.yml`, `tier2-e2e-smoke.yml`, `update-stats.yml`).
  - Replaced [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) with an `ubuntu-latest` Node 22 verification pipeline running `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
  - Added `supabase/.temp/` to [`.gitignore`](../.gitignore) and untracked existing CLI cache files via `git rm -r --cached supabase/.temp`.
  - Replaced boilerplate [`README.md`](../README.md) with accurate stack, architecture, security, and verification documentation.

## 3. Point C — RBAC Enforcement, Security Headers, Config-Driven Thresholds & Audit Repository
- **Changes Made**:
  - Added `requireLspRole` in [`src/lib/auth/get-role.ts`](../src/lib/auth/get-role.ts) with REST fallback in [`src/repositories/auth.repository.ts`](../src/repositories/auth.repository.ts).
  - Removed blind `?? memberships[0]` fallbacks in [`src/app/(app)/settings/schemes/actions.ts`](../src/app/(app)/settings/schemes/actions.ts) (enforcing `lsp_admin`) and [`src/app/api/v1/batches/route.ts`](../src/app/api/v1/batches/route.ts) (enforcing `lsp_admin | tuk_admin | assessor`).
  - Added configurable `NameJuryThresholds` (`"name_jury.thresholds"`) in [`src/lib/config/types.ts`](../src/lib/config/types.ts) and updated [`src/services/name-jury.ts`](../src/services/name-jury.ts).
  - Created [`src/repositories/audit.repository.ts`](../src/repositories/audit.repository.ts) and refactored [`src/lib/audit/write-audit-log.ts`](../src/lib/audit/write-audit-log.ts) to delegate DB writes to the repository layer.
  - Added `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy` headers in [`next.config.ts`](../next.config.ts).

## 4. Point D — Modern Web Guidance UX/Accessibility & Missing Screens
- **Changes Made**:
  - Updated [`src/app/(auth)/login/`](../src/app/(auth)/login/_components/login-form.tsx) & [`src/app/(auth)/register/`](../src/app/(auth)/register/_components/register-form.tsx): localized Indonesian Zod and HTML5 custom constraint messages, preserved `email`/`fullName` across failed submits using React state, added `role="alert"` / `aria-live="assertive"` on error containers, added eye toggle for password visibility, added `"Lupa password?"` link, and removed personal-looking placeholder strings.
  - Implemented `/forgot-password` ([`src/app/(auth)/forgot-password/page.tsx`](../src/app/(auth)/forgot-password/page.tsx)) with shared [`resolveSafeOrigin`](../src/lib/security/redirect.ts) and sliding-window rate limiting.
  - Updated [`src/proxy.ts`](../src/proxy.ts) and [`src/lib/supabase/middleware.ts`](../src/lib/supabase/middleware.ts) so `/forgot-password`, `/robots.txt`, and `/manifest.webmanifest` pass cleanly, and created [`src/app/robots.ts`](../src/app/robots.ts), [`src/app/manifest.ts`](../src/app/manifest.ts), and [`src/app/not-found.tsx`](../src/app/not-found.tsx).
  - Implemented Screen #5 [`src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`](../src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx), Admin LSP Audit Viewer [`src/app/(app)/settings/audit/page.tsx`](../src/app/(app)/settings/audit/page.tsx) (linked from [`src/app/(app)/settings/page.tsx`](../src/app/(app)/settings/page.tsx)), and `"Isi Contoh Skema AK3U"` preset button in [`src/app/(app)/settings/schemes/_components/scheme-registration-form.tsx`](../src/app/(app)/settings/schemes/_components/scheme-registration-form.tsx).

---

## Verification Evidence
- `npm run typecheck`: exit 0.
- `npx eslint . --ext .ts,.tsx --max-warnings 0`: exit 0.
- `npm test` (`vitest run`): 12 test files passed, 34/34 tests passed.
- `npm run build` (`next build`): exit 0, all 27 routes compiled cleanly alongside `/_not-found` and `Proxy (Middleware)`.
- `supabase db push --remote --yes`: applied `20261118000006_jobs_update_policy.sql`.
- `supabase db advisors --remote`: zero RLS/schema errors; only external dashboard info warning (`auth_leaked_password_protection`).
- **Live Vercel Production Check (Commit `8638a30` via headless browser on `https://assessor-zeta.vercel.app/`)**:
  - `GET /api/health` → HTTP 200 JSON (`status: "ok"`, `version: "v1.4"`).
  - `GET /login` → HTTP 200; `"Lupa password?"` link (`/forgot-password`) and `"Tampilkan password"` toggle button confirmed interactive; security response headers (`strict-transport-security`, `content-security-policy`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy`, `permissions-policy`) present on document response.
  - `GET /forgot-password` → HTTP 200 directly (no redirect to `/login`), renders `"Pemulihan Password"` form cleanly.
  - `GET /robots.txt` & `GET /manifest.webmanifest` → HTTP 200 directly without auth redirect.
- **Graphify & Obsidian Sync**: Updated `graphify-out/GRAPH_REPORT.md` (4854 nodes, 11219 edges, 243 communities) and `graphify-out/obsidian/` (5088 notes + `graph.canvas`).

