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
| `batches (active_master_key_*)` | `version int` (`touch_row()`) | Explicit pointer `active_master_key_file_id` + server-side `validateMasterKey06bContent` | Prevents MUK blanko / encrypted files from auto-activating or outranking assessor working keys |
| `batch_roster_notes` | Append-only (`SELECT, INSERT` only) | Separate from `audit_log`; honest `source_kind` & `source_label` required | Preserves immutable system `audit_log` while recording retroactive/out-of-band roster notes |
| `assessees` (roster CRUD) | `version int` (`touch_row()`) | Reject stale version + prompt refresh; delete only if unconfirmed + zero linked files/decisions/gradings | Server-side optimistic check in `upsertAssesseesForBatch` / `updateAssesseeDisplayName` / delete guard |
| `jobs` (`drive_scan` & background jobs) | `status`, `attempts`, `updated_at` | `WORKER_MAX_EXECUTION_MS` (240s) hard abort + `reconcileStaleJob` (`STALE_RUNNING_MS = 305s`, `STALE_PENDING_MS = 60s`) -> terminal `failed` | `updateJobStatusRecord` wraps `getSupabaseServerClient()` in `try/catch` so `after()` cookie failures fall through to owner-scoped (`created_by`) admin update; `rescanBatchDriveAction` & `retryJobAction` re-verify `getUser()` + `requireLspRole()` |
