# ADRs (Accepted 2026-11-18, by owner)

## ADR-0001 Repository & PII
- Context: docs originated in public `danste-kun/asesorkompetensi` which held assessee PII by filename.
- Decision: canonical repo is `itsib2017-dot/asesorsystem` (isolated). It contains code + docs only. Never commit assessee data, KTP, ijazah, keys. Old repo: make private; history is not cleaned by deleting files.
- Consequences: gitleaks + a path-deny CI check (`DATA ASESI/`, `*.pdf`, `*.jpg` outside `public/`).

## ADR-0002 Tenancy: multi-LSP, per-assessor perspective
- Decision: tenant = LSP. Shared DB/schema, `lsp_id` on every business row, RLS via `lsp_memberships`. One person (assessor) can belong to many LSPs with different roles; every scheme belongs to one LSP; schemes are config (manifest), never code (D17/D21). Assessors see only batches/assessees they are assigned to; `lsp_admin`/`tuk_admin` see their LSP.
- Active-LSP context is resolved server-side from membership; client never supplies tenant as trusted input.
- Consequences: composite FKs `(id, lsp_id)` prevent cross-LSP links; every table needs a two-LSP RLS test.

## ADR-0003 BYOK LLM keys (supersedes docs D18 storage clause)
- Decision: provider/base URL/model stay runtime config. API key is stored server-side, encrypted (AES-GCM, key from platform secret store), per assessor, decrypted only in server/worker memory, never sent to the browser after entry, never logged. No localStorage.
- Consequences: provider egress allow-list (SSRF), per-call timeout/spend cap.

## ADR-0004 Data access, worker, queue
- Decision: Drizzle via `src/repositories/` (Supabase client only for Auth/Storage). RLS enforced by setting JWT claims per transaction; repository also checks scope. Worker = Docker container (Tesseract ind+eng, Python msoffcrypto-tool) on Railway/Fly/VPS with pg-boss; overrides "no queue in Phase 1" for this product. Vercel hosts the web app only (Pro before first live batch). Bootstrapping an LSP/first admin = service-role script, 2-person approval, audited.

## ADR-0005 Privacy: local OCR only (owner decision)
- Decision: KTP images/text are processed **locally in the worker with Tesseract only**. KTP-derived data (name, NIK, address, OCR text, images) is **never sent to any LLM or third party**.
- Consequence for D10 "name jury": the match / mismatch_resolved / needs_human verdict is **deterministic** (normalisation + edit-distance/token comparison of OCR text vs APL.01 / surat tugas / ijazah fields), not LLM. Assessor confirms/overrides; KTP spelling stays authority (D6). LLM may receive only non-KTP content (e.g. DIT answers) with PII redacted. NIK masked in logs/UI by default.
- Open: OCR-confidence floor and comparison thresholds = config, calibrate on real samples.

## ADR-0006 SQL-Scoped Audit Log Cursor Pagination & 06B Rejection Audit Contract (2026-11-19)
- Context: In Round 13, (a) `listAuditLogsForUser` fetched `LIMIT N` rows before filtering cross-tenant `lsp_id IS NULL` entries in JavaScript and lacked a deterministic tie-breaker on `id`, and (b) non-activatable 06B blanko cards had no UI control to trigger and verify `batch.key_06b.activate.rejected` live.
- Decision:
  1. Push `(lsp_id = $lspId OR (lsp_id IS NULL AND actor_id IN (...tenantMembers)))` into the SQL query in both Drizzle and Supabase paths of `src/repositories/audit.repository.ts`, sort deterministically by `(created_at DESC, id DESC)`, add `beforeId` cursor pagination, and deduplicate by `id`.
  2. Never delete, rewrite, or backfill existing `public.audit_log` rows; expose `"Coba Aktifkan / Uji Validasi"` per non-active 06B card in `BatchKeyUploadPanel` and ensure `activateBatchMasterKey06bAction` writes `batch.key_06b.activate.rejected` on both failed text extraction (`encrypted_unreadable`) and failed content validation (`empty_or_blanko`).
- Consequences: Audit log pagination is deterministic without cross-tenant limit starvation, and blanko 06B rejection auditing is directly verifiable from the UI without uploading new files.
