# Startup Stack Confirmation & Environment Audit

- **Date / Timestamp:** 2026-11-18 08:58:00 +07:00
- **Mode:** ENTERPRISE AUDIT MODE
- **Context:** Project Kickoff based on `CLAUDE_CODE_KICKOFF.md`, `ground_rules_v5.md`, `docs/adr/0001-0005-decisions.md`, and `docs/00-grill-findings-and-phase0-plan.md`.

---

## 1. Confirmed Project Stack

| Layer | Locked Choice (ground_rules_v5.md / ADRs) | Current Repo Status |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router only), TypeScript strict | `next: 16.4.6` installed |
| **Runtime & Libs** | React 19, Node.js `v24.22.1`, npm `11.17.0` | `react: 19.3.0`, `react-dom: 19.3.0` |
| **Styling** | Tailwind CSS v4, shadcn/ui + Radix design tokens | `tailwindcss: 4.3.3`, `@tailwindcss/turbopack` installed |
| **Database** | PostgreSQL via Supabase (Project: `oiplhsmmfuqriaqrxjud`) | Supabase CLI `v3.2.0` present |
| **ORM / Data Access** | Drizzle ORM through `src/repositories/` only | Pending installation / setup in Phase 0 |
| **Validation** | Zod (server-side for actions, routes, forms, webhooks) | Pending installation |
| **Auth & Tenancy** | Supabase Auth (server-side session verification) + Multi-LSP (`lsp_id` per business row) | `supabase/migrations/20261118000001_foundation.sql` present |
| **State** | Server: TanStack Query; Client: React state / Zustand (no Redux/RTK) | Pending installation |
| **Testing** | Vitest (unit/integration) + Playwright (E2E) | Pending configuration in P0-1 |
| **Worker / Queue** | Docker worker (Tesseract OCR ind+eng, msoffcrypto, pg-boss) | ADR-0004 approved; Docker Desktop installed on host |

---

## 2. Environment Configuration & Missing Variables

### Current State:
`.env.example` and `.env.local` contain only:
```env
NEXT_PUBLIC_APP_NAME="webapps_asesor"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### Missing Environment Config / Variables Required (Names Only):
1. **Supabase Core (Project Ref: `oiplhsmmfuqriaqrxjud`):**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Server/worker only, strictly never exposed client-side)
   - `DATABASE_URL` / `DIRECT_URL` (Postgres connection strings for migrations & Drizzle repository pool)
2. **Security & Cryptography (ADR-0003 BYOK LLM Keys):**
   - `BYOK_ENCRYPTION_SECRET` (AES-256-GCM master key from platform secret store)
3. **Anti-Bot & Abuse (Anti-Bot §1-6):**
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `TURNSTILE_SECRET_KEY`
4. **Observability & Monitoring (Enterprise Rules §C.2):**
   - `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`

---

## 3. Skill & Tooling Audit (Step 0 / Step 1)

| Tool / Skill | Availability in Environment | Action / Emulation Strategy |
| :--- | :--- | :--- |
| **Context7 MCP** | Available (lazy-loaded MCP server `context7`) | Active for Next.js, Supabase, Drizzle, Zod doc lookups |
| **Supabase CLI** | Available (`supabase v3.2.0` on PATH) | Direct migration execution and local/remote schema operations |
| **Docker Engine** | Docker installed; Desktop service stopped | Required for local `supabase db reset` (or connect to remote project) |
| **Caveman** | Available in `.agents/skills/caveman` | Explicit reasoning structure |
| **TDD & Code-Review**| Available in `.agents/skills/` | Enforced on every patch |
| **Sentry / Vercel Logs**| Not connected via CLI | Emulate via structured logging and standard CI gates |
| **gitleaks** | Missing CLI binary | Emulate with regex secret check script in CI / pre-commit |

---

## 4. Immediate Next Steps (Pending User Approval)

1. **Ticket P0-1**: Initialize foundation tooling (Vitest, Zod, typed env configuration with runtime schema validation).
2. **Step 1**: Write and commit `docs/00-skill-gap-log.md` detailing all active vs emulated tool capabilities.
3. **Step 2**: Verify `supabase/migrations/20261118000001_foundation.sql` via `supabase db reset` (or remote dev instance), then write Vitest/pg TAP integration RLS tests validating:
   - Two distinct LSPs (LSP-A, LSP-B).
   - Three roles (`assessor`, `lsp_admin`, `tuk_admin`).
   - Cross-LSP query isolation: cross-tenant reads return empty sets (`[]`), never errors.
