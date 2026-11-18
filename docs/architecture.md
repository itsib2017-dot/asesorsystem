# F7 — Architecture & Consistency Model

- **Date:** 2026-11-18
- **System:** AsesorKompetensi (v1.4)
- **Authority:** `ground_rules_v5.md` (§A.4 & §C.3)

---

## 1. Subsystem Consistency & Failure Modes

| Subsystem | CAP Priority | Failure Behavior | OLTP vs OLAP Path |
| :--- | :--- | :--- | :--- |
| **Auth & Tenancy (`lsps`, `lsp_memberships`)** | CP (Consistent) | Fails closed (`401`/`403`); no cached bypasses | OLTP via `withRlsTransaction` |
| **Assessment Verdicts & AK.05 (`decisions`, `ak05_reports`)** | CP (Consistent) | Optimistic locking (`version`) + ACID transactions | OLTP only |
| **Audit Trail (`audit_log`)** | CP / Append-Only | DB trigger rejects UPDATE/DELETE; app write helper catches failures gracefully with correlation ID | Write-only OLTP; read paginated |
| **Async Background Jobs (`jobs`, Drive scan, OCR)** | AP / Eventual | Retries with exponential backoff; progress persisted per checkpoint | Asynchronous worker queue |

## 2. RPO / RTO Targets

- **RPO:** <= 1 hour (Supabase PITR + WAL archiving on Pro)
- **RTO:** <= 4 hours (Vercel instant rollback + Supabase restore)
