# F10 — Security Proof & Hardening Evidence

- **Date:** 2026-11-19
- **Authority:** `ground_rules_v5.md` (§Security Hardening & §A.4)

---

| Requirement | Proof / Test | Command | Observed Result |
| :--- | :--- | :--- | :--- |
| **Multi-Tenant & Role RLS** | `tests/rls-multi-lsp.test.sql` (40 scenarios) | `supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | 40/40 PASS (cross-LSP reads return 0; `unextractable` status & `batch_roster_notes` isolation verified) |
| **06B Blanko & Encryption Gate** | `src/lib/written/__tests__/master-key.test.ts` + `src/worker/__tests__/worker.test.ts` | `npm test` | PASS (BNSP blankos, `06A` question sheets, and unactivated MUK archive files rejected across UI, Server Actions, and worker) |
| **Supabase Advisors** | Database security & performance linter | `supabase db advisors --remote` | 0 issues found |
| **AES-256-GCM BYOK Crypto** | `src/lib/crypto/__tests__/encryption.test.ts` | `npm test` | 4/4 PASS (tamper & missing key rejected) |
| **PII / NIK Redaction** | `src/ai/__tests__/redact.test.ts` | `npm test` | 4/4 PASS (16-digit NIK & image URIs blocked) |
| **SSRF Protection** | `src/lib/security/__tests__/ssrf.test.ts` | `npm test` | 3/3 PASS (localhost, 169.254.x, private IPs blocked) |
| **Append-Only Audit Log** | `src/lib/audit/__tests__/write-audit-log.test.ts` + `src/repositories/__tests__/audit.repository.test.ts` + `RLS-25` | `npm test` + remote SQL | PASS (DELETE rejected by trigger; Drizzle + Supabase SQL-level `lsp_id IS NULL` actor scoping, deterministic `created_at DESC, id DESC`, `beforeId` cursor, `listAuditLogsForResource`, ID deduplication — 3/3 + 6/6) |
| **06B Key Activation Audit** | `src/app/(app)/batches/[id]/actions.ts` (`batch.key_06b.activate`, `batch.key_06b.deactivate`, `batch.key_06b.activate.rejected`) + `src/app/(app)/batches/[id]/__tests__/actions.test.ts` | `npm test` | 5/5 PASS (encrypted archive & blanko 06B rejection audited, RBAC/IDOR enforced, rate-limited `20/60s`, UI validation button rendered) |
| **06B Key Upload Audit** | `src/lib/written/master-key.ts` (`written.key_06b.upload`) | `npm test` | PASS (upload with content validation written to `audit_log`) |
| **No Duplicate Job Audit Events** | `src/worker/queue.ts` (`executeJob` terminal-state guard) + `src/worker/__tests__/worker.test.ts` | `npm test` | 13/13 PASS (re-execution of terminal `done`/`failed` jobs skipped unless explicit `triggerAction: "retry"`) |
| **Type Safety & Lint** | TypeScript strict + ESLint zero warnings | `npx tsc --noEmit && npx eslint . --max-warnings 0` | PASS (0 errors, 0 warnings) |
| **Fail-Closed Auth & Mobile Viewport** | Playwright headless against `next start -p 3199` & live `https://assessor-zeta.vercel.app` (`1440x900` & `390x844`) | `verify_ui_playwright.py` & `verify_live_playwright.py` | 15/15 local + 15/15 live PASS (`0` overflow, `0` console/page/5xx errors, `/dashboard`, `/batches/...`, `/settings/audit` redirect to `/login`) |
