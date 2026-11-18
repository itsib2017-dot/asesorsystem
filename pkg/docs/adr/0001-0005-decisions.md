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
