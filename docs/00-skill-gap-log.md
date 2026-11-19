# Skill Gap & Tooling Bootstrap Log

- **Date / Timestamp:** 2026-11-18 09:06:00 +07:00
- **Mode:** ENTERPRISE AUDIT MODE (§0.2)
- **Authority:** `ground_rules_v5.md` (§A.7 & Step 0)
- **Supabase Target:** `oiplhsmmfuqriaqrxjud` (remote linked project)

---

## 1. Skill & Tool Status Table

| Skill / Tool | Required Priority (§A.7) | Status | Execution / Emulation Protocol |
| :--- | :--- | :--- | :--- |
| **Context7 MCP** | P0 (Must have) | **Active** | Lazy-loaded MCP server (`resolve-library-id`, `query-docs`) available. Query before proposing any new API or library pattern. |
| **Supabase CLI** | P0 (Must have) | **Active** | `supabase v3.2.0` installed. Linked to remote project `oiplhsmmfuqriaqrxjud`. Used with `--remote` flags. |
| **Local Docker Engine** | Infrastructure | **Emulated / Bypassed** | Docker is not running on host. Local `supabase db reset` bypassed in favor of remote Supabase CLI commands (`supabase db push --remote`, remote migration checks). |
| **Vitest / Integration Testing** | P0 (Must have) | **Active (Local Node)** | Vitest runs via Node.js `v24.22.1` for unit and database integration RLS tests. |
| **Playwright (E2E)** | P0 (Must have) | **Active (Local Node)** | Runs headfully/headless against preview/local App Router endpoints. |
| **Document Skill / Markdown** | P0 (Must have) | **Active** | Native toolset (`read_file`, `write_file`, `edit_file`) for cross-referencing and maintaining spec docs. |
| **Caveman** | P2 (Nice to have) | **Active** | Located in `.agents/skills/caveman/SKILL.md` for structured reasoning. |
| **TDD & Code-Review** | P1 (Should have) | **Active** | Located in `.agents/skills/tdd` and `.agents/skills/code-review`. Mandatory self-review gate on every ticket. |
| **Graphify** | P2 (Nice to have) | **Active** | Located in `.agents/skills/graphify/SKILL.md`. |
| **Sentry** | P1 (Should have) | **Emulated** | Emulated via structured JSON logging with correlation IDs (§C.2) until client SDK integration. |
| **Vercel CLI / Vercel Logs** | P1 (Should have) | **Emulated** | Emulated via local bundle size checks (`next build`) and CI check commands. |
| **gitleaks** | P2 (Nice to have) | **Emulated** | Emulated via pre-commit regex scanner blocking committed keys, `.env` files, and PII paths (`DATA ASESI/`, `*.pdf`, `*.jpg`). |

---

## 2. Incident record — Triage page regression (c9349ee)

- **Symptom:** `…/batches/[id]/triage` fails to load for all batches (R4 demo + `c61cf7c5` owner), showing `src/app/(app)/error.tsx` ("Halaman Tidak Dapat Dimuat"). Sidebar/session intact; batch page itself loads normally → isolated to triage server render.
- **Root cause (static):** c9349ee added a per-file render call `explainNameInference(f.drivePath)` (triage/page.tsx). A single bad `drivePath` value tripping the Next.js error boundary kills the whole page render.
- **Note on certainty:** `drive_path` is `text NOT NULL DEFAULT ''` in the DB and coerced to `''` in both repository mappers, so `.split("/")` cannot throw on null/undefined. The exact live throw could NOT be confirmed from Vercel function logs — `vercel` CLI is logged out and no credentials were requested (Vercel logs are emulated per §1 table below).
- **Fix:** `explainNameInference` guards non-string `drivePath` input; triage page wraps the per-row reason call in try/catch and renders a neutral `—` placeholder, so one bad row can never kill the whole page.
- **Verification:** `tsc --noEmit` clean; `eslint --max-warnings 0` clean; `vitest` 146/146 passed. Commit `c89324f` on branch `fix/triage-loader-regression`, pushed to origin (Vercel auto-deploys on push).
- **Still needed (P1):** Pull real Vercel function logs for the triage route to confirm the exact throw line and close out root-cause confirmation (auditor Putaran 15b).

## 3. Environment Architecture Adaptations

1. **Database Verification without Docker**:
   - Docker daemon is not active on this environment.
   - Migrations are verified and deployed directly against the linked remote project `oiplhsmmfuqriaqrxjud` using `supabase db push --remote` or remote migration listing.
   - Both `20261118000001_foundation.sql` and `20261118000002_hardening.sql` are confirmed applied on remote.
   - Any further schema fixes must be forward-only via `supabase/migrations/20261118000003_*.sql`.

2. **BYOK UI Architecture (User Mandate)**:
   - Dynamic configuration UI (`Provider Settings`) requested by user.
   - Supported providers: Anthropic (Claude), OpenAI-compatible, Gemini.
   - Fields: `API Key`, `Base URL (optional gateway)`, `ANTHROPIC_AUTH_TOKEN`, `Model`, `Temperature`, `Max tokens`, `Thinking budget`, `Google Drive API key`.
   - Security Boundary: Stored encrypted server-side per assessor or submitted per request. Never hardcoded in source code or committed to repository.
