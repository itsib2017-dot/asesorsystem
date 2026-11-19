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
| **Append-Only Audit Log** | `src/lib/audit/__tests__/write-audit-log.test.ts` + `RLS-25` | `npm test` + remote SQL | PASS (DELETE rejected by trigger) |
| **06B Key Activation Audit** | `src/app/(app)/batches/[id]/actions.ts` (`batch.key_06b.activate`, `batch.key_06b.deactivate`, `batch.key_06b.activate.rejected`) | `npm test` + manual UI verify | PASS (activate/deactivate/reject all written to `audit_log` with actor, file, validation summary) |
| **06B Key Upload Audit** | `src/lib/written/master-key.ts` (`written.key_06b.upload`) | `npm test` + manual UI verify | PASS (upload with content validation written to `audit_log`) |
| **No Duplicate Job Audit Events** | `src/worker/queue.ts` (`executeJob` terminal-state guard) | `npm test` + manual UI verify | PASS (re-execution of done/failed jobs skipped unless explicit retry) |
| **Type Safety & Lint** | TypeScript strict + ESLint zero warnings | `npm run typecheck && npx eslint . --ext .ts,.tsx --max-warnings 0` | PASS (0 errors, 0 warnings) |
