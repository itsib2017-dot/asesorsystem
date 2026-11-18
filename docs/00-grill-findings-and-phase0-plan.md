# Grill findings & Phase 0 plan — AsesorKompetensi
Date: 2026-11-18 · Inputs: docs.zip (v1.4, 16 files, ~950 KB) vs ground_rules_v5.md

## 1. Skill gap log (emulated, not installed)
Environment tools: file sandbox, web search/fetch only. **No network from sandbox → cannot `npm install`, cannot run tsc/eslint/vitest/playwright here.**
| Skill | Status | Emulation |
|---|---|---|
| Context7, Supabase, psql, Sentry, Vercel logs, gitleaks, Playwright | Not available | Manual checklists; every API verified against pinned versions in a real checkout |
| Caveman/Ponytail | Not available | Explicit step decomposition per ticket |
Consequence: nothing written here may be called "working" until run in Claude Code / local checkout (Rule 1).

## 2. Conflicts: docs v1.4 vs ground rules v5 (need user decision — do not silently pick)
| # | Docs say | Ground rules say | Proposed resolution |
|---|---|---|---|
| C1 | Repo `danste-kun/asesorkompetensi`, PUBLIC, holds assessee PII (KTP, ijazah) by filename | Never expose PII; UU PDP (§C.4) | **P0:** make repo private now; scrub history; this app must not read it as a data store (docs Rule 14). Which repo is canonical: `itsib2017-dot/asesorsystem`? |
| C2 | BYOK LLM key "stored locally in browser, sent per request" (D18) | No sensitive auth data in localStorage; secrets server-side | ADR: encrypted per-user key in server-side Vault/column (AES-GCM, managed key), never in browser storage, never logged. Keeps BYOK, drops browser storage. |
| C3 | `@supabase/supabase-js` for data; no ORM named | Drizzle through `src/repositories/`; Supabase client for Auth/Storage only | Follow ground rules. Note RLS + Drizzle: use per-request `set_config('request.jwt.claims')` in a transaction, or enforce in repository + RLS for Supabase paths. ADR needed. |
| C4 | Async worker (Drive scan, Tesseract OCR, msoffcrypto, pg-boss) on Railway/Fly/VPS | Vercel Phase 1; no queue in Phase 1 without ADR | Worker cannot run on Vercel. ADR: pg-boss + Docker worker (docs §7 decision). Overrides "no queue Phase 1" for this product. |
| C5 | Roles: assessor, lsp_admin, tuk_admin | God Admin removed; break-glass System Admin (§A.3) | Add `system_admin` break-glass only; write `docs/rbac-matrix.md`. |
| C6 | Dashboard V18: glassmorphism, gradient accents, hover lift (D20) | Anti-slop; max one accent treatment | Accept D20 as user decision; F8 must pick ONE treatment (glass cards), no decorative gradients, reduced-motion respected. |
| C7 | Vercel Hobby for preview; Pro before live | Hobby is non-commercial | Agree: Pro before first live batch. |
| C8 | Multi-tenancy: not stated; multi-scheme by manifest (D17) | §C.1 tenancy | Ask: one LSP only, or several LSPs? Drives `tenant_id`. |
| C9 | No hardcoded values (D21) | Rule 3 | Aligned. `app_config` + typed `getConfig`. |
| C10 | "AI recommends, assessor confirms" | §AI agent security | Aligned; LLM output validated by Zod; KTP/PII redacted from prompts unless approved processor (§C.4.5). |

## 3. Risks found
- **PII to third-party LLMs:** KTP/ijazah text sent to user-chosen providers = processor transfer under UU PDP. Needs consent + data-inventory entry + DPA per provider, or local-only OCR + redaction.
- **Drive scan on public links:** SSRF/allow-list (drive.google.com only), size/time limits, no URL fetch from user input beyond Drive API.
- **Uploaded .docx/.xlsx (macros, OLE-encrypted 06B):** untrusted files; parse in worker sandbox, no macro execution.
- **06B key password:** runtime only, never stored/logged (D12) — add test that it never reaches logs.
- **Similarity scores on people:** flags are recommendations; audit every override.
- **Scope:** 54 tables, 16 weeks. "Comprehensive" ≠ one session. Build by phase, gate each.

## 4. Phase 0 tickets (AUDIT MODE — auth/RBAC/schema/secrets)
| ID | Ticket | Exit proof |
|---|---|---|
| P0-1 | Repo init: Next.js App Router, TS strict + `noUncheckedIndexedAccess`, ESLint/Prettier, Vitest, Playwright, `docs/` copied in | `pnpm dev` runs; tsc/eslint clean |
| P0-2 | `.env.example` + typed env (Zod), no secrets committed, gitleaks in CI | CI fails on planted fake secret |
| P0-3 | Supabase migration 1: `assessors, batches, assessees, app_config, audit_log`; RLS on all | Two-user RLS test |
| P0-4 | Auth: Supabase Auth, server-side session check, roles table, rbac-matrix.md, safe denials | Role×action test matrix |
| P0-5 | `getConfig(key)` + seed keys (form_mapping.06, question_bank.count, scheme manifest) | No literal 13 in `src/` (grep test) |
| P0-6 | Audit log: append-only (no UPDATE/DELETE grants), written on login/role change | Test: UPDATE/DELETE rejected |
| P0-7 | pg-boss `jobs` skeleton + worker "hello" | Job completes e2e |
| P0-8 | Signature upload (private bucket, owner-only RLS, signed URLs, audited) | RLS + access-log test |
| P0-9 | CI: lint, tsc, unit, audit, gitleaks, preview deploy | Green PR |
| P0-10 | Docs: F2 spec, F4 schema+RLS, F8 design system, ADRs (C2, C3, C4, C6) | Files exist |

## 5. Questions blocking Phase 0 (Definition of Ready)
1. Canonical repo = `itsib2017-dot/asesorsystem`? Is `danste-kun/asesorkompetensi` yours/Moza's, and will it go private?
2. Single LSP or multi-tenant?
3. Approve ADRs C2 (server-side encrypted BYOK) and C4 (Docker worker + pg-boss)?
4. Supabase project created (region)? Provide env var NAMES only.
5. Do you accept sending KTP-derived data to user-chosen LLM providers (with consent), or redact/local-only?
6. Where will you run builds: Claude Code cloud session on this repo (recommended)?
