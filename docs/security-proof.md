# F10 — Security Proof & Hardening Evidence

- **Date:** 2026-11-18
- **Authority:** `ground_rules_v5.md` (§Security Hardening & §A.4)

---

| Requirement | Proof / Test | Command | Observed Result |
| :--- | :--- | :--- | :--- |
| **Multi-Tenant & Role RLS** | `tests/rls-multi-lsp.test.sql` (31 scenarios) | `supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | 31/31 PASS (cross-LSP reads return 0) |
| **Supabase Advisors** | Database security & performance linter | `supabase db advisors --remote` | 0 issues found |
| **AES-256-GCM BYOK Crypto** | `src/lib/crypto/__tests__/encryption.test.ts` | `npm test` | 4/4 PASS (tamper & missing key rejected) |
| **PII / NIK Redaction** | `src/ai/__tests__/redact.test.ts` | `npm test` | 4/4 PASS (16-digit NIK & image URIs blocked) |
| **SSRF Protection** | `src/lib/security/__tests__/ssrf.test.ts` | `npm test` | 3/3 PASS (localhost, 169.254.x, private IPs blocked) |
| **Append-Only Audit Log** | `src/lib/audit/__tests__/write-audit-log.test.ts` + `RLS-25` | `npm test` + remote SQL | PASS (DELETE rejected by trigger) |
| **Type Safety & Lint** | TypeScript strict + ESLint zero warnings | `npm run typecheck && npx eslint . --ext .ts,.tsx --max-warnings 0` | PASS (0 errors, 0 warnings) |
