# F7 — Architecture & Consistency Model

- **Date:** 2026-11-19 (Updated after Round 11 Audit Remediation)
- **System:** AsesorKompetensi (v1.4)
- **Authority:** `ground_rules_v5.md` (§A.4 & §C.3)

---

## 1. Subsystem Consistency & Failure Modes

| Subsystem | CAP Priority | Failure Behavior | OLTP vs OLAP Path |
| :--- | :--- | :--- | :--- |
| **Auth & Tenancy (`lsps`, `lsp_memberships`)** | CP (Consistent) | Fails closed (`401`/`403`); no cached bypasses | OLTP via `runRepositoryDualPath` (`withRlsTransaction` / Supabase REST) |
| **Assessment Verdicts & AK.05 (`decisions`, `ak05_reports`)** | CP (Consistent) | Optimistic locking (`version`) + ACID transactions; assessee detail VATM UI uses live `computeVatmUnitRollup` as sole display truth | OLTP only |
| **Audit Trail (`audit_log`) & Roster Notes (`batch_roster_notes`)** | CP / Append-Only | DB trigger rejects UPDATE/DELETE on `audit_log`; `batch_roster_notes` grants only `SELECT, INSERT` for non-system/retroactive roster reconciliation notes with explicit source attribution; Drive roster merges/renames emit structured `batch.roster.reconciled` events | Write-only OLTP; read paginated |
| **Written Grading 06B Key Governance (`batches.active_master_key_*`)** | CP (Consistent) | Explicit active pointer on `batches`; MUK archive blankos/encrypted files are never auto-activated; `validateMasterKey06bContent` + `resolveBatchActiveMasterKey` enforce server-side validation across UI, Server Actions, and worker before grading can run | OLTP only |
| **Async Background Jobs (`jobs`, Drive scan, OCR)** | AP / Eventual | `updateJobStatusRecord` uses explicit 3-tier fallback (`withRlsTransaction` -> owner-scoped REST -> owner-scoped Service Role); `JobStatusPoller` polls every 3s while `pending`/`running` and triggers `router.refresh()` on terminal state; unextractable archives use dedicated `triage_status = 'unextractable'` | Asynchronous worker queue |
| **Scheme Units & DIT Inputs** | CP (Config-Driven) | `resolveUnitsForScheme` delegates to `resolveSchemeUnitsList` (`units -> kelompokPekerjaan -> fallback`); generic unit fallback explicitly flagged (`isGenericFallback`); `selectDitInputFiles` guarantees UI & worker parity | Server Components + API routes |

## 2. RPO / RTO Targets

- **RPO:** <= 1 hour (Supabase PITR + WAL archiving on Pro)
- **RTO:** <= 4 hours (Vercel instant rollback + Supabase restore)
