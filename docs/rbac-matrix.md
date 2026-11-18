# RBAC matrix (source of truth) — UNREVIEWED DRAFT
Scope: per LSP via `lsp_memberships`. A person may hold different roles in different LSPs. No UI-only permissions. No hidden accounts (ground rules §A.3).
Legend: R read · C create · U update · D delete · — none. "own" = assigned via `batch_assessors` / `assigned_assessor_id`.

| Resource | assessor | tuk_admin | lsp_admin | system_admin (break-glass) |
|---|---|---|---|---|
| lsps | R (member) | R | R | R; create via 2-person procedure |
| lsp_memberships | R self | R self | R/C/U/D others (not self) | only listed actions below |
| schemes + manifest | R | R | R/C/U | R |
| batches | R/U own; C (new, creator auto-assigned) | R/C/U all in LSP | R/C/U all | R |
| batch_assessors | R self | R/C/U/D | R/C/U/D | R |
| assessees | R/U own batch + assigned | R/C/U all in LSP | R/C/U all | R |
| app_config (lsp/scheme) | R | R | R/C/U | R |
| app_config (global) | R | R | R | via migration only |
| audit_log | — | — | R (own LSP) | R; **never** U/D |
| own signature | R/C/U | R/C/U | R/C/U | — |
| AK.05 submit/finalise | C (needs active signature) | — | — | — |
| Certification decision | — (AK.05 is a recommendation; LSP technical team decides) | — | — | — |

System admin (break-glass): reason required before session → audit + alert; 60 min, non-renewable; cannot delete audit, delete/hide itself, or self-grant. Any extra power vs lsp_admin must be listed here with a business reason: **none yet**.
Denials return a generic "not found/forbidden" with correlation ID; never reveal existence across LSPs.
