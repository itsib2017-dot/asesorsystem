# F11 — Caching & Scaling Decisions

- **Date:** 2026-11-18
- **Authority:** `ground_rules_v5.md` (§Caching & Backend Scaling)

---

| Layer | Decision | Trigger / Rationale |
| :--- | :--- | :--- |
| **Next.js App Router SSR** | Use now | Auth-gated dynamic pages (`force-dynamic` avoided in favor of Next 16 request cookies). |
| **TanStack Query** | Use now | Installed for client state polling of long async job progress (`3s` interval). |
| **Redis / Upstash** | Use later | Trigger: when concurrent batch jobs or rate-limit counters exceed single-region Postgres throughput (`p95 > 500ms`). |
| **Message Queue (pg-boss / Postgres `jobs`)** | Use now | ADR-0004 approved: Drive scan, Tesseract OCR, grading, similarity, and export run async via `public.jobs`. |
| **CDN / Edge Cache** | Assets only | Authenticated assessor routes and PII never cached at edge. |
| **Roster / triage list cache** | Use now (TanStack Query) | `staleTime` per query type; invalidated on roster mutation (`batch.roster.*`). Never cache permissioned data in shared cache. |
