# 14 — Feature Breakdown: Authentication, Email, OTP, Roles & Audit

| Field | Value |
|---|---|
| Version | v1.4 — 2026-11-18 |
| Product | AsesorKompetensi |
| Depends on | `01-project-overview.md`, `02-prd.md` (FR-25, NFR-04), `03-brd.md` (BR-09, BR-16), `research/tech-stack-brief.md` (§5.3) |
| Stack | Next.js App Router + TypeScript, Supabase Auth (GoTrue) + Postgres RLS, Supabase Storage |
| Changelog v1.4 | No hardcoded values at all — config-based throughout (D21, §1 principle 12, top-level canonical rule); multi-scheme manifest (D17, §17 — file set, question counts, rules, prerequisites, requirements per scheme; AK3U is one manifest); Provider Settings BYOK (D18, §18 — keys runtime-only, never env); AI judges the roll-up, VATM-based (D16 — replaces the v1.3 assessor-judgement default, §1 principle 10, FB-27); no "Kompeten Bersyarat" (D15, OQ-03 closed); official 04B form (D14); short per-batch intake (D13); numeric similarity thresholds + details (D19). Checklist extended (FB-29–FB-32, §15). Open questions OQ-A10–OQ-A12 added (§16). |
| Changelog v1.3 | Certificate-name rule decided (D6 — KTP is the authority, §1 principle 10, §13); pass-mark shape decided (D7 — per-question verdicts + Ringkasan Kesalahan, no overall %; roll-up default assessor judgement per KUK, OQ-04 stays open); 06B key structure + PASSWORD xlsx handling (D12, §11). Checklist extended (FB-26–FB-28, §15). |
| Changelog v1.2 | New sections: name jury + KTP OCR (§13), assessor signature (§14). Principles 10–11 added (§1). Signature required before AK.05 finalise (§2, §5.1). Checklist extended (FB-20–FB-25, §15). Open questions OQ-A7–OQ-A9 added (§16). |
| Changelog v1.1 | New sections: prompt registry + versioning (§9), completeness gate (§10), encrypted-06B handling (§11), model answers + triage (§12). MFA wording fixed — no finance roles in this system; a stale cross-project reference in §5.3 is removed. Checklist extended (FB-15–FB-19). |

> **Scope note.** This document covers auth and auth-adjacent features only: email validation, password handling, OTP/auth flows, MFA, roles, sessions, and the audit log. It does not cover the assessment pipelines (see PRD) or the database schema (see doc 04).

---

## 1. Principles

