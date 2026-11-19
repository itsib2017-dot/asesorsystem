# F9 — Data Integrity, Optimistic Locking & Concurrency

- **Date:** 2026-11-18
- **Authority:** `ground_rules_v5.md` (§Data Integrity)

---

## 1. Entity Locking & Conflict Strategy

| Entity | Locking Column | Strategy | Race Condition Mitigation |
| :--- | :--- | :--- | :--- |
| `lsps`, `schemes`, `batches`, `assessees` | `version int` (trigger `touch_row()`) | Reject stale version + prompt refresh | Server-side optimistic check |
| `decisions` (FR.AK.02) | `version int` | Unique constraint `(assessee_id, unit_code)` | Upsert per unit with audit trail; >=1 BK unit auto-resolves AK.02 & AK.05 to BK |
| `assessee_decision_overrides` | `version int` (`touch_row()`) | Unique constraint `(assessee_id)` | Authorized assessor/LSP-admin final call with mandatory audit reason (`>= 5` chars) |
| `ak05_reports` | `version int` | Terminal state lock once `submitted` | Only TUK/LSP return re-opens draft |
| `assessor_llm_config` | `updated_at` | Unique `(assessor_id, provider)` | Per-assessor RLS isolation |
| `signatures` | `is_active`, `superseded_by` | Append new version; never overwrite old | Past documents remain byte-identical |
