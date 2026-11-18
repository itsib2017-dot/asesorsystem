Repo: itsib2017-dot/asesorsystem (main). Read first, in order: ground_rules_v5.md (authoritative), docs/adr/0001-0005-decisions.md, docs/rbac-matrix.md, docs/01..15 (build spec), supabase/migrations/20261118000001_foundation.sql.
Supabase project ref: oiplhsmmfuqriaqrxjud (env var NAMES only; values stay in Vercel/Supabase secret stores, never in git).
Mode: AUDIT MODE. Do Phase 0 tickets P0-1..P0-10 (docs/00-grill-findings-and-phase0-plan.md) one at a time, minimal diffs.
Step 1: run bootstrap; log gaps in docs/00-skill-gap-log.md. Step 2: verify the migration with `supabase db reset` and write RLS tests with TWO LSPs and three roles (cross-LSP read must return empty, not error). Fix the migration via a NEW migration if already applied.
Do not push; show me the test report first.