1. **Do not roll your own crypto.** Supabase Auth (GoTrue) handles password hashing, token signing, and session management. The application never sees, stores, or hashes a plaintext password itself.
2. **Auth is server-side.** All auth checks run in Next.js Server Components / Route Handlers / Server Actions using the Supabase SSR client. Client components never make auth decisions.
3. **Authorisation is enforced in the database, not only in the UI.** Every table has Row Level Security (RLS) policies keyed to the authenticated user's role and batch assignment. Hiding a button is UX; RLS is security.
4. **Assessors and admins are high-value accounts.** They can change grades, confirm certificate names, and export personal data. MFA is required for them (see §5).
5. **Candidates are not users in v1.** No candidate login, no candidate password, no candidate OTP. Candidate data enters via Drive/Sheet ingest and assessor upload.
6. **Every auth event is logged.** Sign-in, sign-out, failed attempts, password reset, MFA enrolment, role changes, and every access to KTP material go to the audit log (§8).
7. **Assessment instruments are versioned, not edited in place (v1.1).** A prompt version, once used in a grading or analysis run, is immutable. A change creates a new version (§9).
8. **No analysis runs on incomplete inputs (v1.1).** The completeness gate (§10) refuses the run and names what is missing.
9. **Model answers are assessor-only (v1.1).** They are shown to assessor roles with a label, never to candidates, and the system never drafts a candidate's answers (§12).
10. **The name jury recommends; the assessor confirms (v1.2, D10).** The jury's verdict on a certificate name is a recommendation with reasoning + evidence + OCR confidence. It becomes the certificate name only on assessor confirmation or override — never silently, and never from a low-confidence OCR (§13). **v1.3 (D6 decided):** The KTP (government ID) is the authority: the certificate name is the KTP name, verbatim. Surat tugas, APL.01, and ijazah are compared against the KTP, and any discrepancy resolves to the KTP spelling — surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean".
11. **A signature belongs to one assessor and is applied only at sign-off (v1.2, D11).** An assessor's uploaded signature is applied to a document only when that assessor signs off / finalises it, never to a draft, and never to another assessor's document. No active signature → sign-off is blocked (§14).
12. **No hardcoded values at all — config-based throughout (v1.4, D21, top-level canonical rule).** Every value that varies by scheme, org, or deployment comes from config: scheme names and file manifests, question counts (never a literal 13 in code — 13 is only the AK3U manifest's value), decision/assessment rules, thresholds, prerequisites, requirements, roles, export formats, providers, models, temperatures, and UI labels that vary by scheme/org. Even a fallback is a config value, never a code constant. Any literal AK3U value presented as the system default is a defect.
13. **Multi-scheme by default — the scheme manifest (v1.4, D17).** AK3U is one manifest, not the product. Each scheme registers its own manifest (§17): its file set, its question counts, its decision/assessment rules reference, its prerequisites, and its registration requirements. No feature assumes 13 questions, AK3U's file names, or AK3U's entry requirements unless the active scheme is AK3U.
14. **The AI provider is the user's choice, free-first (v1.4, D18).** Provider + base URL/gateway + model + key are runtime settings the user supplies (§18) — Anthropic, OpenAI-compatible, Gemini, OpenRouter / OmniRouter / 9Router, Nvidia NIM, and others; free tiers usable. Keys are stored locally in the browser, sent per request, never logged, never committed, never in env files. No provider or model is hard-coded anywhere.

## 2. Roles

| Role | Who | Capabilities | Data visibility |
|---|---|---|---|
| `assessor` | BNSP assessor with No. Reg (MET) | Own batches: ingest, classify, review completeness/identity, run AI analysis, grade, decide FR.AK.02, generate own FR.AK.05 | Only candidates in batches they are assigned to; only their own AI runs and drafts until confirmed |
| `ketua_tim` | Lead assessor for a batch | All `assessor` powers, plus: consolidate assessors' AK.05 reports for the batch, resolve cross-assessor inconsistencies, record the handoff to TUK/LSP, **assign triaged files/assessees to assessors (§12)** | All candidates in batches where they are Ketua Tim; read-only view of other assessors' drafts in that batch |
| `lsp_admin` | LSP staff (Manager Sertifikasi office) | Create/edit schemes **including their manifests (§17)**, batches, assignments, form-version mappings, thresholds, retention policy; manage users and roles; receive the AK.05 pack; **assign triaged files/assessees (§12); accept/return submitted AK.05 reports** | All batches for their LSP; cannot grade or change an assessor's verdict (enforced by RLS + application rule) |
| `tuk_viewer` | TUK representative | Read-only view of batches at their TUK and the submitted AK.05 pack | Only their TUK's batches; no KTP/NIK detail beyond what the AK.05 pack contains; no export of raw personal data |
| `auditor` | Read-only auditor (surveillance audit) | Read-only access to audit logs, prompt/model versions, AI runs, and exports | All batches (read-only); KTP/NIK material only via audit-logged access, never bulk export |
| `super_admin` | System operator (Moza / maintainer) | User/role management across LSPs, system config, incident response | All data, but every access is audit-logged; not used for assessment work |

**Rules:**
- A user has exactly one primary role; batch assignment is separate (a user can be `assessor` on one batch and `ketua_tim` on another).
- Role changes require `lsp_admin` or `super_admin` and are audit-logged with actor, previous role, new role, and reason.
- An assessor's No. Reg (MET) is stored on their profile and printed on FR.AK.02/AK.05. It is required before the assessor can finalise an AK.05.
- **v1.2 — signature required before finalise (D11):** an assessor must have an active uploaded signature before they can sign off / finalise any document that carries an assessor signature block. The profile-completeness check at sign-in / onboarding includes the signature (see §5.1): a profile without a signature can still work a batch, but every sign-off action is blocked with the named blocker until the signature is uploaded. A signature is never shared between assessors and never applied by an admin on an assessor's behalf.
- **Conflict of interest (future):** an assessor must not assess their own relatives/employees. The check is a later phase (F-22); the exact rule text is UNCONFIRMED. The role model already supports blocking an assignment; the rule itself is not enforced in v1.

## 3. Email validation

### 3.1 What "email validation" means here

Three distinct things, not to be conflated:

| # | Check | When | How |
|---|---|---|---|
| 1 | **Format validation** | Sign-up / invite form, client + server | RFC-compliant email regex (use a standard validator, e.g. `zod` `.email()`); reject empty, malformed, and over-long (254 chars) addresses |
| 2 | **Deliverability / ownership (confirmation)** | After sign-up or invite | Supabase Auth confirmation email with a link/token; account cannot sign in until confirmed (see §4.1). Supabase sends from its default sender on Free; configure a custom SMTP sender (e.g. Resend) before the first live batch so confirmation mail is not flagged as spam |
| 3 | **Uniqueness** | Sign-up / invite | Email is the unique key in `auth.users`; a second sign-up with the same email returns "already registered" (do not reveal whether the address exists — return the same generic message for existing and non-existing addresses on password-reset, see §4.3) |

### 3.2 Behaviour

- Sign-up is **invite-only in v1**: `lsp_admin` (or `super_admin`) creates the user and assigns a role; the user receives an invite email and sets their password via the Supabase invite link. There is no public self-registration page. This prevents unknown accounts from appearing in an LSP tool that handles personal data.
- The invite link expires per Supabase Auth settings (default 24 h — confirm in the Auth dashboard at setup; do not assert a different value in code).
- If the invite expires, the admin re-sends it; the user never "registers" themselves.
- Email addresses are stored in `auth.users` (managed by Supabase) and mirrored only as needed in the application `profiles` table (id, email, full name, role, no_reg, LSP/TUK linkage). The application never stores a password or a password hash.

### 3.3 Email deliverability checklist (setup)

- [ ] Custom SMTP configured (Resend or equivalent) before the first live batch.
- [ ] SPF / DKIM / DMARC set for the sending domain.
- [ ] Confirmation, invite, password-reset, and MFA email templates in Bahasa Indonesia.
- [ ] Supabase Auth email rate limits noted (Free tier: verify current limits in the dashboard; do not assert numbers here).

## 4. Password — encryption, policy, reset

### 4.1 Encryption / hashing — Supabase handles it

- **Supabase Auth hashes passwords with bcrypt** (GoTrue default). The application does not choose the algorithm, the cost factor, or the salt, and must not implement its own hashing.
- **Do not roll your own crypto.** Do not add a second hash, do not encrypt passwords with an application key, and do not store passwords anywhere — including logs, error reports, and the database. A password that appears in a log is an incident.
- Passwords are transmitted only over TLS (HTTPS) to Supabase Auth; the application server never logs request bodies containing passwords.
- If the project ever migrates away from Supabase Auth, password migration is handled by Supabase's export/migration path — not by extracting hashes into application code.

### 4.2 Password policy (enforced by Supabase Auth settings)

| Rule | Value | Notes |
|---|---|---|
| Minimum length | 12 characters | Set in Supabase Auth → Password settings |
| Complexity | At least one uppercase, one lowercase, one digit, one symbol | Enforced by Supabase where supported; otherwise enforced by a Zod check on the set-password form (server-side, never client-only) |
| Common-password block | Enabled (Supabase "leaked password protection" / HaveIBeenPwned check where available) | Reject passwords found in breach lists |
| Maximum length | 72 bytes (bcrypt limit) | Enforced by Supabase; surface the error in Bahasa Indonesia |
| Password reuse | Last 5 passwords cannot be reused | Supabase Auth setting where available; otherwise a future enhancement |
| Expiry | No forced expiry | Forced expiry drives weak passwords; rely on MFA + breach detection instead |

### 4.3 Password reset flow

1. User clicks "Lupa kata sandi" on the sign-in page and enters their email.
2. The app calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <reset-url> })`.
3. **The response is identical whether or not the email exists** — this prevents account-enumeration. The UI always says (Bahasa Indonesia): "Jika email terdaftar, tautan reset telah dikirim."
4. Supabase sends a reset email with a time-limited token/link.
5. The user opens the link, sets a new password (policy §4.2 applies), and is signed in.
6. All existing sessions for that user are revoked on reset (Supabase behaviour — verify at setup; if not automatic, revoke explicitly via the Admin API).
7. The reset request, the reset completion, and any failed attempts are audit-logged (without the token or the password).

### 4.4 Account lockout / throttling

- Supabase Auth rate-limits sign-in attempts. The application adds: after 5 consecutive failed sign-ins, show a generic "too many attempts, try again later" message and a CAPTCHA-free cooldown (do not implement a custom CAPTCHA in v1).
- Lockout is per-account + per-IP where Supabase supports it; the exact thresholds are Supabase Auth settings, not application constants — record the chosen values in the Environment Setup doc (doc 11) at deployment time.
- A locked-out assessor during a live assessment day is an operational incident: the LSP admin can unlock/reset via the Supabase dashboard, and the action is audit-logged.

## 5. OTP / auth flow

### 5.1 Sign-in (email + password) — the default flow

```
1. User opens /login (Bahasa Indonesia).
2. User enters email + password.
3. Server Action calls supabase.auth.signInWithPassword({ email, password }).
4. On success: Supabase returns a session (access + refresh JWT, HttpOnly cookies via the SSR client).
5. Server checks the user's profile: role assigned? No. Reg present (for assessors)?
   - If the profile is incomplete → redirect to /onboarding (complete profile, enrol MFA, **upload signature — v1.2, §14**).
   - If MFA is enabled and not yet verified for this session → redirect to /mfa-verify.
   - Otherwise → redirect to the dashboard.
