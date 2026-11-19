# F2/F5 — FR.IA.06B Per-File Validation Trigger & SQL-Scoped Audit Pagination

- **Date:** 2026-11-19
- **Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2)
- **Target Scope:** Round 13 Audit Remediation (`brief-developer-putaran-13-2026-11-19.md`)

---

## 1. Feature Spec (F2)

### User & Outcome
Assessors and LSP Admins reviewing a batch (`Demo Audit R4`) can test/attempt activation on any detected `FR.IA.06B` candidate file directly from the Batch Detail UI without uploading a new file, and LSP Admins reviewing `/settings/audit` see a deterministic, SQL-scoped, cursor-paginated append-only audit log with full `06B` validation rejection metrics.

### Scope In
- Per-file `"Coba Aktifkan / Uji Validasi"` control on non-active/blanko `06B` cards in `BatchKeyUploadPanel`.
- Unified rejection handling in `activateBatchMasterKey06bAction` covering both unextracted/encrypted archive blankos (`tryResolveCandidate06bText`) and empty/blanko/06A skeletons (`validateMasterKey06bContent`).
- Append-only audit log emission (`batch.key_06b.activate.rejected`) with `fileId`, `fileName`, `source`, `validationStatus`, `substantiveWords`, and `rejectionReason`.
- SQL-level tenant scoping for `lsp_id IS NULL` rows, deterministic `(created_at DESC, id DESC)` ordering, `beforeId` cursor pagination, and ID deduplication in `src/repositories/audit.repository.ts`.
- Cursor pagination (`beforeId`, `limit`) and rejection summary formatting in `/settings/audit`.

### Scope Out
- Modifying, deleting, or backfilling historical `public.audit_log` rows.
- Uploading a working `06B` key or running written grading on the demo batch.
- P0/P1 roadmap gaps (local Tesseract OCR, MFA, invite-only signup, missing roles, 12-char passwords).

### Trust Boundary & Data Model
- **Server Action (`activateBatchMasterKey06bAction`):** Requires authenticated session (`getUser()`), Zod UUID validation (`batchId`, `fileId`), sliding-window rate limit (`20/60s` per `userId:batchId`), batch tenant visibility (`getBatchById`), RBAC (`requireLspRole` allowing `lsp_admin` / `assessor`), and IDOR check (`file.batchId === batch.id && file.docType.toLowerCase() === "06b"`).
- **Audit Repository (`listAuditLogsForUser`, `listAuditLogsForResource`):** Enforces `lsp_id = $lspId OR (lsp_id IS NULL AND actor_id IN (...tenantMembers))` in SQL before `LIMIT`, ordered by `created_at DESC, id DESC`.
- **UI (`/settings/audit`):** Guarded by `resolveAuthorizedLsp(user.id, ["lsp_admin"])`.

### Observable Acceptance Criteria & Error States
1. Clicking `"Coba Aktifkan / Uji Validasi"` on a blanko/encrypted `06B` file card returns a visible error banner containing validation status, substantive word count, and rejection reason, plus a direct link to `/settings/audit`.
2. `/settings/audit` displays the new `batch.key_06b.activate.rejected` entry with actor, batch `resourceId`, `fileName`, `source`, `validationStatus`, `substantiveWords`, and `rejectionReason`.
3. Unauthorized roles (`tuk_admin`) and cross-batch `fileId` probes fail cleanly without writing an activation audit entry or leaking cross-tenant metadata.
4. `/settings/audit` orders entries deterministically (`created_at DESC, id DESC`), never drops rows due to cross-tenant `lsp_id IS NULL` entries inside the SQL window, deduplicates by `id`, and exposes `"Muat Entri Lebih Lama →"` / `"← Kembali ke Entri Terbaru"` cursor links.

---

## 2. Ticket Breakdown (F5)

| Ticket | Mode | Status | Files | Verification |
|---|---|---|---|---|
| **T0** | AUDIT | Done | Read-only SQL on `public.audit_log`, `public.jobs`, `public.batches` | Proved 42 total `audit_log` rows, contiguous `id` `14..19`, R3 job `82988849` predates Round 7 audit logging, 4 batches total (no R1/R2) |
| **T1** | AUDIT | Done | `src/repositories/audit.repository.ts`, `src/repositories/__tests__/audit.repository.test.ts` | Dual-path (`drizzle` + `supabase`) unit tests (`3/3`) |
| **T2** | AUDIT | Done | `src/worker/queue.ts`, `src/worker/__tests__/worker.test.ts` | Terminal `failed` job guard unit test (`13/13`) |
| **T3** | FAST | Done | `src/app/(app)/settings/audit/page.tsx`, `src/lib/audit/job-audit.ts`, `src/lib/audit/__tests__/write-audit-log.test.ts` | `formatAuditSummary` unit test (`6/6`), `tsc`, `next build` |
| **T4** | AUDIT | Done | `src/app/(app)/batches/[id]/actions.ts`, `src/app/(app)/batches/[id]/__tests__/actions.test.ts` | Encrypted/blanko reject + RBAC + IDOR + valid activate (`5/5`) |
| **T5** | FAST | Done | `src/components/batch/batch-key-upload-panel.tsx`, `src/app/(app)/batches/[id]/__tests__/actions.test.ts` | SSR render assertion (`data-testid="try-activate-06b-..."`) |
| **T6** | — | Done | `docs/testing/feature-test-report.md` | `tsc`, `eslint --max-warnings 0`, `vitest`, `next build`, remote RLS (`40/40`) |
| **T7** | — | Done | Scratch Playwright scripts (local `127.0.0.1:3199` + live `https://assessor-zeta.vercel.app`) | `15/15` checks at `1440x900` & `390x844` |
| **T8** | — | Done | `docs/`, `_documentations_/`, `graphify-out/`, `_backups_/` | Spec, ADR-0006, security proof, remediation report, checkpoint & push |
