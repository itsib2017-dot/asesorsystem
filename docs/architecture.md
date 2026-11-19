# F7 — Architecture & Consistency Model

- **Date:** 2026-11-19 (Updated after Round 10 Audit Remediation)
- **System:** AsesorKompetensi (v1.4)
- **Authority:** `ground_rules_v5.md` (§A.4 & §C.3)

---

## 1. Subsystem Consistency & Failure Modes

| Subsystem | CAP Priority | Failure Behavior | OLTP vs OLAP Path |
| :--- | :--- | :--- | :--- |
| **Auth & Tenancy (`lsps`, `lsp_memberships`)** | CP (Consistent) | Fails closed (`401`/`403`); no cached bypasses | OLTP via `runRepositoryDualPath` (`withRlsTransaction` / Supabase REST) |
| **Assessment Verdicts & AK.05 (`decisions`, `ak05_reports`)** | CP (Consistent) | Optimistic locking (`version`) + ACID transactions; assessee detail VATM UI uses live `computeVatmUnitRollup` as sole display truth | OLTP only |
| **Audit Trail (`audit_log`)** | CP / Append-Only | DB trigger rejects UPDATE/DELETE; app write helper catches failures gracefully with correlation ID; Drive roster merges/renames emit structured `batch.roster.reconciled` events | Write-only OLTP; read paginated |
| **Async Background Jobs (`jobs`, Drive scan, OCR)** | AP / Eventual | `updateJobStatusRecord` uses explicit 3-tier fallback (`withRlsTransaction` -> owner-scoped REST -> owner-scoped Service Role); `JobStatusPoller` polls every 3s while `pending`/`running` and triggers `router.refresh()` on terminal state; unextractable archives use dedicated `triage_status = 'unextractable'` | Asynchronous worker queue |
| **Scheme Units & DIT Inputs** | CP (Config-Driven) | `resolveUnitsForScheme` delegates to `resolveSchemeUnitsList` (`units -> kelompokPekerjaan -> fallback`); generic unit fallback explicitly flagged (`isGenericFallback`); `selectDitInputFiles` guarantees UI & worker parity | Server Components + API routes |

## 2. RPO / RTO Targets

- **RPO:** <= 1 hour (Supabase PITR + WAL archiving on Pro)
- **RTO:** <= 4 hours (Vercel instant rollback + Supabase restore)
