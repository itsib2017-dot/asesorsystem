# F4 Companion — Row Level Security (RLS) Policy Table

- **Database:** Supabase PostgreSQL (`oiplhsmmfuqriaqrxjud`)
- **Verification Evidence:** `tests/rls-multi-lsp.test.sql` (37/37 PASS)
- **Report Reference:** `docs/testing/feature-test-report.md`

---

## 1. RLS Policy Inventory

| Table | Policy Name | Command | Roles | Policy Rule / Scope |
| :--- | :--- | :--- | :--- | :--- |
| `lsps` | `lsps_select` | SELECT | authenticated | `private.auth_is_member(id)` |
| `assessors` | `assessors_select` | SELECT | authenticated | Own profile (`id = auth.uid()`) OR visible to LSP Admin in same LSP |
| `assessors` | `assessors_update_self` | UPDATE | authenticated | Own profile only (`id = auth.uid()`) |
| `lsp_memberships` | `mem_select` | SELECT | authenticated | Self (`assessor_id = auth.uid()`) OR `lsp_admin` |
| `lsp_memberships` | `mem_insert` | INSERT | authenticated | `lsp_admin` only (cannot modify own role) |
| `lsp_memberships` | `mem_update` | UPDATE | authenticated | `lsp_admin` only |
| `lsp_memberships` | `mem_delete` | DELETE | authenticated | `lsp_admin` only |
| `schemes` | `schemes_select` | SELECT | authenticated | Member of LSP (`private.auth_is_member(lsp_id)`) |
| `schemes` | `schemes_insert/update/delete`| ALL | authenticated | `lsp_admin` of that LSP |
| `batches` | `batches_select` | SELECT | authenticated | `lsp_admin`, `tuk_admin`, or assessor assigned to batch (`private.auth_on_batch(id)`) |
| `batches` | `batches_insert` | INSERT | authenticated | Member with valid role AND `created_by = auth.uid()` |
| `batches` | `batches_update` | UPDATE | authenticated | `lsp_admin`, `tuk_admin`, or assessor assigned to batch |
| `batch_assessors` | `ba_select` | SELECT | authenticated | Self OR `lsp_admin`/`tuk_admin` of that LSP |
| `batch_assessors` | `ba_insert/update/delete` | ALL | authenticated | `lsp_admin` or `tuk_admin` |
| `assessees` | `assessees_select` | SELECT | authenticated | `lsp_admin`/`tuk_admin` OR assigned assessor on that batch |
| `assessees` | `assessees_delete` | DELETE | authenticated | `lsp_admin`/`tuk_admin` OR assigned assessor (`assigned_assessor_id = auth.uid()` and `auth_on_batch(batch_id)`) |
| `app_config` | `cfg_select` | SELECT | authenticated | Scope `global` OR member of LSP |
| `app_config` | `cfg_insert/update` | INSERT/UPDATE | authenticated | `lsp_admin` for non-global scopes |
| `audit_log` | `audit_select` | SELECT | authenticated | `lsp_admin` of that LSP |
| `audit_log` | `audit_insert` | INSERT | authenticated | `actor_id = auth.uid()` and member of LSP |
| `jobs` | `jobs_select` | SELECT | authenticated | `created_by = auth.uid()` |
| `jobs` | `jobs_insert` | INSERT | authenticated | `created_by = auth.uid()` |
| `assessor_llm_config`| `llm_config_select` | SELECT | authenticated | `assessor_id = auth.uid()` |
| `assessor_llm_config`| `llm_config_insert/update/delete` | INSERT/UPDATE/DELETE | authenticated | `assessor_id = auth.uid()` |
| `interview_assessments`| `ia09_select` | SELECT | authenticated | `lsp_admin`/`tuk_admin` of LSP OR assigned assessor (`auth_on_batch`) |
| `interview_assessments`| `ia09_insert` | INSERT | authenticated | `lsp_admin` OR assigned assessor (`auth_on_batch`) |
| `interview_assessments`| `ia09_update` | UPDATE | authenticated | `lsp_admin` OR assigned assessor (`auth_on_batch`) |
| `assessee_decision_overrides`| `ado_select` | SELECT | authenticated | `lsp_admin`/`tuk_admin` of LSP OR assigned assessor (`auth_on_batch`) |
| `assessee_decision_overrides`| `ado_insert` | INSERT | authenticated | `lsp_admin` OR assigned `assessor` on batch (`tuk_admin` blocked) |
| `assessee_decision_overrides`| `ado_update` | UPDATE | authenticated | `lsp_admin` OR assigned `assessor` on batch (`tuk_admin` blocked) |

---

## 2. Integrity Triggers

- `touch_row()`: Increments `version` and refreshes `updated_at` before update on business tables.
- `audit_immutable()`: Rejects `UPDATE`, `DELETE`, and `TRUNCATE` operations on `public.audit_log`.