6. On failure: generic error ("Email atau kata sandi salah"), no distinction between
   wrong email and wrong password. Failed attempt is audit-logged.
```

### 5.2 OTP via email (passwordless / step-up)

Supabase Auth supports email OTP (`signInWithOtp`). The system uses it in two places:

| Use | Flow |
|---|---|
| **Passwordless sign-in (optional, per LSP)** | User enters email → Supabase sends a 6-digit OTP → user enters the code → `supabase.auth.verifyOtp({ email, token, type: 'email' })` → session created. OTP expiry is a Supabase Auth setting (default 1 h — confirm in the dashboard at setup). One OTP per request; entering a wrong code 5 times invalidates the OTP and requires a new one. |
| **Step-up verification for sensitive actions** | Before a high-risk action (exporting the AK.05 pack with personal data, changing a certificate name after confirmation, deleting records under the retention policy), the system may require a fresh OTP. This is a P1 enhancement; v1 relies on MFA (§5.3) + audit logging for these actions. |

**OTP rules:**
- OTPs are sent by Supabase Auth only — the application never generates, stores, or sends OTP codes itself.
- The OTP email template is in Bahasa Indonesia and states what the code is for and that it expires.
- The OTP entry screen never reveals whether the email exists (same generic message as §4.3).
- OTP codes are never logged.

### 5.3 MFA (TOTP) — required for assessor and admin

| Rule | Detail |
|---|---|
| Who must enrol | `assessor`, `ketua_tim`, `lsp_admin`, `super_admin` — mandatory before they can finalise an AK.05 or export personal data |
| Who may enrol (optional) | `tuk_viewer`, `auditor` — optional, recommended |
| Method | **TOTP** (authenticator app, e.g. Google Authenticator / Authy) via Supabase Auth MFA (`mfa.enroll` → TOTP, `mfa.verify`). SMS MFA is not used (cost, SIM-swap risk, and unreliable delivery). |
| Enrolment | During onboarding: scan QR / enter secret → enter a TOTP code to confirm → enrolment is stored by Supabase Auth. Recovery codes are shown once and must be stored by the user; the system does not store them. |
| Verification | After password sign-in, if MFA is enrolled, the session is "MFA-pending" until `mfa.verify` succeeds (AAL2). Unverified sessions cannot reach any assessment data (RLS + middleware redirect to `/mfa-verify`). |
| Recovery | Lost authenticator → LSP admin / super_admin resets MFA after verifying the user's identity out-of-band; the reset is audit-logged. There is no self-service MFA reset. |
| Enforcement | Enforced in middleware + RLS: a session without AAL2 cannot read `candidates`, `documents`, or `assessments` tables. The UI also hides assessment navigation until MFA is verified. |

**Open point (UNCONFIRMED):** whether the LSP formally adopts mandatory MFA for assessor/admin, and on what date, is the LSP's decision (OQ-A1). This document states the *design* (MFA required for assessor/admin); the formal adoption decision is recorded as an open question for the LSP to confirm before the first live batch.

### 5.4 Sessions

| Property | Value |
|---|---|
| Storage | HttpOnly, Secure, SameSite=Lax cookies via the Supabase SSR client (`@supabase/ssr`). No tokens in `localStorage`. |
| Access token lifetime | Supabase default (1 h) — refresh is automatic via the refresh token while the session is valid. Do not assert a different value in code. |
| Refresh token | Rotating refresh tokens (Supabase default); reuse detection revokes the session. |
| Idle timeout | 8 hours of inactivity → session is treated as expired and the user is asked to sign in again (application middleware; configurable). |
| Absolute timeout | 7 days → forced re-authentication (configurable). |
| Sign-out | `supabase.auth.signOut()` revokes the session server-side; the user is redirected to `/login`. "Sign out everywhere" is available from the profile page (revokes all sessions via the Admin API). |
| Concurrent sessions | Allowed (laptop + phone) for assessors in the field; each session is listed on the profile page with device/last-active info where Supabase provides it, and can be revoked individually. |

### 5.5 Auth middleware (Next.js)

- Middleware (`middleware.ts`) runs on every request: refreshes the session, checks the route's required role, redirects unauthenticated users to `/login`, MFA-pending users to `/mfa-verify`, and incomplete-profile users to `/onboarding`.
- Public routes in v1: `/login`, `/reset-password`, `/mfa-verify`, `/onboarding`, and the health-check endpoint. There is no public candidate-facing route in v1.
- Middleware is a UX gate only — **RLS is the enforcement layer**. A request that bypasses middleware still cannot read data it is not authorised for.

## 6. Supabase Auth — concrete methods used

| Need | Supabase method / feature | Notes |
|---|---|---|
| Invite a user | `supabase.auth.admin.createUser({ email, email_confirm, user_metadata: { role, full_name, no_reg } })` + `inviteUserByEmail` | Admin API; service-role key server-side only, never in client code |
| Sign in (password) | `supabase.auth.signInWithPassword({ email, password })` | Server Action |
| Sign in (OTP) | `supabase.auth.signInWithOtp({ email })` then `verifyOtp({ email, token, type: 'email' })` | Optional passwordless path (§5.2) |
| Sign out | `supabase.auth.signOut()` | Revokes session |
| Password reset | `supabase.auth.resetPasswordForEmail(email, { redirectTo })` | Generic response (§4.3) |
| Update password | `supabase.auth.updateUser({ password })` | Authenticated session required; policy §4.2 |
| MFA enrol | `supabase.auth.mfa.enroll({ factorType: 'totp' })` | Returns QR/secret; verify with `mfa.verify` |
| MFA verify | `supabase.auth.mfa.verify({ factorId, code })` | Raises session to AAL2 |
| MFA unenroll | `supabase.auth.mfa.unenroll({ factorId })` | Admin-only, audit-logged |
| Get user / session | `supabase.auth.getUser()` / `getSession()` | Server-side, per request |
| List / manage users | Admin API (`auth.admin.listUsers`, `deleteUser`) | Service-role key, server-side only |
| Custom SMTP | Supabase Auth → Settings → SMTP | Resend or equivalent; templates in Bahasa Indonesia (§3.3) |

**What is not used:** Supabase phone/SMS auth (not used); social/OAuth providers (not used in v1 — LSP accounts are email-based); anonymous sign-in (never).

## 7. Row Level Security (RLS) — summary

Full policies are specified in doc 04 (ERD / Database Design) and doc 12 (SDD). The rules this document imposes:

| Table group | Policy (in words) |
|---|---|
| `profiles` | A user reads/updates their own row; `lsp_admin`/`super_admin` manage rows for their LSP |
| `batches`, `batch_assessors` | Visible only to assigned assessors, the Ketua Tim, LSP admin, TUK viewer (own TUK), and auditor (read-only) |
| `candidates`, `candidate_documents`, `assessments`, `grades`, `similarity_flags` | Assessor sees only candidates in batches they are assigned to; Ketua Tim sees their batch; LSP admin sees their LSP's batches; TUK viewer sees their TUK's batches (no KTP detail); auditor read-only |
| `identity_confirmations` (certificate names) | Write requires `assessor`/`ketua_tim` on an assigned batch; every write is audit-logged |
| `storage.objects` (KTP/ijazah bucket) | Private bucket; read requires assessor role + batch assignment; every read is audit-logged (via a signed-URL + access-log pattern — see SDD) |
| `audit_log` | Append-only; no UPDATE/DELETE for any application role; read for `auditor`/`lsp_admin`/`super_admin` only |
| `ai_runs` (prompt + model + raw output) | Read for assigned assessor, Ketua Tim, LSP admin, auditor; write by the worker/service role only |
| `scheme_configs` | Read for all authenticated users; write for `lsp_admin`/`super_admin` only |

**RLS is enabled on every table, including lookup tables.** A table without RLS is a defect, not a shortcut.

## 8. Audit log (auth-adjacent)

The audit log records, as a minimum, with actor + timestamp + (where relevant) IP / user-agent:

- sign-in success / failure, sign-out, password reset request / completion, OTP request / verification failure, MFA enrol / verify / reset, role change, user invite / deactivation;
- every access to KTP/ijazah material (who, which candidate, when);
- every verdict, grade confirmation, certificate-name confirmation, AI run, and export (see PRD FR-16).

The audit log is **append-only**: no application role can UPDATE or DELETE rows. Retention of the audit log follows the LSP's retention policy (configurable; default: cert-validity + 5 years, matching the strictest figure found — see BRD §9). Audit-log export is available to `auditor` and `lsp_admin` as XLSX/PDF.

## 9. Prompt registry + versioning (v1.1)

The two assessor prompts are assessment instruments, not settings text. They live in the prompt registry:

| Item | Rule |
|---|---|
| Source of truth | Verbatim files in `research/prompts/` (`prompt_wawancara_k3.md`, `prompt_test_tulis.md`), copied unchanged to `src/ai/prompts/source/` at seed time. Hashes are recorded (doc 11 §5.5); a hash mismatch blocks seeding. |
| Adapted templates | `dit-gap-analysis.v1.ts` (from the RCTFA prompt) and `written-test-grading.v1.ts` (from the written-test prompt), adapted per doc 15 §4.4: "Kompeten Bersyarat" removed as a decision value, the 13-question bank labelled separately from official FR.IA.04B, model answers assessor-only, regulation list replaced by the per-scheme config table. Adaptation notes are stored with the version. |
| Immutability | A prompt version, once used in any analysis/grading run, is immutable. A change creates a new version (`v2`, …); old runs keep pointing at the old version and replay unchanged (QA PRM-01). |
| Who can change | No application role. New versions are created in code + deploy (reviewed like code), recorded in the registry by a migration. There is no in-app prompt editor in v1.1 (doc 08 §9). |
| Visibility | Every AI output shows prompt key + version + model + source hash (short) via the `PromptVersionBadge` (doc 08 §3.4). `lsp_admin` and `auditor` can read registry entries; assessors see the version on their own runs. |
| Per-scheme variants | v1.1 has no config switch that swaps prompt text per scheme. A new scheme gets its own versioned template file (e.g. `dit-gap-analysis.<scheme>.v1.ts`) and a registry row mapping scheme → prompt key → active version. Adding a scheme is a file + registry row, not a pipeline code change (doc 15 §4.4 v1.1). |

## 10. Completeness gate (v1.1)

| Item | Rule |
|---|---|
| What it gates | The DIT analysis run (`POST /dit/{id}/analyse`, MCP T7). Required inputs: FR.IA.04A file, presentation/transcript, candidate profile. |
| Behaviour on missing input | The run is refused with `422 incomplete_inputs` and `missing[]` naming exactly which inputs are absent. No job is enqueued; no partial matrix or question bank is produced. The UI shows the gate panel (doc 08 §4) with one action per missing item. |
| Behaviour when complete | The run enqueues normally. If inputs arrive later (materials arrive gradually, per candidate), the gate re-checks on each attempt. |
| Enforcement | The gate is a precondition in the service layer, shared by the REST API and MCP — the two doors cannot disagree. |
| Audit | Every refused attempt is logged (assessee pseudonym, missing items, timestamp); a refusal is not an error in the assessor's record. |

## 11. Encrypted 06B key handling (v1.1)

The LSP's 06B master key is password-protected in practice (the repo's blank 06B failed to parse as plain OOXML, and a `PASSWORD FR.IA.06B.xlsx` exists alongside it). The system treats an encrypted key as a normal state: **v1.3 (D12):** two copies exist — the repo's SKEMA blank is OLE-encrypted, while the AK3U working key is a plain OOXML docx that opens directly (13 prose answers in one table, 8 embedded images; structure only in `research/06b-key-structure-2026-11-18.md`). Each scheme's 06B ships with a PASSWORD Excel file; the password is supplied by the assessor at runtime (key-upload step), never stored, never logged, never recorded anywhere.

| Item | Rule |
|---|---|
| Password entry | The assessor types the password once, in the web UI (`KeyPasswordPrompt`, doc 08 §3.4), for that grading run only. |
| Decryption | In the worker, via `msoffcrypto-tool` (doc 11 §7). The password is held in memory for the decryption call only. |
| Never stored | The password is never written to the DB, a log, an `llm_run`, or an env var. It is never sent over MCP (MCP T9 returns `key_locked` instead). |
| Working key — plain docx (v1.3, D12) | Parses directly with no password prompt; 13 prose answers extracted in order, one per 06A question; acceptable points extracted from the prose for partial-credit coverage; embedded images flagged (count + position), never dropped (QA KEY-01). |
| PASSWORD file (v1.3, D12) | Handled like any assessor-supplied secret: never committed to the repo, never pasted into a doc, chat, screenshot, or log; the password value is never recorded anywhere (QA KEY-02). |
| Wrong password | The job fails with `key_password_wrong`; no partial verdicts are stored. After three consecutive failures the grading run locks until an `lsp_admin` reviews it (QA GRD-19). |
| Roles | Only the assigned assessor (or Ketua Tim for their batch) can unlock a key for grading. `tuk_viewer` and `auditor` never see the prompt. |

## 12. Model answers + triage / assignment (v1.1)

**Model answers (assessor-only).** The system may generate model/expected answers for the assessor to judge a candidate's answer against (approved default D1). Rules: shown only to `assessor` / `ketua_tim` / `lsp_admin`, collapsed by default, labelled "Jawaban model — hanya untuk asesor"; never rendered in a candidate-facing view or in any export handed to a candidate; never sent to a non-assessor MCP token (doc 07 G9). **The system never drafts a candidate's answers** — a request to do so is refused by design, because it would violate the VATM "Asli" (authenticity) principle.

**Triage / assignment.** After ingest, unassigned files and assessees live in the triage queue (doc 13 §12). Rules:

| Item | Rule |
|---|---|
| Who assigns | `ketua_tim` (own batch) or `lsp_admin` only — via the Triage screen or MCP T18. An assessor token cannot assign. |
| Suggestions | Filename→person extraction + "Kelompok Asesi" sheet join, each with a confidence. Low-confidence suggestions are shown, never auto-applied. Generic filenames get no suggestion. |
| Decisions | Accept a suggestion, pick a different target, or mark "not needed" with a reason. Every decision is audit-logged with actor + timestamp. |
| Visibility | An assessor sees only triage items routed to them; the Ketua Tim / LSP admin sees the whole batch queue. |
| RLS | Triage rows are covered by the same batch-scoped RLS as `candidates`/`documents` (§7); assignment writes require the assigning role + batch assignment. |

## 13. Name jury + KTP OCR (v1.2, D10)

The AI agent inside the app is the **jury** on the name verdict: it reads the KTP, compares the name sources, and recommends — the assessor confirms.

| Item | Rule |
|---|---|
| OCR | The KTP image is read by **local Tesseract (`ind+eng`)** in the worker (same install as document OCR, doc 11 §7). The KTP image is never sent to any LLM, MCP client, or external service. OCR returns the name text + per-field confidence, stored on the identity record. |
| Sources compared | Four: KTP (OCR text), APL.01, surat tugas, ijazah. |
| Verdicts | `match` (all sources agree) / `mismatch_resolved` (disagreement, jury proposes one certificate name — always the KTP spelling, v1.3 D6) / `needs_human` (no safe proposal, or OCR confidence below the floor). The proposed name is the KTP spelling — the jury never invents a name. |
| Authority (v1.3, D6 decided) | The KTP (government ID) is the authority: the certificate name is the KTP name, verbatim. Surat tugas, APL.01, and ijazah are compared against the KTP, and any discrepancy resolves to the KTP spelling — surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean". If the KTP itself cannot be read (OCR confidence below the floor), the jury returns `needs_human` with no proposed name — the KTP spelling is never guessed from another source. |
| Reasoning | Bahasa Indonesia, with one evidence span quoted per compared name. The verdict carries model + prompt version (`name-jury.v1`, doc 15 §4.4 v1.2) like every other AI run. |
| Confirm / override | Human-only, in the web UI (`NameJuryCard`, doc 08 §3.4 v1.2): [Konfirmasi Nama Ini] applies the proposal; [Ubah / Ketik Sendiri] is an override (typed name, audit-logged with the verdict it replaced + a reason); [Tandai Perlu Manusia] keeps the name unconfirmed with a reason. No MCP tool confirms or overrides (doc 07 G11). An unconfirmed verdict changes nothing — the certificate name stays unconfirmed and AK.05 stays blocked. |
| Low confidence | Below the configured OCR floor, the jury returns `needs_human` with NO proposed name. The floor value is **UNCONFIRMED** (config, calibrated in Phase 2 — QA IDN-09). |
| Non-KTP image | OCR rejects a non-KTP image with a clear reason; no jury verdict is produced; no name is invented (QA IDN-14). |
| PDP — the jury exception, stated explicitly | The general rule (doc 15 §2.5 rule 28) sends pseudonyms to the model. The jury is the **one exception**: it must compare real names, so it runs on real name strings inside the app's audited LLM path. The payload contains the four name strings + OCR confidence and nothing else — no NIK, no address, no phone, no KTP image, no other personal data. A NIK marker in a jury payload is a redaction failure (QA IDN-15, SEC-07). |
| Audit | Every OCR run, jury verdict, confirmation, override, and needs-human marking is audit-logged (actor + timestamp + old → new). |
| Roles | The jury verdict is visible to the assigned assessor, Ketua Tim, `lsp_admin`, and `auditor` (read-only). `tuk_viewer` sees only the confirmed certificate name on the AK.05 pack, never the jury reasoning or the KTP image. |

## 14. Assessor signature (v1.2, D11)

| Item | Rule |
|---|---|
| Upload | At onboarding or Pengaturan → Profil (`SignatureUpload`, doc 08 §3.4 v1.2; wireframe doc 13 §13 v1.2): upload a scan/photo (PNG or JPG) or draw on a canvas. Validated (type + configured size limit) in the browser and again on the server; an invalid file is rejected with a Bahasa Indonesia message and never stored. Size limit is a config value set at deployment (**UNCONFIRMED** — no fixed number asserted here). |
| Storage | Private `signatures` Storage bucket (doc 11 §5.3 v1.2): owner-only RLS (`owner_id = auth.uid()`), signed URLs with short expiry, access audit-logged. Never served through MCP (doc 07 G13). No new secrets. |
| Application | Applied **only at sign-off / finalise**, by the owning assessor, to documents that carry an assessor signature block in the real blanks (verified in `research/form-blanks-extracted.md`): AK.05, AK.01, AK.02, AK.06, AK.07, FR.IA.04A, FR.IA.04B, FR.IA.07, FR.IA.08, FR.IA.09, FR.IA.10, FR.APL.01, FR.APL.02, Berita Acara. Never applied to a draft; never applied to another assessor's document; never auto-applied. The sign-off modal shows a preview of the exact image that will be stamped (doc 08 §4 v1.2). |
| Blocked without one | AK.05 submit (and any other sign-off) is blocked with the named blocker "Tanda tangan belum diunggah" + a link to upload, when the signing assessor has no active signature. No placeholder, typed-name, or borrowed signature is ever substituted (QA SIG-03). |
| Replacement / versions | Replacing a signature creates a new version; past documents keep the signature version they were signed with (byte-identical on re-download). Previous versions are visible as read-only history with a per-version document count (QA SIG-05). |
| Not in scope | FR.AK.03 has no signature block in its blank; FR.AK.04 carries only the assessee's signature; FR.MAPA.02 has no signature block; FR.VA has no signature block. FR.MAPA.01's relevant-person confirmation table (incl. a Lead Asesor row) is UNCONFIRMED (OQ-17). Assessee signatures are wet signatures on scanned originals and are **out of scope** for generation. The assessor also fills the LSP-side fields on APL.01 (§3.1 recommendation) and APL.02 (review + recommendation), recorded in-app. The Daftar Hadir assessor rows are signed in person at the venue — the uploaded signature is not auto-applied there. |
| Audit | Every upload, replacement, application, and access is audit-logged (actor + timestamp + document + signature version). |
| Roles | Only the owning assessor uploads/replaces their signature. `lsp_admin` cannot upload a signature on an assessor's behalf and cannot apply one. `auditor` may view a signature only via audit-logged access (QA SEC-08). |

## 15. Feature checklist (acceptance)

| # | Feature | Acceptance test |
|---|---|---|
| FB-01 | Invite-only sign-up with email confirmation | No public registration page exists; an invited user can sign in only after confirming their email |
| FB-02 | Email format + uniqueness validation | Malformed and duplicate emails are rejected with a Bahasa Indonesia message |
| FB-03 | Password policy (12 chars, complexity, breach check) | A weak password is rejected; a breached password is rejected |
| FB-04 | Password hashing by Supabase (bcrypt) | No password or hash exists in application code, logs, or the `profiles` table (code + log review) |
| FB-05 | Password reset with generic response | Reset for a non-existent email returns the same message as for an existing one |
| FB-06 | Email OTP sign-in | A 6-digit OTP signs the user in; 5 wrong codes invalidate it; expired OTP is rejected |
| FB-07 | TOTP MFA enrolment + verification | An assessor cannot reach assessment data until MFA is verified (AAL2); unenrolled assessor is blocked from finalising AK.05 |
| FB-08 | MFA recovery (admin reset) | Admin reset works and is audit-logged; no self-service reset exists |
| FB-09 | Session handling (HttpOnly cookies, refresh, idle 8 h, absolute 7 d) | No token in `localStorage`; idle session expires; "sign out everywhere" revokes all sessions |
| FB-10 | Roles (6 roles) + RLS | Each role's visibility matches §2/§7; a cross-assessor read returns no rows |
| FB-11 | Role change audit | Every role change has an audit row with actor, old role, new role, reason |
| FB-12 | Audit log append-only | No application role can UPDATE/DELETE `audit_log` (attempt fails at the DB level) |
| FB-13 | KTP access logging | Every KTP view creates an audit row |
| FB-14 | Auth email templates in Bahasa Indonesia + custom SMTP | Confirmation/invite/reset/OTP emails arrive from the configured sender, in Bahasa Indonesia |
| FB-15 | Prompt registry immutability (v1.1) | A used prompt version cannot be edited in place; a new version leaves old runs byte-identical (QA PRM-01) |
| FB-16 | Completeness gate (v1.1) | DIT analysis with a missing input returns `422 incomplete_inputs` with `missing[]`; nothing is enqueued (QA DIT-02) |
| FB-17 | Encrypted 06B handling (v1.1) | Right password decrypts and grades; wrong password fails cleanly; the password appears nowhere in the DB or logs (QA GRD-19) |
| FB-18 | Model answers assessor-only (v1.1) | Model answers are invisible to `tuk_viewer`/`auditor` and absent from candidate-facing exports |
| FB-19 | Triage assignment (v1.1) | Only `ketua_tim`/`lsp_admin` can assign; every assignment is audit-logged; an assessor sees only their own routed items |
| FB-20 | KTP OCR local, never LLM (v1.2) | An OCR job makes zero LLM calls; the KTP image appears in no LLM payload, MCP response, or log (QA IDN-08, SEC-07) |
| FB-21 | Name-jury verdict + confirm/override (v1.2) | Verdicts are `match` / `mismatch_resolved` / `needs_human` with reasoning + evidence + OCR confidence; the certificate name changes only on assessor confirmation or override, both audit-logged; `needs_human` shows no proposed name (QA IDN-10–IDN-13) |
| FB-22 | Jury PDP exception (v1.2) | The jury payload contains only the four name strings + OCR confidence; a synthetic NIK marker appears nowhere in payload, output, `llm_run`, or logs (QA IDN-15) |
| FB-23 | Signature upload + storage (v1.2) | Valid PNG/JPG/drawn signature stored privately, owner-only; invalid files rejected and never stored (QA SIG-01, SIG-02, SEC-08) |
| FB-24 | Signature applied only at sign-off (v1.2) | Drafts show an empty signature space; sign-off applies the owning assessor's active signature with a preview; no active signature blocks sign-off (QA SIG-03, SIG-04, SIG-07) |
| FB-25 | Signature replacement keeps old documents intact (v1.2) | Replacing creates a new version; past exports are byte-identical on re-download (QA SIG-05) |
| FB-26 | KTP-authoritative name jury (v1.3, D6) | The jury's proposed certificate name is always the KTP spelling; a KTP that cannot be read yields `needs_human` with no proposal; the certificate name changes only on assessor confirmation or override (QA IDN-16, IDN-17) |
| FB-27 | Grading shape + AI VATM roll-up (v1.3, D7; v1.4, D16) | Every graded question shows a verdict + Bahasa Indonesia explanation; the summary lists exactly the wrong question numbers (Ringkasan Kesalahan); no overall % is presented as a pass/fail; plagiarism is a separate qualitative report (Bersih / Waspada), never numeric (QA GRD-20–GRD-23). **v1.4:** the per-unit K/BK is the AI's VATM recommendation, confirmed or overridden by the assessor — no "assessor's judgement per KUK" default remains (QA GRD-15) |
| FB-28 | 06B key handling — plain vs encrypted, password never stored (v1.3, D12) | A plain working key parses with no password prompt; an encrypted key stays blocked without the runtime-supplied password; the password appears nowhere in the DB, logs, or docs (QA KEY-01, KEY-02, GRD-19) |
| FB-29 | Scheme manifest — second scheme works (v1.4, D17) | Registering a second scheme with a different file set, question count, prerequisites, and requirements works end to end, and a batch under it validates against that scheme's manifest; no AK3U value is assumed (QA MAN-01/MAN-02) |
| FB-30 | Provider Settings BYOK (v1.4, D18) | Provider + model + key are user-supplied at runtime; the key is masked, never echoed, never in env files or logs; Test connection reports success/failure without the key; changing provider/model never re-grades past runs (QA PRV-01/PRV-02) |
| FB-31 | Short per-batch intake (v1.4, D13) | A batch is created from a registered scheme with three inputs only (scheme, Drive link(s), Kelompok Asesi); no scheme or scheme-level form is re-uploaded (QA INT-01) |
| FB-32 | Zero hardcoding (v1.4, D21) | No literal AK3U value (13 questions, AK3U file names, AK3U prerequisites) appears in code as a system default; every such value is read from the active scheme's config/manifest; even fallbacks are config values (QA MAN-02) |

## 16. Open questions (UNCONFIRMED)

| # | Question |
|---|---|
| OQ-A1 | Does the LSP formally adopt mandatory MFA for assessor/admin before the first live batch, and on what date? (Design assumes yes; formal decision is the LSP's.) |
| OQ-A2 | Which SMTP sender (Resend or other) and sending domain will the LSP use for auth emails? |
| OQ-A3 | Supabase Auth email rate limits and OTP expiry defaults — confirm in the Auth dashboard at setup; do not assert numbers in code. |
| OQ-A4 | Should TUK viewers and auditors have mandatory MFA, or is optional sufficient? |
| OQ-A5 | Idle (8 h) and absolute (7 d) session timeouts — confirm with the LSP; assessors in the field may need a longer absolute timeout. |
| OQ-A6 | Is passwordless (email OTP) sign-in wanted at all, or is email + password + MFA the only sign-in method? |
| OQ-A7 | KTP OCR confidence floor (v1.2) — below what confidence does the jury return `needs_human` with no proposed name? Config value, calibrated on real KTP scans in Phase 2. **UNCONFIRMED.** |
| OQ-A8 | Name-jury cut (v1.2) — when exactly is a disagreement `mismatch_resolved` vs `needs_human`? Rule shape in doc 15 §2.6 rule 30; the cut is config + LSP confirmation. **UNCONFIRMED.** |
| OQ-A9 | Assessor-signature file size limit (v1.2) — config value set at deployment. **UNCONFIRMED.** |

## 17. Scheme registration + per-scheme manifest (v1.4, D17 + D21)

The system is **not AK3U-only by default**. Each scheme is registered once, with its own manifest; a batch runs against the manifest of its scheme.

| Item | Rule |
|---|---|
| What a manifest holds | (a) **File set** — which forms exist for this scheme, their names/suffixes, required vs optional, and their instruments (e.g. DIT, presentation, written, interview). (b) **Question counts** — 04B built-in count, 06A essay count, question-bank default count — all per-scheme, never hard-coded to 13. (c) **Decision/assessment rules reference** — which scheme document states the rule (for AK3U: VATM per scheme §9.3.3–9.3.4; another scheme references its own scheme document, never a global hard-code). (d) **Prerequisites** — entry education/experience combinations per scheme. (e) **Registration requirements** — the evidence list per scheme. |
| AK3U's values are AK3U's only | The AK3U manifest holds: 13 questions (04B built-in, 06A essay, question bank); prerequisites SLTA+3yr / D3-D4-S1+2yr / S2-S3+1yr / competency-based training; requirements KTP, ijazah min SLTA, work-experience letter / training certificate, CV, 4 colour 3×4 photos red background; fee Rp 2.000.000 (the LSP's fee, a scheme fact — not a system price); 13 units M.71KKK01.001.1–013.1. Registering another scheme starts with empty fields (or an explicit template the admin picks) — **never pre-filled with AK3U's values**. No other scheme's values are invented: Petugas K3's file set, question counts, prerequisites, and requirements are UNKNOWN. |
| Who registers | `lsp_admin` / `super_admin` only (doc 13 §16 wireframe). A manifest change creates a new version — batches already running keep the manifest version they started with. Every manifest create/edit is audit-logged. |
| Validation | Batch creation and ingest validate against the active scheme's manifest: a missing required file for that scheme is flagged missing; a file that belongs to another scheme's manifest is not silently accepted as this scheme's evidence. |
| Config, not code (D21) | The manifest lives in config (`scheme.<id>.manifest`). No file name, question count, rule, prerequisite, or requirement from any scheme appears as a literal in source code, prompts, or tests. A test that greps the source for a hard-coded question-count literal fails the build (QA MAN-02). |

## 18. Provider Settings — BYOK, free-first (v1.4, D18)

| Item | Rule |
|---|---|
| What it is | Provider Settings (Pengaturan → Penyedia AI, doc 08 §3.4 v1.4; wireframe doc 13 §15): provider selector (Anthropic (Claude) / OpenAI-compatible / Gemini), API Key (masked), Base URL (optional gateway), ANTHROPIC_AUTH_TOKEN (gateway bearer / passthrough, when calling the gateway), Model (free text + Suggest…), Temperature, Max tokens, Thinking budget (0 = off), Google Drive API key (optional, for public Drive folders, no OAuth). Modelled on Moza's Test Grader Provider Settings screenshot. |
| Providers | Anthropic, OpenAI-compatible, Gemini, OpenRouter / OmniRouter / 9Router, Nvidia NIM, and others (via the OpenAI-compatible path: base URL + model). There is **no primary model** — GPT-4o-mini is no longer the primary (this replaces the v1.0–v1.3 stack decision). Free tiers are usable; **no provider is claimed to be free**. |
| Key handling | Keys are stored locally in the browser, sent per request, never logged, never committed, **never in env files**, never echoed back — not even by [Uji Koneksi], whose result says only "Terhubung" or "Gagal — [alasan]". A provider key found in any `.env*` file, migration, or fixture is a leaked secret: revoke it the same day (doc 11 §2.1, §3 v1.4). |
| Temperature | Grading/jury calls use temperature 0 (deterministic) regardless of the screen's Temperature setting — that setting is the user's default for other calls. Moza's Test Grader uses 0.9 as its own default; that is his app's setting, not the grading default. |
| Effect of a change | Changing provider or model never re-grades past runs — past runs keep the provider + model recorded on them. A provider/model change is audit-logged (who, when, old → new provider/model — never the key). |
| Roles | Any authenticated assessor configures their own provider settings; `lsp_admin` may set a deployment default. No role can read another user's key (keys are per-user, local). |
| OQ-A10 | Similarity threshold values (v1.4, D19) — the per-scope numeric thresholds are config; what values ship? Calibration on real batches sets them; no number is asserted here. **UNCONFIRMED.** |
| OQ-A11 | Scheme currency (OQ-11) — the AK3U scheme document is 2021 (file 2022) vs the 2023 MUK; is the 2021 scheme still the authority for the next batch, or has the LSP adopted a newer scheme/MUK? One LSP check. **UNCONFIRMED.** |
| OQ-A12 | Provider choice per LSP — which provider(s) will the LSP actually use (free tier availability, gateway, spend cap)? The system is provider-agnostic by design; the LSP's choice is a deployment decision, not a code decision. **UNCONFIRMED.** |
