# 05 — API Contract — AsesorKompetensi

| Field | Value |
|---|---|
| System | AsesorKompetensi — LSP / BNSP assessor web app (OHSE-first, general certification) |
| Version | 1.4 — 2026-11-18 |
| API style | REST over Next.js App Router Route Handlers (`app/api/**/route.ts`), TypeScript, Zod validation |
| Base URL | `https://<app-domain>/api/v1` (prototype: Vercel; see doc 12) |
| Auth | Supabase Auth JWT (Bearer) + Postgres RLS on every table (doc 04 §6) |
| Companion docs | `04-erd-database-design.md` (schema), `06-technical-design.md` (pipelines), `12-system-design-document.md` |
| Language | Docs in English; Indonesian form names preserved. API error messages and UI in Bahasa Indonesia. |

> **Canonical decisions.** DIT = **Daftar Instruksi Terstruktur**. FR.IA.04A = DIT;
> official FR.IA.04B = presentation assessment, user's 13-question bank is a separate
> artefact (count per-scheme — manifest; AK3U's value is 13), always labelled "assessor's bank, not
> official FR.IA.04B". FR.IA.09 = interview form in the portfolio route (P1). 06A =
> soal / 06B = kunci / 06C = jawaban under MUK 2023 only — suffix mapping per-LSP
> configurable (confirmed for AK3U MUK 2023 against the real blanks in v1.1).
> Decision binary **K / BK only**; a readiness recommendation lives only as a free-text
> note in `readiness_assessments` (v1.4, D15: the prompt must not emit "Kompeten Bersyarat" even as a suggestion). Model/expected answers are
> **assessor-only**; the system never drafts a candidate's answers (D1 resolved).
> FR.AK.05 = per-assessor per-batch report, a recommendation to TUK/LSP, NOT the
> certification decision. AI is a recommendation only; similarity is a flag, never an
> auto-fail; identity human-confirmed. PDP UU 27/2022: NIK/KTP never to an LLM.
> Stack: Next.js App Router + TypeScript, Supabase, Vercel AI SDK, provider-agnostic
> BYOK LLM (Anthropic / OpenAI-compatible / Gemini / OpenRouter / OmniRouter /
> 9Router / Nvidia NIM — user-supplied key, runtime config, no primary model, v1.4
> D18). All heavy work (Drive scan, OCR, LLM grading,
> export) is **async via a job queue** — never a synchronous HTTP request.
> **Repo constraint (v1.1): the GitHub repo is never a data store** — no assessee
> personal data in git; the repo holds code + docs only.
> **v1.3 decisions (18 Nov 2026, Moza).** (1) **Certificate-name rule — DECIDED
> (D6, closes OQ-06): the KTP is the authority.** The certificate name is the KTP
> name verbatim; surat tugas, APL.01, ijazah are compared AGAINST the KTP and
> discrepancies resolve to the KTP spelling (Moza's example: surat tugas "Declan
> Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean"). A jury
> proposal on `mismatch_resolved` is ALWAYS the KTP spelling; confirm/override
> is unchanged. (2) **Pass-mark shape — DECIDED (refines D7/OQ-04):** per-question
> verdicts (Benar / Sebagian / Salah) + Bahasa Indonesia explanation, plus a
> per-student error summary ("Ringkasan Kesalahan"), plus plagiarism analysis as
> a SEPARATE qualitative report (Bersih / Waspada + reasoning, never a numeric
> verdict). NO overall percentage as the decision; roll-up default = assessor's
> judgement per KUK (OQ-04 open only for LSP confirmation of the default).
> **[SUPERSEDED in v1.4 by D16: the AI judges VATM sufficiency per unit and
> recommends K/BK; the assessor confirms or overrides — OQ-04 answered.]**
> Coverage % is informational only, never the pass/fail. (3) **06B password +
> key structure (D12; OQ-14 answered in part):** each scheme's 06B ships with a
> PASSWORD Excel file; the password is supplied by the assessor at runtime, never
> stored. Two copies exist (repo SKEMA blank OLE-encrypted, AK3U working key
> plain OOXML) — an unencrypted key file is parsed directly and a password is
> never required for it. **[v1.3 roll-up default SUPERSEDED in v1.4 by D16 —
> see the v1.4 decisions below.]** The reference apps (Test Grader; K3 Expert
> AI on Gemini 3 Pro) are behaviour references only.
> **v1.4 decisions (18 Nov 2026, Moza).** (1) **Upload flow (D13):** scheme +
> scheme-level forms (06A, 06B) registered ONCE per scheme; per batch only Drive
> link(s) + Kelompok Asesi (Drive link or .xlsx); filled 04A/04B/09 copies ingested
> FROM the Drive folder; direct upload is the fallback. (2) **FR.IA.04B official
> form (D14, closes OQ-02):** 4 Kelompok Pekerjaan, 13 built-in questions (one per
> unit), Ya/Tidak per KUK, binary recommendation; evidence = DIT task + presentation.
> (3) **No "Kompeten Bersyarat" (D15, closes OQ-03):** binary K/BK only — no prompt
> may emit the third value, not even as a suggestion. (4) **AI judges the roll-up,
> VATM-based (D16, answers OQ-04):** scheme §9.3.3–9.3.4 — evidence meeting VATM →
> "Kompeten", otherwise "Belum Kompeten"; NO numeric pass mark. The AI judges VATM
> sufficiency per unit and recommends K/BK; the assessor confirms or overrides (via
> the decisions endpoint, §2.11). The roll-up record stores the AI's VATM reasoning
> per unit + the assessor's confirm/override. REPLACES the v1.3 default.
> (5) **Multi-scheme by default — per-scheme file manifest (D17):** each scheme
> registers its own manifest (forms, file patterns, required flags, instrument roles)
> PLUS question counts, decision-rule reference, prerequisites, registration
> requirements (doc 04 §4.2). The manifest drives batch-intake validation — a
> manifest-required file missing at intake → 422 `MANIFEST_FILE_MISSING`. AK3U
> values are AK3U's only; no other scheme's values are invented. (6) **Provider-
> agnostic, free-first, BYOK (D18):** provider + base URL/gateway + model + key are
> runtime config, user-supplied; keys stored locally (browser) and sent per request,
> never logged, never committed, never in the DB in plaintext (only a key reference
> is stored — `llm.api_key_ref`). GPT-4o-mini is NO LONGER the primary; there is no
> primary model. Free tiers usable per provider; pricing per provider is out of scope.
> (7) **Numeric similarity thresholds + details (D19, refines OQ-08):** flags use
> per-scope NUMERIC thresholds WITH evidence details (spans, shared unique errors);
> the qualitative Bersih/Waspada report stays the human-facing summary. Threshold
> VALUES stay UNCONFIRMED (calibration). (8) **Dashboard look (D20):** paulcodes4
> "Dashboard V18" — modern & minimal, white-and-blue, premium, responsive; grounded
> by Moza's screenshot 2026-11-18 01:25 (dark sidebar + light content, glassmorphism
> stat cards, hover lift). (9) **Zero hardcoding (D21):** no hardcoded values at all
> — every scheme/org/deployment-varying value comes from config; a fallback is itself
> a config value.

## 0. Changelog — v1.0 → v1.1 (2026-11-17)

| Change | Where |
|---|---|
| Prompt registry endpoints (§2.13): list/get/create-version/approve; no delete of used versions | §2.13, §3.11 |
| Completeness gate on `POST /dit/{id}/analyse`: 422 + `missing_documents` list when FR.IA.04A / transcript / profile incomplete | §2.7, §3.9 |
| Readiness + model-answers endpoints (assessor-only, RLS-enforced) | §2.7 |
| AK.05 accept / return / resubmit / sign-off endpoints (TUK/LSP review; returned → re-draft → re-submit) | §2.11, §3.12, §7 |
| Combined written-test report endpoint `GET /batches/{id}/written-report` (single Markdown report, Bahasa Indonesia) | §2.10, §3.10 |
| Shared-folder triage endpoints + multi-name surat-tugas parse preview | §2.4, §3.13 |
| Encrypted-06B key upload (password per-request, never stored; wrong password → 422) | §2.9, §3.14 |
| Per-unit roll-up endpoint + rule behaviour (pass mark UNCONFIRMED) | §2.9, §3.15 |
| MFA wording fixed (no finance roles in this system) | §1.3 |
| AK.05 field list validated against the real blank; export format still UNCONFIRMED (D8) | §2.11, §10 |

## 0.1 Changelog — v1.1 → v1.2 (2026-11-17)

Moza decisions, 17 Nov 2026 23:45. New FRs for these changes are added by Group A
in doc 02 v1.2 (numbering dependency — this doc references them by name, not by
number, until the v1.2 FR list lands).

| Change | Where |
|---|---|
| KTP OCR run + AI name-jury endpoints (async OCR, jury get/confirm/override; 422 below the OCR confidence threshold) | §2.6, §3.16 |
| Assessor signature endpoints (upload/replace/list/deactivate/preview); sign-off applies the caller's active signature; AK.05 submit blocked without one | §2.14, §2.11, §3.17, §7 |
| Export rule D8 **decided**: AK.05 = PDF + DOCX; every other generated document = DOCX only; XLSX only for tabular data extracts; format validation 422 | §2.10, §2.11, §3.10, §3.18, §10 |
| New error codes `OCR_LOW_CONFIDENCE`, `NO_ACTIVE_SIGNATURE`, `EXPORT_FORMAT_NOT_ALLOWED` | §1.2 |
| State machines: jury (`pending → confirmed \| overridden \| needs_human`), signature (`active → superseded \| deactivated`) | §7 |
| Security: signature upload validation (image-only, size/type, virus-scan hook UNCONFIRMED); jury redaction rule | §8 |

## 0.2 Changelog — v1.2 → v1.3 (2026-11-18)

Moza decisions, 18 Nov 2026 01:06.

| Change | Where |
|---|---|
| Certificate-name rule **DECIDED (D6, closes OQ-06)**: KTP is the authority — certificate name is the KTP name verbatim; jury proposal on `mismatch_resolved` is ALWAYS the KTP spelling (Declan Rice example in §3.16) | §2.6, §3.16, §10 |
| Pass-mark shape **DECIDED (refines D7/OQ-04)**: per-question verdicts + per-student error summary ("Ringkasan Kesalahan") + plagiarism as a SEPARATE qualitative report (Bersih / Waspada + reasoning); no overall % as the decision; roll-up default = assessor's judgement per KUK (OQ-04 open only for LSP confirmation of the default) **[superseded in v1.4 by D16]**; coverage % informational only | §2.9, §2.10, §3.5, §3.10, §3.15 |
| 06B key upload **(D12; OQ-14 answered in part)**: unencrypted key file parsed directly — password field optional/absent, never required for an unencrypted file; encrypted file keeps the per-request password path; PASSWORD Excel file per scheme, holder = assessor at runtime | §2.9, §3.14, §8 |

## 0.3 Changelog — v1.3 → v1.4 (2026-11-18)

Moza decisions, 18 Nov 2026 01:18 + 01:23 + 01:24 + 01:26.

| Change | Where |
|---|---|
| Upload flow **(D13)**: scheme + scheme-level forms registered once per scheme; per batch only Drive link(s) + Kelompok Asesi; filled 04A/04B/09 ingested from the Drive folder | §2.2, §2.3, §2.4, §3.8 |
| FR.IA.04B official form **(D14, closes OQ-02)**: 13 built-in questions, Ya/Tidak per KUK, binary recommendation; evidence = DIT task + presentation | §2.7 |
| No "Kompeten Bersyarat" **(D15, closes OQ-03)** | §2.7, §3.11 |
| AI judges the roll-up, VATM-based **(D16, answers OQ-04)**: AI recommends K/BK per unit + VATM reasoning; assessor confirms/overrides via the decisions endpoint; REPLACES the v1.3 default | §2.9, §3.5, §3.15 |
| Per-scheme file manifest **(D17)**: `GET/PUT /schemes/{scheme_version_id}/manifest`; manifest drives batch-intake validation (422 `MANIFEST_FILE_MISSING`) | §1.2, §2.2, §2.4 |
| Provider-agnostic, free-first, BYOK **(D18)**: new §2.15 provider-settings endpoints (get/update/test — test never echoes the key); GPT-4o-mini NO LONGER primary | §2.2, §2.15, §3.19, §8 |
| Numeric similarity thresholds + details **(D19, refines OQ-08)**: numeric flag + qualitative Bersih/Waspada section in the report | §2.10, §3.6, §3.10 |
| Scheme document found **(OQ-01 ANSWERED, OQ-10 partly)** | §10 |
| Zero hardcoding **(D21)** | §4 |

## 1. Conventions

### 1.1 Versioning

- URL versioning: `/api/v1/...`. Breaking changes → `/api/v2/...`; v1 stays live for
  one batch cycle. Non-breaking additions (new optional fields) do not bump the version.
- Every response carries `X-Api-Version: v1`. Deprecated endpoints return
  `Deprecation: true` + `Sunset: <date>` headers for at least 30 days.

### 1.2 Envelope, errors, pagination

All success responses use the envelope; errors never return a bare string.

```json
// Success
{ "ok": true, "data": { "...": "..." }, "meta": { "request_id": "req_01J..." } }
// List success
{ "ok": true, "data": [ "..." ], "meta": { "page": 1, "page_size": 20, "total": 23, "total_pages": 2 }, "request_id": "req_01J..." }
// Error
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "question_no wajib diisi", "details": [{ "field": "question_no", "issue": "required" }], "request_id": "req_01J..." } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod validation failed; `details` lists fields |
| 401 | `UNAUTHORIZED` | Missing / expired Supabase JWT |
| 403 | `FORBIDDEN` | Authenticated but role / RLS denies the resource |
| 404 | `NOT_FOUND` | Resource does not exist (or is outside the caller's org — never leak which) |
| 409 | `CONFLICT` | State conflict, e.g. AK.05 already submitted; duplicate `idempotency_key` with a different body; deleting a used prompt version |
| 422 | `UNPROCESSABLE` | Business rule failed, e.g. finalise AK.05 with unconfirmed certificate names; DIT analysis with incomplete inputs; wrong 06B key password; list the blocking items in `details` |
| 422 | `OCR_LOW_CONFIDENCE` | v1.2: KTP OCR confidence below `identity.ktp_ocr_min_confidence` — the name suggestion is discarded; the assessee's name must be typed from the image (§3.16) |
| 422 | `NO_ACTIVE_SIGNATURE` | v1.2: the assessor has no active signature — sign-off / export of an assessor-signed document / AK.05 submit is blocked until one is uploaded (§3.17) |
| 422 | `EXPORT_FORMAT_NOT_ALLOWED` | v1.2: the requested export format violates the export rule (PDF for a non-AK.05 document; XLSX for a document; see §3.18) |
| 422 | `MANIFEST_FILE_MISSING` | v1.4 (D17): a file the scheme's manifest marks `required` is missing at batch intake/validation; `details` lists the missing `form_key`s (see §2.4) |
| 429 | `RATE_LIMITED` | Per-user / per-org rate limit; honour `Retry-After` |
| 500 | `INTERNAL_ERROR` | Unexpected; `request_id` is the only diagnostic exposed |
| 503 | `SERVICE_UNAVAILABLE` | Worker / Drive / LLM dependency down; retry later |

Pagination: `?page=1&page_size=20` (default 20, max 100). Sorting:
`?sort=created_at&order=desc`. Filtering: exact-match query params per resource
(e.g. `?batch_id=…&status=done`). Cursor pagination (`?cursor=…`) is used for
`drive_files` and `audit_log` (large, append-heavy lists); page pagination elsewhere.

### 1.3 Auth

```
Authorization: Bearer <supabase-jwt>
```

- The JWT is issued by Supabase Auth (email + password; MFA for `lsp_admin` /
  `super_admin`, assessor MFA per LSP policy — **there are no finance roles in this
  system**; v1.0's "finance/admin" wording was a copy error, fixed in v1.1).
- The server derives `organisation_id` and `role` from `auth.uid()` → `users` table.
  **Never trust a client-supplied `organisation_id`.**
- The service-role key is used **only** by the worker and by server-side admin
  functions; it never reaches the browser.
- Endpoints marked `worker` require a worker secret (`X-Worker-Secret`) **or** a
  service-role JWT, and are not callable from the browser client.
- Session: access token ~1 h, refresh via Supabase SSR helpers (`@supabase/ssr`).

### 1.4 Idempotency

- `POST` endpoints that create jobs, decisions, reports or exports **require**
  `Idempotency-Key: <uuid>` (client-generated, one per logical operation).
- Re-POST with the same key + same body returns the original response (`200`, with
  `Idempotency-Replayed: true`). Same key + different body → `409 CONFLICT`.
- Keys are stored in `drive_ingest_jobs.idempotency_key` (jobs) and in a generic
  `idempotency_keys` table for other creates (key, endpoint, request hash, response,
  `expires_at` = 24 h). See doc 04 for the jobs table.

### 1.5 Long jobs — poll, don't wait

No endpoint waits for Drive ingestion, OCR, LLM grading or export. The pattern is
always: `POST` → `202 Accepted` with a job → poll `GET /jobs/{id}` (or subscribe via
Supabase Realtime on the job row) → `GET` the result when `status=done`.

```json
// 202 Accepted
{ "ok": true, "data": { "job_id": "019...", "job_type": "crawl", "status": "queued",
  "poll_url": "/api/v1/jobs/019...", "estimated_files": null } }
```

## 2. Endpoint catalogue

Base: `/api/v1`. `A` = assessor, `L` = lsp_admin, `T` = tuk_admin, `S` = super_admin,
`V` = viewer. All endpoints require auth unless marked `public`.

### 2.1 Auth & users

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | — | Supabase Auth sign-in (delegates to GoTrue; returns session) |
| `POST` | `/auth/logout` | auth | Sign out, revoke refresh token |
| `POST` | `/auth/mfa/enroll` | A,L,S | Enrol TOTP MFA |
| `POST` | `/auth/mfa/verify` | A,L,S | Verify MFA challenge |
| `GET` | `/auth/me` | auth | Current user profile + role + organisation |
| `GET` | `/users` | L,S | List users in the org (paginated) |
| `PATCH` | `/users/{id}` | L,S | Change role / `is_active` (never self-demote the last admin) |
| `GET` | `/assessors` | A,L,S | List assessors (filter `?scheme=AK3U&is_active=true`) |
| `POST` | `/assessors` | L,S | Create assessor profile (No. Reg MET required) |
| `GET` | `/assessors/{id}` | A,L,S | Assessor detail incl. assignments + assessor-side name-match status |
| `PATCH` | `/assessors/{id}` | L,S | Update profile (titles, schemes) |

### 2.2 Organisations, schemes, config

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/organisations/{id}` | auth | LSP/TUK detail |
| `GET` | `/schemes` | auth | List schemes for the org |
| `POST` | `/schemes` | L,S | Create scheme (code, SKKNI ref; `kkni_level` nullable — UNCONFIRMED) |
| `GET` | `/schemes/{id}/versions` | auth | Scheme versions (MUK version, pass mark, legal refs) |
| `POST` | `/schemes/{id}/versions` | L,S | New scheme version (units + mapping seeded from the scheme doc). **v1.4 (D13/D17): scheme registration happens ONCE per scheme — the call takes the scheme document + the scheme's blank forms and builds the per-scheme manifest (`scheme_form_manifest` + `scheme_versions` question counts, decision-rule ref, prerequisites, registration requirements)** |
| `GET` | `/schemes/{scheme_version_id}/units` | auth | Units + elemen + KUK tree (nested) |
| `GET` | `/schemes/{scheme_version_id}/form-mapping` | auth | `form_version_mapping` (06A/06B/06C meaning for this version) |
| `GET` | `/schemes/{scheme_version_id}/manifest` | auth | **v1.4 (D17)** The scheme's file manifest: forms, file patterns, required flags, instrument roles, question counts, decision-rule reference, prerequisites, registration requirements |
| `PUT` | `/schemes/{scheme_version_id}/manifest` | L,S | **v1.4 (D17)** Set/replace the manifest (validated: one entry per `form_key`; question counts are integers ≥ 1; `decision_rule_ref` names the scheme document section). Changing a manifest never rewrites past batches — it applies to batches created after the change |
| `PUT` | `/schemes/{scheme_version_id}/form-mapping` | L,S | Set suffix mapping (validated: one meaning per suffix) |
| `GET` | `/config` | auth | `app_config` (readable keys only; secrets never exposed) |
| `PATCH` | `/config/{key}` | L,S | Update one config key (audited; e.g. per-scope similarity thresholds, `llm.batch_budget_usd`, `identity.trigram_threshold`) — prompt **text** is never a config key; prompts live in the registry (§2.13). **v1.4 (D18/D21):** provider/model keys live under `llm.*` (`llm.provider`, `llm.base_url`, `llm.model`, `llm.api_key_ref` — a reference, never the key itself); `question_bank.default_count` is per-scheme (manifest), not a global config key |

### 2.3 Batches & groups

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/batches` | A,L,S | List batches (`?status=&scheme_id=&from=&to=`) |
| `POST` | `/batches` | L,S | Create batch: scheme version, TUK, date, Drive folder URL, sheet id. **v1.4 (D13): the batch takes only the batch inputs — Drive link(s) + Kelompok Asesi (link or .xlsx). The scheme and its scheme-level forms come from the registered manifest; the caller never re-uploads them** |
| `GET` | `/batches/{id}` | A,L,S | Batch detail + counts (assessees, docs, gaps, decisions) |
| `PATCH` | `/batches/{id}` | L,S | Update title/venue/status (status transitions validated, §7) |
| `POST` | `/batches/{id}/close` | L,S | Close batch: computes `retention_until`, blocks if decisions/AK.05 incomplete |
| `GET` | `/batches/{id}/groups` | A,L,S | Assessment groups (11 + 12 in the reference batch) |
| `POST` | `/batches/{id}/groups` | L,S | Create group (group_no, assessor, scheduled_at) |
| `GET` | `/batches/{id}/assessees` | A,L,S | Assessees in the batch (assessor sees only their group) |
| `POST` | `/batches/{id}/assessees/import-sheet` | L,S | Import the Kelompok Asesi sheet (async job; see §3.8) |
| `GET` | `/batches/{id}/completeness` | A,L,S | APL-completeness matrix (replaces the live Google Sheet tracker) |

### 2.4 Drive ingestion & triage

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `POST` | `/batches/{id}/ingest` | A,L,S | Start a Drive crawl: `{drive_folder_url, idempotency_key, scope}` → `202` + job. `scope` (`batch`/`own_group`, default `batch` for `lsp_admin`, `own_group` for an assessor) limits which files the caller may crawl — see §2.4 note below |
| `GET` | `/jobs/{id}` | A,L,S | Job status + progress (`total_files`, `done_files`, `failed_files`) |
| `GET` | `/jobs` | A,L,S | List jobs for a batch (`?batch_id=…&job_type=crawl`) |
| `POST` | `/jobs/{id}/pause` | A,L,S | Pause a running crawl (resume from `next_page_token`) |
| `POST` | `/jobs/{id}/resume` | A,L,S | Resume a paused/failed crawl (skips `done` files) |
| `POST` | `/jobs/{id}/cancel` | A,L,S | Cancel (in-flight file jobs finish or are marked cancelled) |
| `GET` | `/batches/{id}/drive-files` | A,L,S | Paginated Drive file tree (`?status=&mime=&cursor=`; `status=unassigned` lists the triage queue) |
| `GET` | `/drive-files/{id}` | A,L,S | One file: metadata, classification, extracted-text summary |
| `POST` | `/drive-files/{id}/retry` | A,L,S | Re-queue one failed file |
| `POST` | `/drive-files/{id}/classify` | A,L,S | Manual classification override (assessor maps an unmatched file) |
| `GET` | `/batches/{id}/triage` | A,L,S | **v1.1** Triage queue: unassigned files + unassigned assessees + proposed assignments with confidence (`?status=proposed&assessor_id=`) |
| `POST` | `/batches/{id}/triage/assign` | A,L,S | **v1.1** Confirm/reject a proposed assignment `{triage_assignment_id, action: "confirm"\|"reject", assessor_id?, assessee_id?}` (audited; a rejected proposal returns the file to the queue) |
| `POST` | `/batches/{id}/triage/assign-bulk` | A,L,S | **v1.1** Confirm many proposed assignments at once (one job per assignment internally; partial failures reported per item, never silently) |
| `POST` | `/batches/{id}/surat-tugas/parse-preview` | A,L,S | **v1.1** Parse a surat-tugas document and preview the assessor rows it implies (names as printed, trigram-matched against `assessors`, `match_status` per name) — preview only; nothing is written until the caller confirms via `POST /batches/{id}/groups` / assignments |

**Manifest validation (v1.4, D17).** Batch intake is validated against the scheme's manifest: every form the manifest marks `required` must be present (registered at scheme level for scheme-level forms; found in the Drive folder for per-batch filled copies). A missing required file → `422 MANIFEST_FILE_MISSING` with the missing `form_key`s listed; the batch stays `draft` until the file is supplied or the manifest is corrected by `lsp_admin`. The manifest — never a hard-coded AK3U file list — is what the classifier and the intake check read (doc 06 §2.4).

**Per-assessor ingest scoping (v1.1).** In v1.0 any assessor could start a
whole-batch crawl while RLS said "assessor sees only their group" — the two rules
disagreed during ingest. v1.1 resolves it: a crawl runs at batch scope only for
`lsp_admin`/`super_admin`; an assessor's crawl is scoped to `own_group` (files
already linked to their assessees, plus the triage queue they are allowed to claim
from). Files outside the caller's scope are crawled by the batch owner, and the
triage queue is how they are handed out. The crawl job row records its `scope`.

### 2.5 Documents & extracted text

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/assessees/{id}/documents` | A,L,S | Documents for an assessee, grouped by `doc_type` |
| `GET` | `/documents/{id}` | A,L,S | Document detail + linked `drive_file` + extracted text |
| `GET` | `/documents/{id}/text` | A,L,S | Extracted text (paginated by page; includes method + confidence per page) |
| `POST` | `/documents` | A,L,S | Register a directly-uploaded document (multipart → private bucket) |
| `PATCH` | `/documents/{id}` | A,L,S | Correct `doc_type` / `is_signed` / notes (audited) |
| `GET` | `/batches/{id}/unmatched` | A,L,S | Unmatched review queue (low-confidence / `tidak_terklasifikasi` files) |

### 2.6 Identity verification

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/batches/{id}/identity` | A,L,S | Identity-verification list for the batch (match/mismatch/needs_review + `similarity_score`) |
| `GET` | `/assessees/{id}/identity` | A,L,S | One assessee: KTP vs APL.01 vs surat-tugas vs ijazah (titles split prefix/suffix) |
| `PATCH` | `/assessees/{id}/identity` | A,L,S | Set `certificate_name`, `match_status`, notes (audited) |
| `POST` | `/assessees/{id}/identity/confirm` | A,L,S | Human confirmation of the certificate name (sets `confirmed_by/at`) |
| `GET` | `/batches/{id}/identity/assessors` | A,L,S | **v1.1** Assessor-side matching: surat-tugas names vs `assessors` profiles (`match_status`, `similarity_score`) |
| `POST` | `/assessor-assignments/{id}/match-confirm` | A,L,S | **v1.1** Human confirmation of an assessor-side name match |
| `POST` | `/assessees/{id}/identity/ocr-run` | A,L,S | **v1.2** Run KTP OCR on the assessee's KTP file (async job → `202` + job; see §3.16). The KTP image is read from the private `ktp-ids` bucket by the worker only; it is never returned in the response and never sent to any LLM |
| `GET` | `/assessees/{id}/identity/ocr-run/{run_id}` | A,L,S | **v1.2** One OCR run: status, per-field confidence, `extracted_fields` (name + confidence), `redacted_text`. **No NIK, address, phone, email or date/place of birth is ever returned** — the stored text is redacted before the row is written (doc 04 §4.13) |
| `GET` | `/assessees/{id}/identity/jury` | A,L,S | **v1.2** The latest name-jury verdict for the assessee: verdict, proposed certificate name, reasoning (Bahasa Indonesia), evidence per source, OCR + jury confidence, `assessor_confirmation` status |
| `POST` | `/assessees/{id}/identity/jury/confirm` | A,L,S | **v1.2** Assessor confirms the jury's proposal → it becomes `certificate_name` (`certificate_name_source='jury_proposed'`, `confirmed_by/at` set). Only the assigned assessor may confirm; a `needs_human` verdict has no proposal to confirm (409) |
| `POST` | `/assessees/{id}/identity/jury/override` | A,L,S | **v1.2** Assessor overrides with their own name + mandatory reason (`{certificate_name, override_reason}`) → `certificate_name_source='assessor_override'`, verdict `assessor_confirmation='overridden'` |

No endpoint returns a KTP image to an LLM or to an unauthorised role; KTP images are
served only as short-lived signed Storage URLs to the assigned assessor / `lsp_admin`.
**v1.3 certificate-name rule (D6 decided, closes OQ-06): the KTP is the authority.**
The certificate name is the KTP name verbatim. Surat tugas, APL.01, and ijazah are
compared AGAINST the KTP; discrepancies resolve to the KTP spelling — a jury
proposal on `mismatch_resolved` is ALWAYS the KTP spelling (see the Declan Rice
example in §3.16: surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" →
"Declan Rice Pangabean"). Abbreviation expansion uses the KTP only. When the KTP
itself is unclear or its OCR confidence is below threshold, the verdict is
`needs_human` and the assessor types the name from the image.
**v1.2 jury rule:** no endpoint writes a jury proposal into `certificate_name`
except the assessor's own confirm/override calls above. A jury verdict with
`assessor_confirmation='pending'` blocks AK.05 exactly like an unconfirmed name.

### 2.7 DIT route (FR.IA.04A / 04B)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/assessees/{id}/dit` | A,L,S | DIT submission for the assessee (scenario, kelompok pekerjaan, status) |
| `POST` | `/assessees/{id}/dit` | A,L,S | Create / link a DIT submission from a document |
| `POST` | `/assessees/{id}/presentations` | A,L,S | Record a presentation (transcript text or recording ref) |
| `GET` | `/assessees/{id}/presentations/{pid}` | A,L,S | Presentation + transcript |
| `POST` | `/dit/{id}/analyse` | A,L,S | **Async** gap analysis (RCTFA prompt): coverage matrix + gap questions + question bank (count per-scheme — 13 for AK3U) + readiness → `202` + job. **v1.1 completeness gate: returns 422 with `missing_documents` when FR.IA.04A, the presentation transcript, or the assessee profile is incomplete — analysis is deferred, never run on partial inputs (see §3.9)** |
| `GET` | `/dit/{id}/coverage` | A,L,S | Coverage matrix rows (Terpenuhi/Sebagian/Belum Dibahas) + summary counts |
| `PATCH` | `/dit/{id}/coverage/{row_id}` | A,L,S | Assessor override of a coverage status (AI suggestion preserved) |
| `GET` | `/dit/{id}/gap-questions` | A,L,S | Gap questions, labelled TS/TMS/CMS/JRES/TrS, grouped by kelompok pekerjaan |
| `POST` | `/dit/{id}/gap-questions/{qid}/answer` | A,L,S | Record the assessee's answer to a gap question |
| `GET` | `/dit/{id}/question-bank` | A,L,S | The question bank (count from the scheme manifest; 13 for AK3U). Labelled in the response as `assessor_bank` — never as FR.IA.04B |
| `POST` | `/dit/{id}/question-bank/regenerate` | A,L,S | Regenerate the bank (new `llm_run`; previous bank kept for audit) |
| `GET` | `/dit/{id}/readiness` | A,L,S | **v1.1** RCTFA Task 4 output: `readiness_pct`, strengths, critical gaps, follow-up actions, `readiness_recommendation` (free-text note only) |
| `GET` | `/dit/{id}/model-answers` | A,L,S | **v1.1** Model/expected answers for the bank questions — **assessor-only** (RLS: assigned assessor + `lsp_admin`; 403 otherwise; never returned to any candidate-facing caller) |
| `POST` | `/dit/{id}/model-answers/generate` | A,L,S | **v1.1** Generate model answers for the bank (async job; uses the active `gap_analysis` prompt version; stored in `model_answers`) |
| `GET` | `/presentations/{pid}/assessment-04b` | A,L,S | Official FR.IA.04B rows (Ya/Tdk per question). **v1.4 (D14): the form's built-in questions — 13 for AK3U (4 Kelompok Pekerjaan, one per unit) — scored from the DIT deck + presentation; the count is per-scheme (manifest)** |
| `POST` | `/presentations/{pid}/assessment-04b` | A,L,S | Score one 04B row (lingkup, kesesuaian, question, tanggapan, Ya/Tdk) |
| `PATCH` | `/presentations/{pid}/assessment-04b/{row_id}` | A,L,S | Correct a 04B row (audited) |

### 2.8 Portfolio route (IA.08 / IA.09 / IA.10 / IA.11)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/assessees/{id}/portfolio` | A,L,S | IA.08 checklist rows (evidence × VATM) |
| `POST` | `/assessees/{id}/portfolio` | A,L,S | Add a portfolio evidence row |
| `PATCH` | `/portfolio/{item_id}` | A,L,S | Set VATM flags / clarification needed |
| `GET` | `/portfolio/{item_id}/interview` | A,L,S | IA.09 interview Q&A for the item |
| `POST` | `/portfolio/{item_id}/interview` | A,L,S | Add an IA.09 question + record the answer |
| `POST` | `/portfolio/{item_id}/verify` | A,L,S | IA.10 third-party verification or IA.11 product review |

### 2.9 Written tests (IA.05 / IA.06)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/batches/{id}/tests` | A,L,S | Test sets for the batch (05A/06A questions + 05B/06B keys) |
| `POST` | `/batches/{id}/tests` | L,S | Create a test set (family, scheme version, questions + keys) |
| `POST` | `/batches/{id}/tests/{tid}/questions` | L,S | Add questions (bulk: `{questions: [...]}`) |
| `POST` | `/batches/{id}/tests/{family}/key-upload` | L,S | **v1.1** Upload the master-key file (06B/05B) as multipart. If the file is encrypted (OLE/Agile `.docx` — the real AK3U 06B blank is OLE-encrypted), the request must also carry `password` as a form field. **v1.3 (D12): if the file is NOT encrypted (plain OOXML — e.g. the AK3U working key), it is parsed directly; the `password` field is absent or ignored and is NEVER required for an unencrypted file.** Each scheme's 06B ships with a PASSWORD Excel file; the password is supplied by the assessor at runtime (the holder, OQ-14 answered in part) and is used once to decrypt in memory and is never stored, never logged, never persisted in any row. Wrong/missing password → `422` with `code: "KEY_PASSWORD_REQUIRED"` or `"KEY_PASSWORD_WRONG"` and the key row left in `blocked` state (see §3.14). No key text is extractable until a correct password is supplied (encrypted files only). |
| `GET` | `/assessees/{id}/tests/{family}` | A,L,S | One assessee's test + answers + verdicts |
| `POST` | `/assessees/{id}/tests/{family}/answers` | A,L,S | Submit answers (bulk per question; from manual entry or OCR) |
| `POST` | `/assessees/{id}/tests/{family}/grade` | A,L,S | **Async** AI grading vs the master key → `202` + job. Grading method per item: MC = deterministic letter match (no LLM); essay = deterministic exact match first, then LLM semantic judgement (doc 06 §5.2) |
| `GET` | `/assessees/{id}/tests/{family}/verdicts` | A,L,S | Per-item verdicts: AI recommendation + `score` + `coverage_pct` + `grading_method` + assessor K/BK |
| `PATCH` | `/tests/verdicts/{verdict_id}` | A,L,S | Assessor's per-item verdict (the decision; AI kept alongside) |
| `POST` | `/batches/{id}/tests/{family}/grade-all` | A,L,S | Grade all assessees in the batch (one job per assessee) |
| `GET` | `/assessees/{id}/tests/{family}/rollup` | A,L,S | **v1.1** Per-unit roll-up of the written test (see §3.15): per unit, the AI's VATM recommendation (`K`/`BK`/`undecided`) + VATM reasoning + the assessor's confirm/override state. **v1.4 (D16): the AI judges VATM sufficiency per unit; the assessor confirms/overrides via the decisions endpoint (§2.11).** |

**Per-unit roll-up rule (v1.4, D16 — ANSWERS OQ-04; replaces the v1.3 default).**
The rule is the scheme's own: AK3U scheme §9.3.3–9.3.4 — evidence meeting VATM
is recommended "Kompeten", otherwise "Belum Kompeten"; NO numeric pass mark.
**The AI judges VATM sufficiency per unit** from the per-question verdicts
(Benar / Sebagian / Salah + Bahasa Indonesia explanation) plus the other
evidence methods for that unit, and recommends K/BK; **the assessor confirms or
overrides** (confirm = `POST /assessees/{id}/decisions` with the AI's
recommendation; override = the same call with a different value + reason —
doc 04 §4.10). The roll-up record stores the AI's recommendation, its VATM
reasoning per unit, and the assessor's confirm/override (audit-logged). Any
undecided item leaves the unit `undecided` (and blocks AK.02 for that assessee).
The roll-up endpoint returns the recommendation + VATM reasoning +
assessor-confirmation state and the undecided items; it never invents a pass/fail
for the test as a whole, and any coverage % returned on the per-item verdicts is
informational only, never the pass/fail. `scheme_versions.pass_mark` stays
nullable; `pass_rule` / `decision_rule` hold the per-scheme rule reference.

### 2.10 Similarity & combined report

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `POST` | `/batches/{id}/similarity/run` | A,L,S | **Async** pairwise similarity for a scope (`dit` or `written_test`) → `202` + job. Thresholds are per-scope config keys |
| `GET` | `/batches/{id}/similarity` | A,L,S | Flagged pairs, sorted by `combined_score` desc (`?scope=&flag_level=&min_score=`). Pairs are returned by **pseudonym** in this payload |
| `GET` | `/similarity/{pair_id}` | A,L,S | Pair detail + shared spans / identical errors |
| `POST` | `/similarity/{pair_id}/review` | A,L,S | Assessor review note (flag acknowledged / dismissed, with reason) |
| `GET` | `/batches/{id}/written-report` | A,L,S | **v1.1** The single combined written-test report (Markdown, Bahasa Indonesia): per-participant summary tables (06C vs 06B, per question: verdict, explanation, side-by-side master vs student quotes) + **per-student error summary ("Ringkasan Kesalahan" — the question numbers wrong per student, v1.3)** + **a SEPARATE qualitative plagiarism section (per-assessee status Bersih / Waspada + reasoning, v1.3 — never a numeric plagiarism verdict)**. **The report carries NO overall percentage as a decision** (v1.3); per-question coverage % is informational only. Generated from `combined_reports`; `?format=md\|docx`. **v1.2: PDF is no longer offered** — the combined report is a generated document, not AK.05 (export rule, §3.18). **Names are resolved to real names in this report** (it is an assessor document, RLS-gated to the batch's assessors + `lsp_admin`/`tuk_admin`) — the pseudonym rule applies to LLM payloads, not to this report (see doc 06 §4.5) |
| `POST` | `/batches/{id}/written-report/generate` | A,L,S | **v1.1** (Re)generate the combined report (async job; stores a new `combined_reports` row per prompt version) |

Similarity output is a **flag with evidence**, never a verdict; no endpoint can
auto-fail an assessee from a similarity score. **v1.4 (D19): the flag fires on a per-scope NUMERIC threshold and carries its evidence (spans, shared unique errors); the qualitative Bersih / Waspada report stays the human-facing summary. Threshold VALUES stay UNCONFIRMED (calibration).**

### 2.11 Decisions, AK.05, exports

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/assessees/{id}/decisions` | A,L,S | FR.AK.02 per-unit decisions for the assessee |
| `POST` | `/assessees/{id}/decisions` | A,L,S | Record a per-unit K/BK decision (idempotent per unit) |
| `PATCH` | `/decisions/{id}` | A,L,S | Correct a decision (audited; previous value kept in `audit_log`) |
| `GET` | `/batches/{id}/ak05` | A,L,S | AK.05 reports for the batch (one per assessor) |
| `POST` | `/batches/{id}/ak05` | A,L,S | Create/draft the caller's AK.05 from their decisions. **Row scope: only the assessees the caller actually assessed** (their `assessee_group_members`) — never the whole batch |
| `GET` | `/ak05/{id}` | A,L,S | AK.05 detail + rows (assessee, recommendation K/BK, keterangan) + status history |
| `PATCH` | `/ak05/{id}` | A,L,S | Edit notes / row keterangan (draft only) |
| `POST` | `/ak05/{id}/sign-off` | A,L,S | **v1.1** Assessor sign-off: records `signed_by/at` + `sign_off_note` (attestation that the rows match the underlying AK.02 records). **v1.2: sign-off applies the caller's ACTIVE signature** to the AK.05 signature block (a `document_signatures` row, doc 04 §4.13) — the signature applied is the version active at sign-off time. Blocked with `422 NO_ACTIVE_SIGNATURE` while the assessor has no active signature. Draft → signed draft (still editable only by re-opening, which is audited; re-opening voids the applied signature and requires a fresh sign-off) |
| `POST` | `/ak05/{id}/submit` | A,L,S | Submit to TUK/LSP — **blocked (422) while any certificate name is unconfirmed or any assigned assessee lacks a decision. v1.2: also blocked while the assessor has no active signature** (`NO_ACTIVE_SIGNATURE`) — the submitted AK.05 must carry the assessor's signature |
| `POST` | `/ak05/{id}/accept` | T,L,S | **v1.1** TUK/LSP accepts the submitted AK.05 (`status=accepted`, `reviewed_by/at`). Only the receiving side may accept |
| `POST` | `/ak05/{id}/return` | T,L,S | **v1.1** TUK/LSP returns the AK.05 with `returned_reason` (`status=returned`). The assessor then re-drafts (a new version linked by `resubmission_of`) and re-submits; the returned version is never edited in place |
| `POST` | `/ak05/{id}/export` | A,L,S | **Async** export → `202` + job, then a signed URL. **v1.2 export rule: `format` must be `pdf` or `docx`** (AK.05 is the only artefact with a PDF builder). Layout follows the real AK3U blank (§2.11 note below) |
| `POST` | `/exports` | A,L,S | Generic async export: `{kind: "04b"\|"06"\|"ak05"\|"batch_report"\|"written_report"\|"audit_log"\|"completeness", format, ...}`. **v1.2 format validation:** `ak05` → `pdf` or `docx`; `audit_log` and `completeness` **data extracts** → `xlsx`; every other kind (a generated **document**) → `docx` only. Any other combination → `422 EXPORT_FORMAT_NOT_ALLOWED` (see §3.18) |
| `GET` | `/exports/{job_id}` | A,L,S | Export job status + signed download URL (1 h) when done |

**AK.05 layout (v1.1 — validated against the real blank).** Header: Skema
Sertifikasi Judul + Nomor (per scheme version), TUK (Sewaktu/Tempat
Kerja/Mandiri), Nama Asesor, Tanggal. Table `No. | Nama Asesi | Rekomendasi
(K | BK) | Keterangan` — BK rows must carry the unit code + title that was BK.
Then `Aspek Negatif dan Positif dalam asesmen`, `Pencatatan penolakan hasil
asesmen`, `Saran perbaikan (Asesor/personil terkait)`, signature block
(Nama, No. Reg, Tanda tangan & tanggal — filled with the assessor's active
signature image at sign-off, §2.14). **Export format (D8) DECIDED in v1.2:
AK.05 = PDF + DOCX; every other generated document = DOCX only; XLSX only for
tabular data extracts** — the endpoint accepts `format` and validates it against
`app_config` (`export.ak05_formats`, `export.document_formats`,
`export.data_formats`); the template is versioned in `app_config
export.ak05_template`.

### 2.12 Jobs, audit, webhooks

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/jobs/{id}` | A,L,S | Any job's status (shared with §2.4) |
| `GET` | `/audit-log` | L,S | Audit trail (`?entity_type=&entity_id=&actor_id=&from=&to=`, cursor-paginated) |
| `GET` | `/llm-runs` | L,S | LLM runs for a batch/assessee (prompt version, model, tokens, cost) |
| `GET` | `/llm-runs/{id}` | L,S | One run: raw + structured output (audit/replay) |
| `POST` | `/webhooks/drive` | worker | Reserved: Drive push notifications (not in v1; polling is the v1 mechanism) |

### 2.13 Prompt registry (v1.1)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/prompts` | A,L,S | List prompt templates (`?scheme_id=&form_family=`; assessors see key + current version + title, not the full text of versions they may not edit — full text is returned to `lsp_admin`/`super_admin` and to the worker) |
| `GET` | `/prompts/{key}` | A,L,S | One template + its current approved version metadata |
| `GET` | `/prompts/{key}/versions` | L,S | All versions of a template (draft/approved/superseded, with `text_hash`) |
| `GET` | `/prompts/{key}/versions/{version}` | L,S | Full prompt text of one version (audited read) |
| `POST` | `/prompts/{key}/versions` | L,S | Create a new draft version `{prompt_text, source_file, adaptation_notes}` (new semver; `text_hash` computed server-side) |
| `POST` | `/prompts/{key}/versions/{version}/approve` | L,S | Approve a draft → it becomes the template's current version; the previous current version becomes `superseded`. Changing the current version never rewrites past `llm_runs` |
| `POST` | `/prompts/{key}/versions/{version}/deprecate` | L,S | Deprecate a superseded version (it stays readable for audit) |

There is **no DELETE endpoint for prompt versions**. Deleting a version that any
`llm_run` references returns `409 CONFLICT`; even an unused draft is soft-retired
via `deprecate`, never hard-deleted, so the audit trail stays complete. Prompt
**text** is never edited in place: a correction is a new version. Seed versions:
`gap_analysis.v1` (from `prompt_wawancara_k3.md`, RCTFA) and `written_grading.v1`
(from `prompt_test_tulis.md`), each carrying `adaptation_notes` that record the
v1.1 defaults (binary K/BK; bank labelled separately from official 04B; model
answers assessor-only).

### 2.14 Assessor signatures (v1.2)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `POST` | `/assessors/me/signature` | A | Upload the caller's signature image (multipart, PNG only). Validates MIME + size (config `signature.max_size_mb`, value UNCONFIRMED) + content hash; a virus-scan hook runs here if a scanner is configured (none chosen — UNCONFIRMED, see §8). Uploading a new signature **supersedes** the previous active one (same transaction; old version retained, never overwritten). Returns the new signature's metadata (never the image bytes in the JSON) |
| `GET` | `/assessors/me/signature` | A | The caller's ACTIVE signature: metadata + a short-lived signed preview URL (15 min). `404` with `code: "NO_ACTIVE_SIGNATURE"` while none exists |
| `GET` | `/assessors/me/signature/history` | A | All of the caller's signature versions (active, superseded, deactivated) with timestamps — never another assessor's |
| `POST` | `/assessors/me/signature/deactivate` | A | Deactivate the active signature (no replacement). The assessor can no longer sign off or export assessor-signed documents until a new one is uploaded; documents already signed keep the version applied at their sign-off |
| `GET` | `/assessors/{id}/signature` | L,S | `lsp_admin` audit read: metadata only (owner, active version, timestamps) — the image bytes are served only to the owner, on an audit-logged request |

**Rules.** A signature belongs to exactly one assessor (`signatures.user_id`).
The sign-off endpoint (`POST /ak05/{id}/sign-off`, §2.11) applies **the caller's
own active signature** — the service checks `signature.user_id = auth.uid()` and
the AK.05 owner before writing the `document_signatures` row; applying another
assessor's signature is impossible by construction (RLS + service check, doc 04
§6). A signature is never returned in a list payload, never embedded in export
metadata, and never written to any log. **Assessee signatures are out of scope:**
no endpoint uploads or applies an assessee's signature — assessee signature cells
stay blank in generated exports (wet signature on the scanned original).

### 2.15 LLM provider settings (v1.4, D18 — provider-agnostic, free-first, BYOK)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `GET` | `/llm/provider` | A,L,S | The org's LLM provider config: `provider`, `base_url`, `model`, `fallback_model`, `temperature` per prompt family, `api_key_ref` (a reference only — **the key itself is never returned**), `api_key_configured` boolean |
| `PATCH` | `/llm/provider` | L,S | Set the provider config `{provider, base_url?, model, fallback_model?, temperature?}`. Providers: `anthropic` / `openai-compatible` / `gemini` / `openrouter` / `omnirouter` / `9router` / `nvidia-nim` / other OpenAI-compatible gateways. The API key is supplied in a separate call and is **never stored in the DB in plaintext** — only the reference (`llm.api_key_ref`) is stored; the key is kept locally (browser) and sent per request. Changing the provider/model needs no code change and never rewrites past `llm_runs` |
| `POST` | `/llm/provider/api-key` | L,S | Supply / rotate the provider API key (request body only, TLS). The key is stored as a reference (`llm.api_key_ref`); the response returns the reference, **never the key**. The key is never logged, never committed, never in an env file |
| `POST` | `/llm/provider/test` | L,S | Test the configured provider with a tiny probe call (e.g. a 1-token completion). Returns `{ok, provider, model, latency_ms}` — **never echoes the key or any part of it**. A failed test returns the provider's error class (auth / rate-limit / unreachable) without the key |

**Rules.** There is NO primary model: the model is runtime config (`llm.model`). Temperature is per prompt family in config — grading/jury = 0 (deterministic); Moza's Test Grader uses 0.9 as its own default, not the grading default. Free tiers are usable per provider; **no provider is claimed free** — pricing per provider is out of scope for this doc and must be re-verified on the chosen provider's pricing page before budgeting. The provider's DPA / data-retention terms are UNCONFIRMED per provider; verify before the first live batch.

## 3. Request / response examples

### 3.1 Start a Drive crawl

```http
POST /api/v1/batches/019.../ingest
Authorization: Bearer <jwt>
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "drive_folder_url": "https://drive.google.com/drive/folders/1UrsbAjehLDuK3fHk2HItPgziWN8TOchy",
  "job_type": "crawl", "max_depth": 3, "scope": "batch" }
```

```json
// 202 Accepted
{ "ok": true, "data": { "job_id": "019...", "job_type": "crawl", "status": "queued",
  "poll_url": "/api/v1/jobs/019..." } }
```

### 3.2 Job status (poll)

```json
// GET /api/v1/jobs/019...
{ "ok": true, "data": { "job_id": "019...", "job_type": "crawl", "status": "running",
  "total_files": 184, "done_files": 97, "failed_files": 2,
  "next_page_token": "CAEQ...", "updated_at": "2026-11-17T15:04:00Z" } }
```

### 3.3 DIT gap analysis (async)

```http
POST /api/v1/dit/019.../analyse
Idempotency-Key: <uuid>
{ "include_question_bank": true, "question_bank_count": 13 }
```

```json
// 202 Accepted — result appears under GET /dit/{id}/coverage etc. when the job is done
{ "ok": true, "data": { "job_id": "019...", "job_type": "llm_gap_analysis", "status": "queued",
  "poll_url": "/api/v1/jobs/019..." } }
```

### 3.4 Coverage matrix (result)

```json
{ "ok": true, "data": {
  "dit_submission_id": "019...",
  "assessee_pseudonym": "ASESI-007",
  "summary": { "terpenuhi": 9, "sebagian": 3, "belum_dibahas": 2, "coverage_pct": 64 },
  "rows": [ { "id": "019...", "kelompok_pekerjaan": "Merancang Strategi Pengendalian Risiko K3",
    "focus_point": "Identifikasi bahaya di area kerja",
    "status": "sebagian", "evidence_quote": "…",
    "assessor_override_status": null, "llm_run_id": "019..." } ] } }
```

### 3.5 Written-test grading result

```json
{ "ok": true, "data": { "written_test_id": "019...", "test_family": "ia06",
  "items": [ { "question_no": 1,
    "ai_verdict": "partial",
    "score": 66.67, "points_covered": 2, "points_total": 3, "coverage_pct": 66.67,
    "grading_method": "llm_semantic",
    "ai_explanation": "Jawaban menyebut dua dari tiga poin kunci …",
    "ai_master_quote": "…", "ai_answer_quote": "…",
    "assessor_verdict": null, "assessor_kbk": null } ],
  "llm_run_id": "019..." } }
```

**v1.3:** `score` and `coverage_pct` on a per-item verdict are **informational
only** — they describe how much of the key the answer covered; they never decide
K/BK. The decision is the verdict (Benar / Sebagian / Salah) plus the assessor's
per-item `assessor_kbk` and the AI's VATM roll-up judgement per unit, confirmed by
the assessor (v1.4, D16 — see §3.15). No overall
percentage is returned as a pass/fail anywhere in this API.

### 3.6 Similarity pair

```json
{ "ok": true, "data": { "pair_id": "019...", "scope": "written_test", "question_no": 3,
  "assessee_a_pseudonym": "ASESI-004", "assessee_b_pseudonym": "ASESI-011",
  "jaccard": 0.81, "tfidf_cosine": 0.87, "embedding_cosine": 0.90,
  "combined_score": 0.86, "flag_level": "high",
  "spans": [ { "span_type": "identical_error", "span_a": "…", "span_b": "…" } ] } }
```

**v1.4 (D19):** `flag_level` comes from the per-scope NUMERIC thresholds (`similarity.*.flag_threshold` / `review_threshold` — VALUES UNCONFIRMED, calibration) applied to `combined_score`, WITH the spans as evidence; the qualitative Bersih / Waspada summary is the human-facing reading of the same flag, not a second verdict.
Real names are **never** returned in similarity / LLM payloads — pseudonyms only.
The assessor resolves a pseudonym to a name in the UI (same org, same batch, RLS).
**Exception (v1.1):** the combined written report (§3.10) is an assessor document
and resolves real names — the pseudonym rule governs LLM inputs and similarity
API payloads, not the final report the assessor signs.

### 3.7 AK.05 submit — blocked

```json
// 422 Unprocessable Entity
{ "ok": false, "error": { "code": "UNPROCESSABLE",
  "message": "AK.05 belum dapat diserahkan: 3 nama sertifikat belum dikonfirmasi",
  "details": [ { "assessee_pseudonym": "ASESI-002", "issue": "certificate_name_unconfirmed" },
               { "assessee_pseudonym": "ASESI-009", "issue": "decision_missing", "unit": "M.71KKK01.005.1" } ] } }
```

### 3.8 Sheet import (Kelompok Asesi)

```http
POST /api/v1/batches/019.../assessees/import-sheet
{ "sheet_id": "1AqNMp-YU4x1R9RHESo45WYGI-BZtYodUK-dPzvpPDbQ", "gid": "1739959540" }
```

The worker exports the sheet as CSV (`/export?format=csv&gid=…`), parses the merged
3-row header, reads checkbox TRUE/FALSE, splits the single-cell newline list in the
Kelompok Asesi tab, and joins tabs on the **normalised assessee name** (not row order).
Result: per-row import report (`created`, `matched`, `unmatched[]`, `gaps[]`).
**Ordering rule (v1.1): the sheet import must complete before the Drive crawl
classifies files** — the name join is what lets a flat shared folder be split by
assessee (doc 06 §2.6). If a crawl starts first, its files sit in `unassigned`
until the sheet lands, and triage then assigns them.

### 3.9 DIT analysis — completeness gate (v1.1)

```json
// 422 Unprocessable Entity — POST /dit/{id}/analyse with incomplete inputs
{ "ok": false, "error": { "code": "UNPROCESSABLE",
  "message": "Analisis ditunda: bahan belum lengkap",
  "details": [
    { "assessee_pseudonym": "ASESI-007", "issue": "missing_document", "document": "FR.IA.04A", "detail": "dokumen 04A belum terklasifikasi" },
    { "assessee_pseudonym": "ASESI-007", "issue": "missing_document", "document": "transcript", "detail": "transkrip presentasi belum ada" },
    { "assessee_pseudonym": "ASESI-007", "issue": "missing_document", "document": "profile", "detail": "CV belum terunggah" } ] } }
```

The gate checks, per assessee: an FR.IA.04A document classified + extracted; a
presentation transcript (or a recording reference marked for transcription); and
the profile inputs the prompt needs (CV / education / work history — at least the
fields the RCTFA prompt's profile summary requires). The response lists exactly
what is missing, so the assessor can complete it. **Analysis is deferred, never
run on partial inputs, and never invents coverage for a missing focus point.**
A successful gate returns `202` as in §3.3.

### 3.10 Combined written report (v1.1)

```http
GET /api/v1/batches/019.../written-report?format=md
```

```markdown
# Laporan Penilaian Tertulis — Ahli K3 Umum — 12 November 2026
## Ringkasan per Asesi
| No. | Nama Asesi | Benar | Sebagian | Salah | Catatan |
|-----|------------|-------|----------|-------|---------|
| 1 | … | 9 | 3 | 1 | … |
## Ringkasan Kesalahan (v1.3)
- …: Nomor 6, 9, 10 — jawabannya masih kurang tepat.
- …: Nomor 6, 10 — jawabannya masih kurang tepat.
### Asesi 1 — … (per-question table, Bahasa Indonesia, side-by-side master vs student quotes)
## Analisis Kemiripan Antar Asesi (v1.3 — separate qualitative report)
- …: Bersih — jawaban orisinal, tidak ditemukan pola menyalin.
- …: Waspada — kesamaan definisi pada Soal 1 dengan …; penjabaran soal-soal lain berbeda, indikasi belajar dari modul yang sama, bukan menyalin jawaban.
- Soal 3: … berbagi jawaban identik dengan … (indikasi menyalin — kesalahan unik yang sama: …)
- Soal 7: kemiripan … dinilai kebetulan (frasa baku dari materi pelatihan)
```

**v1.4 (D19):** the report carries BOTH the numeric flag (per-scope threshold, with the flag_level and combined_score) AND the qualitative Bersih / Waspada section — the number is the triage signal, the qualitative section is the human-facing summary.
The Markdown is stored verbatim in `combined_reports.report_markdown` and rendered
to DOCX by the export pipeline (v1.2 export rule — DOCX only, never PDF). The
per-participant tables come from `test_item_verdicts` (deterministic + LLM); the
**"Ringkasan Kesalahan" is generated deterministically from the verdicts** — per
assessee, the question numbers whose verdict is incorrect (wrong), listed with the
stored Bahasa Indonesia explanation already on each item; the LLM does not invent
it. The **similarity section is a SEPARATE qualitative report** (v1.3): per-assessee
status Bersih / Waspada + reasoning, and the cross-student patterns (question
numbers, named pairs, coincidental vs indicative of copying, shared unique
errors) — it is never a numeric plagiarism verdict and never a pass/fail. **The
report carries NO overall percentage as a decision.** Regeneration creates a new
row per prompt version.

### 3.11 Prompt registry (v1.1)

```http
POST /api/v1/prompts/gap_analysis/versions
{ "prompt_text": "…", "source_file": "research/prompts/prompt_wawancara_k3.md",
  "adaptation_notes": "Removed 'Kompeten Bersyarat' as a decision value (binary K/BK per v1.1 default D2); bank labelled separately from official 04B (D3)." }
```

```json
// 201 Created
{ "ok": true, "data": { "template_key": "gap_analysis", "version": "1.1.0",
  "status": "draft", "text_hash": "sha256:…" } }
```

```json
// 409 Conflict — deleting a used version
{ "ok": false, "error": { "code": "CONFLICT",
  "message": "Versi prompt sudah dipakai 14 llm_runs dan tidak dapat dihapus" } }
```

### 3.12 AK.05 return & resubmit (v1.1)

```http
POST /api/v1/ak05/019.../return
{ "returned_reason": "Keterangan baris 4 belum menuliskan kode unit yang BK." }
```

```json
// 200 OK
{ "ok": true, "data": { "ak05_id": "019...", "status": "returned",
  "reviewed_by": "tuk_admin", "returned_reason": "Keterangan baris 4 …" } }
```

The assessor then creates a new draft via `POST /batches/{id}/ak05` with
`resubmission_of: "<returned ak05 id>"`; the returned version stays in the
history, unedited. `POST /ak05/{id}/accept` (TUK/LSP only) closes the loop.

### 3.13 Triage (v1.1)

```json
// GET /api/v1/batches/019.../triage?status=proposed
{ "ok": true, "data": [ { "triage_assignment_id": "019...",
  "drive_file_name": "DIT … .pptx", "drive_path": "Tugas DIT/…",
  "proposed_assessee_pseudonym": "ASESI-011", "proposed_assessor": "…",
  "source": "filename_match", "confidence": 0.91, "status": "proposed" } ],
  "meta": { "unassigned_files": 7, "unassigned_assessees": 2 } } }
```

### 3.14 Encrypted 06B key upload (v1.1) — unencrypted copy path (v1.3, D12)

```http
POST /api/v1/batches/019.../tests/ia06/key-upload
Content-Type: multipart/form-data
-- file: FR.IA.06B…docx (OLE-encrypted)
-- password: <supplied per-request>
```

```json
// 422 — wrong password
{ "ok": false, "error": { "code": "UNPROCESSABLE",
  "message": "Kata sandi kunci jawaban salah; berkas kunci belum dapat dibaca",
  "details": [ { "field": "password", "issue": "KEY_PASSWORD_WRONG" } ] } }
```

```http
POST /api/v1/batches/019.../tests/ia06/key-upload
Content-Type: multipart/form-data
-- file: FR.IA.06B…docx (plain OOXML, NOT encrypted — e.g. the AK3U working key)
```

```json
// 201 Created — unencrypted file: parsed directly, no password asked for
{ "ok": true, "data": { "test_id": "019...", "key_protection": "none",
  "questions": 13, "status": "ready" } }
```

**Two copies exist (v1.3).** The repo's SKEMA 06B blank is OLE-encrypted; the AK3U
working key is a plain OOXML docx that opens directly (verified 18 Nov 2026,
`research/06b-key-structure-2026-11-18.md`). The worker detects encryption first
(magic bytes) and branches: encrypted → the password path below; unencrypted →
parsed directly, `key_protection='none'`, and a `password` field — if one is sent
anyway — is ignored, never stored, never logged. **A password is NEVER required
for an unencrypted file**, and the client must not prompt for one.

The password is held in memory only for the decrypt call and is never written to
any table, log, or job payload. The key row is left in `blocked` state (visible to
the assessor as "kunci terkunci — masukkan kata sandi") until a correct password
is supplied. **Each scheme's 06B ships with a PASSWORD Excel file; the password
file is handled like any other assessor-supplied secret: per-request, never
stored, and it must never be committed to the repo** — the holder is the assessor,
who supplies the password at runtime (OQ-14 answered in part, v1.3).

### 3.15 Per-unit roll-up (v1.1)

```json
// GET /api/v1/assessees/019.../tests/ia06/rollup
{ "ok": true, "data": { "assessee_pseudonym": "ASESI-007", "test_family": "ia06",
  "units": [ { "unit_code": "M.71KKK01.001.1", "items": 2,
    "ai_recommendation": "K",
    "vatm_reasoning": "Bukti memenuhi VATM: jawaban benar untuk kedua soal unit ini dan didukung presentasi DIT.",
    "assessor_confirmation": "confirmed", "written_test_leg": "K" },
    { "unit_code": "M.71KKK01.005.1", "items": 1,
    "ai_recommendation": null, "vatm_reasoning": null,
    "assessor_confirmation": "pending", "written_test_leg": "undecided" } ],
  "note": "v1.4 (D16): tidak ada persentase keseluruhan sebagai keputusan — AI menilai kecukupan bukti VATM per unit dan merekomendasikan K/BK; asesor mengonfirmasi atau meng-override (OQ-04 terjawab)." } }
```

### 3.16 KTP OCR + name jury (v1.2)

```http
POST /api/v1/assessees/019.../identity/ocr-run
Idempotency-Key: <uuid>
{ "document_id": "019..." }   // the KTP file; the worker reads it from the private bucket
```

```json
// 202 Accepted — OCR runs in the worker (Tesseract ind+eng, doc 06 §3.5)
// GET /api/v1/assessees/019.../identity/ocr-run/019...
{ "ok": true, "data": { "ocr_run_id": "019...", "status": "done",
  "extracted_fields": { "nama": { "value": "…", "confidence": 0.93 } },
  "overall_confidence": 0.93,
  "redacted_text": "Nama …" } }
// No NIK, address, phone, email or date/place of birth appears anywhere in
// this payload — the stored OCR text is redacted before the row is written.
```

```json
// GET /api/v1/assessees/019.../identity/jury
// v1.3 (D6 decided): the proposal on mismatch_resolved is ALWAYS the KTP
// spelling. Illustration below uses Moza's own example (not a real assessee):
// surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean".
{ "ok": true, "data": { "verdict": "mismatch_resolved",
  "proposed_certificate_name": "Declan Rice Pangabean",
  "reasoning": "Nama pada surat tugas tertulis singkat 'Declan Rice P.'; nama pada KTP 'Declan Rice Pangabean'. KTP adalah otoritas nama sertifikat, jadi ejaan KTP yang dipakai.",
  "evidence": [ { "source": "ktp_ocr", "span": "Declan Rice Pangabean", "note": "Ejaan lengkap pada KTP — otoritas nama sertifikat" },
    { "source": "surat_tugas", "span": "Declan Rice P.", "note": "Nama keluarga disingkat; ejaan KTP yang dipakai" } ],
  "ocr_confidence": 0.93, "jury_confidence": 0.88,
  "assessor_confirmation": "pending",
  "prompt_version": "name_jury.v1", "llm_run_id": "019..." } }
// The proposal is NOT the certificate name yet. Only the assessor's confirm
// (POST .../identity/jury/confirm) or override (POST .../identity/jury/override
// {certificate_name, override_reason}) writes it — see §2.6. A proposal that is
// not the KTP spelling is a defect, not a judgement call.
```

```json
// 422 — OCR confidence below the configured threshold
{ "ok": false, "error": { "code": "OCR_LOW_CONFIDENCE",
  "message": "Hasil OCR KTP kurang meyakinkan — ketik nama dari gambar KTP",
  "details": [ { "assessee_pseudonym": "ASESI-007", "field": "nama",
    "confidence": 0.41, "threshold_key": "identity.ktp_ocr_min_confidence" } ] } }
```

### 3.17 Assessor signature upload + sign-off (v1.2)

```http
POST /api/v1/assessors/me/signature
Content-Type: multipart/form-data
-- file: tanda-tangan.png (image/png)
```

```json
// 201 Created
{ "ok": true, "data": { "signature_id": "019...", "is_active": true,
  "sha256": "…", "width_px": 480, "height_px": 160,
  "uploaded_at": "2026-11-17T16:50:00Z",
  "note": "Tanda tangan sebelumnya dinonaktifkan (tersimpan sebagai versi lama)." } }
```

```http
POST /api/v1/ak05/019.../sign-off
{ "sign_off_note": "Baris AK.05 sudah sesuai catatan AK.02." }
```

```json
// 200 OK — the caller's ACTIVE signature is applied to the AK.05 signature block
{ "ok": true, "data": { "ak05_id": "019...", "status": "signed",
  "signed_by": "019...", "signed_at": "2026-11-17T16:51:00Z",
  "signature_id": "019...", "signing_context": "ak05" } }
```

```json
// 422 — no active signature
{ "ok": false, "error": { "code": "NO_ACTIVE_SIGNATURE",
  "message": "Unggah tanda tangan terlebih dahulu sebelum menandatangani AK.05",
  "details": [ { "issue": "no_active_signature" } ] } }
```

### 3.18 Export format validation (v1.2)

```http
POST /api/v1/exports
{ "kind": "written_report", "format": "pdf", "batch_id": "019..." }
```

```json
// 422 — PDF is only built for AK.05 (D8 decided)
{ "ok": false, "error": { "code": "EXPORT_FORMAT_NOT_ALLOWED",
  "message": "Format PDF hanya tersedia untuk AK.05; dokumen lain diekspor sebagai DOCX",
  "details": [ { "field": "format", "requested": "pdf", "kind": "written_report",
    "allowed": ["docx"] } ] } }
```

Format matrix enforced by the endpoint (validated against `app_config`
`export.*_formats`):

| kind | pdf | docx | xlsx |
|---|---|---|---|
| `ak05` | ✅ | ✅ | ❌ |
| any other document kind (`04b`, `06`, `batch_report`, `written_report`) | ❌ | ✅ | ❌ |
| tabular data extract (`audit_log`, `completeness`) | ❌ | ❌ | ✅ |

### 3.19 LLM provider test (v1.4, D18)

```http
POST /api/v1/llm/provider/test
{ "probe": "ping" }
```

```json
// 200 OK — the key is never echoed, in whole or in part
{ "ok": true, "data": { "provider": "openai-compatible",
  "model": "deepseek-v4.1-flash", "latency_ms": 812,
  "api_key_configured": true, "api_key_ref": "llm_key_ref_01J..." } }
```

```json
// 422 — provider auth failed (key invalid/expired); the key is never logged
{ "ok": false, "error": { "code": "UNPROCESSABLE",
  "message": "Kunci API provider tidak valid — periksa di Settings → LLM provider",
  "details": [ { "field": "api_key", "issue": "invalid" } ] } }
```

## 4. Validation (Zod, server-side)

- Every Route Handler validates its body/query with a Zod schema **before** any DB
  call; failures return `400 VALIDATION_ERROR` with per-field details.
- Shared schemas live in `lib/validation/*.ts` (one file per resource); the same
  schemas validate LLM structured output where applicable (doc 06 §5).
- Rules enforced in validation, not just in the UI: `decision` ∈ {K, BK};
  `question_bank_count` 1–30; `drive_folder_url` must be a `drive.google.com` folder URL;
  `temperature` 0–1 (default 0); per-scope `combined_score` thresholds 0–1;
  `readiness_recommendation` is free text and is rejected if submitted as a
  `decisions.decision` value; `prompt_text` is required and non-empty on version
  create; `password` for an encrypted key upload is never echoed back in any response.
**v1.4 (D18/D21):** `llm.provider` must be a known provider id; `llm.base_url` a valid URL when present; `llm.model` non-empty; the API key is accepted only on `POST /llm/provider/api-key` and is **never returned, never logged, never stored in plaintext** — only `llm.api_key_ref` is stored. `question_bank_count` is validated against the scheme manifest's `question_bank_default_count` (per-scheme, not a global literal).
- Unknown fields are stripped (never stored); `null` vs absent is distinguished for
  PATCH (absent = unchanged).

## 5. Rate limits & quotas

| Scope | Limit | Notes |
|---|---|---|
| Authenticated API | 300 req/min per user | Burst 600; `429` + `Retry-After` |
| Ingest / LLM / export POSTs | 10/min per user | These create jobs; the queue is the real throttle |
| Worker → Drive API | Concurrency 5–10, backoff 1s→64s | Drive quota: 1,000,000 units/min/project; a 500-file folder ≈ 100,500 units — quota is not the bottleneck, time is |
| LLM calls | Per-batch budget cap in `app_config` (`llm.batch_budget_usd`) | Job fails closed (`402`-style `UNPROCESSABLE`) when the cap is hit, never silently. **Cap value UNCONFIRMED — the LSP sets it** |

## 6. Error handling & retries (client contract)

- `5xx` / `429` / network failure: retry with exponential backoff + jitter
  (1s, 2s, 4s, max 3 retries) **only for idempotent requests** (GET, or POST with an
  `Idempotency-Key`). Never retry a POST without a key.
- `202` jobs: poll every 3 s for the first minute, then every 10 s, up to 10 min;
  after that, show the job in the Jobs list (Realtime subscription preferred).
- A job that ends `failed` returns `last_error` + `attempt_count`; the client offers
  Retry (re-queue, same idempotency key) — the worker resumes from its checkpoint.

## 7. State machines (enforced server-side)

```
batch:     draft -> ingesting -> ready -> assessing -> decided -> reported -> closed
job:       queued -> running -> done | failed | cancelled ; running -> paused -> running
document:  pending -> classified -> verified | rejected ; any -> duplicate
dit:       received -> extracted -> analysed -> presented -> closed
test:      pending -> answered -> graded_ai -> graded_assessor -> closed
ak05:      draft -> signed -> submitted -> accepted | returned (-> draft [new version, resubmission_of] -> signed -> submitted)
prompt:    draft -> approved -> superseded ; approved versions are immutable
triage:    proposed -> confirmed | rejected ; rejected -> proposed (re-proposed by the next crawl/classification pass)
ocr_run:   queued -> running -> done | failed | low_confidence
jury:      pending -> confirmed | overridden ; needs_human is a verdict state, not a transition (a needs_human verdict has no proposal; the assessor types the name manually)
signature: (none) -> active -> superseded | deactivated ; superseded/deactivated versions are retained, never deleted
```

Illegal transitions return `409 CONFLICT`. `ak05.submit` additionally requires:
all assigned assessees decided (all 13 units, K/BK) **and** all certificate names
confirmed (§2.11, example §3.7) **and the submitting assessor has an active
signature (v1.2 — `422 NO_ACTIVE_SIGNATURE` otherwise)**. `ak05.accept` /
`ak05.return` are TUK/LSP-only; an assessor calling them gets `403 FORBIDDEN`.

## 8. Security notes (contract-level)

- No endpoint accepts a raw NIK, KTP image, or full address as an LLM input; the
  API strips PDP fields before enqueueing any LLM job (doc 06 §5.4 — redaction is
  a specified function in v1.1, not just a rule).
- File uploads: max 50 MB (Supabase Free limit), MIME allow-list per `doc_type`,
  virus-scan hook point (not in v1 — record the gap in the risk register).
- **Signature uploads (v1.2):** PNG only (`image/png`), size capped by config
  `signature.max_size_mb` (value UNCONFIRMED), content hashed (SHA-256) and
  stored under the owner's private bucket path. A virus-scan hook runs at upload
  if a scanner is configured — **none is chosen (UNCONFIRMED)**; until one is,
  validation is type/size/hash only and the gap stays in the risk register.
  Signature images are never returned in list payloads, never embedded in export
  metadata, and never written to any log. The `signatures` bucket has no public
  URLs and no listing; preview is a 15-minute signed URL for the owner only.
- **KTP OCR + jury (v1.2):** the KTP image is read by the worker from the private
  bucket and never leaves it; the OCR text is redacted (NIK, address, phone,
  email, date/place of birth stripped) before the `ocr_runs` row is written; the
  jury call receives redacted text + the four name strings under the assessee
  pseudonym — never the image, never a NIK. The jury's proposal is never written
  to `certificate_name` except by the assessor's own confirm/override call.
- **LLM provider key (v1.4, D18 — BYOK):** the provider API key is user-supplied at runtime (Settings → LLM provider), stored only as a reference (`llm.api_key_ref`); it is never in an env file, never in the repo, never in any log, never echoed by any endpoint (including the test endpoint, §3.19), and never in the DB in plaintext. Rotating the key updates the reference only; past `llm_runs` keep the model/provider recorded, never the key.
- Encrypted key uploads: the password is a per-request form field, never stored,
  never logged, never returned; the decrypted key text lives only in `test_keys`
  (assessor + `lsp_admin` RLS), and the source file's protection flag is recorded
  as `key_protection`.
- Signed Storage URLs expire in 1 h; KTP URLs in 15 min.
- Every mutating endpoint writes an `audit_log` row (actor, action, entity,
  before/after). Reads of KTP images, model answers, and exports are also logged.
- CORS: allow-list the app origin only; no wildcard. CSRF: Supabase SSR cookies
  (`httpOnly`, `SameSite=Lax`, `Secure` in production).

## 9. OpenAPI

A machine-readable OpenAPI 3.1 document is generated from the Zod schemas
(`lib/openapi.ts`, `GET /api/openapi.json` in non-production) and kept in
`docs/openapi.yaml`. It is generated, not hand-written — the Zod schema is the
source of truth. The tables in §2 are the human-readable contract; if they disagree
with the generated OpenAPI, the OpenAPI (and the code) wins and this doc is fixed.

## 10. Open questions

1. Does the LSP need a webhook (push) for job completion, or is polling + Realtime enough?
2. Should `tuk_admin` see assessee names, or pseudonyms only?
3. Export formats: DOCX only, or DOCX + PDF for every form? **DECIDED in v1.2
   (D8): AK.05 = PDF + DOCX; every other generated document = DOCX only; XLSX
   only for tabular data extracts.** Layout is validated against the real blanks;
   the format choice is closed.
4. Batch budget cap for LLM spend (`llm.batch_budget_usd`): who sets it, per batch or per org? **Value UNCONFIRMED.**
5. Per-scope similarity thresholds and the partial-credit cut
   (`grading.06.partial_min_coverage_pct`): **v1.4 (D19): numeric thresholds + details is the decided mechanism; the VALUES stay UNCONFIRMED (calibration on real batches).** The partial-credit cut stays UNCONFIRMED.
6. KTP OCR confidence threshold (`identity.ktp_ocr_min_confidence`) — **UNCONFIRMED (v1.2)**.
7. Jury confidence cut (`jury.min_confidence`) — **UNCONFIRMED (v1.2)**.
8. Signature upload virus scanning — no scanner chosen; **UNCONFIRMED (v1.2)**.
9. Signature legal standing — whether the LSP/BNSP accepts an uploaded signature
   image on the generated document as the signed original (vs a wet signature on
   the printed form) — **UNCONFIRMED (v1.2)**.
10. 06B key password holder + FR.IA.07-key fallback — **answered in part in v1.3
    (D12)**: each scheme's 06B ships with a PASSWORD Excel file; the holder is the
    assessor, who supplies the password at runtime (key-upload step) — never
    stored, never logged, never recorded. Whether the FR.IA.07 key text may serve
    as the fallback acceptable-points source when the 06B file is unavailable
    stays **UNCONFIRMED**.
11. Per-scheme manifests for schemes other than AK3U (e.g. Petugas K3: file set, question counts, decision rule, prerequisites, registration requirements) — **UNKNOWN; they come from that scheme's own scheme document and blank forms, never invented.** AK3U's manifest values are AK3U's only. Scheme-document currency (2021 scheme vs 2023 MUK) stays open (OQ-11).

---

*End of doc 05 v1.4. Next: `06-technical-design.md` (how each endpoint's pipeline works),
`12-system-design-document.md` (deployment, auth & security flow).*
