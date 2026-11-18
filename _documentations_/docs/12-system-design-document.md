# 12 — System Design Document — AsesorKompetensi

| Field | Value |
|---|---|
| System | AsesorKompetensi — LSP / BNSP assessor web app (OHSE-first, general certification) |
| Version | 1.4 — 2026-11-18 |
| Stack | Next.js App Router + TypeScript, Supabase (Postgres/Auth/Storage/pgvector), Vercel AI SDK, provider-agnostic BYOK LLM (no primary model, v1.4 D18), async worker on Railway/Fly/VPS, pg-boss queue (decided in v1.1) |
| Companion docs | `01-project-overview.md`, `02-prd.md`, `04-erd-database-design.md`, `05-api-contract.md`, `06-technical-design.md` |
| Research base | `research/bnsp-forms-brief.md`, `research/tech-stack-brief.md`, `research/drive-inventory-2026-11-17.md`, `research/form-blanks-extracted.md`, `research/v1.1-prep-decisions.md` |
| Language | Docs in English; Indonesian form names preserved. UI / AI reports in Bahasa Indonesia. |

> **Canonical decisions.** DIT = **Daftar Instruksi Terstruktur**. FR.IA.04A = DIT;
> official FR.IA.04B = presentation assessment; user's 13-question bank is a separate
> artefact (count per-scheme — manifest; AK3U's value is 13), always labelled "assessor's bank, not
> official FR.IA.04B". FR.IA.09 = interview form in the portfolio route (P1).
> 06A = soal / 06B = kunci / 06C = jawaban under MUK 2023 only — suffix mapping
> per-LSP configurable (confirmed for AK3U MUK 2023 against the real blanks).
> Decision binary **K / BK only**; a readiness recommendation is a free-text note,
> never a decision value. Model/expected answers are **assessor-only**; the system
> never drafts a candidate's answers. FR.AK.05 = per-assessor per-batch report, a
> recommendation to TUK/LSP, NOT the certification decision. AI is a recommendation
> only; similarity is a flag, never an auto-fail; identity human-confirmed.
> PDP UU 27/2022: NIK/KTP never to an LLM. AK3 Umum: SKKNI Kepmenaker 38/2019,
> 13 units M.71KKK01.001.1–013.1 — the scheme document is found ("SKEMA
> SERTIFIKASI OKUPASI AHLI K3 UMUM 2021", LSP HSE INDONESIA, 2022-12-01;
> `research/skema-ak3u-2021-extracted.md`): Jenis Skema KKNI/Okupasi/Klaster
> with NO numbered KKNI level; the decision rule is VATM (scheme §9.3.3–9.3.4,
> D16) — no numeric pass mark exists; fee Rp 2.000.000 (the LSP's fee); validity
> 3 years; recert min 2 months before expiry; surveillance min once a year;
> appeal max 3 days, decision max 7 working days. Scheme-doc currency vs the
> 2023 MUK stays open (OQ-11).
> **Repo constraint (v1.1): the GitHub repo is never a data store** — no assessee
> personal data in git; the repo holds code + docs only.
> Prototype Free; first live batch Supabase Pro $25/mo + hosting ~$30–50/batch-month.
> **v1.3 decisions (18 Nov 2026, Moza).** (1) **Certificate-name rule — DECIDED
> (D6, closes OQ-06): the KTP is the authority.** The certificate name is the KTP
> name verbatim; surat tugas, APL.01, ijazah are compared AGAINST the KTP and
> discrepancies resolve to the KTP spelling (Moza's example: surat tugas "Declan
> Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean"). A jury
> proposal on `mismatch_resolved` is ALWAYS the KTP spelling. (2) **Pass-mark
> shape — DECIDED (refines D7/OQ-04):** judging follows Moza's Test Grader app —
> per-question verdicts (Benar / Sebagian / Salah) + Bahasa Indonesia explanation,
> plus a per-student error summary ("Ringkasan Kesalahan"), plus plagiarism
> analysis as a SEPARATE qualitative report (Bersih / Waspada + reasoning, never
> a numeric verdict). NO overall percentage as the decision; roll-up default =
> assessor's judgement per KUK (OQ-04 open only for LSP confirmation of the
> default). **[SUPERSEDED in v1.4 by D16: the AI judges VATM sufficiency per unit
> and recommends K/BK; the assessor confirms or overrides — OQ-04 answered.]**
> (3) **06B password + key structure (D12; OQ-14 answered in part):**
> each scheme's 06B ships with a PASSWORD Excel file; the password is supplied by
> the assessor at runtime, never stored. Two copies exist — the repo's SKEMA 06B
> blank IS OLE-encrypted, the AK3U working key is a plain OOXML docx (verified
> 18 Nov 2026, `research/06b-key-structure-2026-11-18.md`); the extractor detects
> encryption first. The key's 13 answers are PROSE in one table plus 8 embedded
> images, which extraction must flag, never silently drop. **[v1.3 roll-up
> default SUPERSEDED in v1.4 by D16 — see the v1.4 decisions below.]** The
> reference apps (Test Grader; K3 Expert AI on Gemini 3 Pro) are behaviour
> references only.
> **v1.4 decisions (18 Nov 2026, Moza).** (1) **Upload flow (D13):** scheme +
> scheme-level forms (06A, 06B) registered ONCE per scheme; per batch only Drive
> link(s) + Kelompok Asesi (Drive link or .xlsx); filled 04A/04B/09 copies ingested
> FROM the Drive folder; direct upload is the fallback. (2) **FR.IA.04B official
> form (D14, closes OQ-02):** 4 Kelompok Pekerjaan, 13 built-in questions (one per
> unit), Ya/Tidak per KUK, binary recommendation; evidence = DIT task + presentation.
> (3) **No "Kompeten Bersyarat" (D15, closes OQ-03):** binary K/BK only.
> (4) **AI judges the roll-up, VATM-based (D16, answers OQ-04):** scheme
> §9.3.3–9.3.4 — evidence meeting VATM → "Kompeten", otherwise "Belum
> Kompeten"; NO numeric pass mark. The AI judges VATM sufficiency per unit and
> recommends K/BK; the assessor confirms or overrides. The roll-up record stores
> the AI's VATM reasoning per unit + the assessor's confirm/override. REPLACES
> the v1.3 default (assessor's judgement per KUK). (5) **Multi-scheme by default
> — per-scheme file manifest (D17):** each scheme registers its own manifest
> (forms, file patterns, required flags, instrument roles) PLUS question counts,
> decision-rule reference, prerequisites, registration requirements. AK3U values
> are AK3U's only; no other scheme's values are invented. (6) **Provider-agnostic,
> free-first, BYOK (D18):** provider + base URL/gateway + model + key are runtime
> config, user-supplied (Anthropic, OpenAI-compatible, Gemini, OpenRouter /
> OmniRouter / 9Router, Nvidia NIM, etc.); keys stored locally (browser) and sent
> per request, never logged, never committed, never in the DB in plaintext — only a
> key reference is stored. GPT-4o-mini is NO LONGER the primary; there is no
> primary model. Free tiers usable per provider; no provider claimed free.
> (7) **Numeric similarity thresholds + details (D19, refines OQ-08):** flags use
> per-scope NUMERIC thresholds WITH evidence details (spans, shared unique errors);
> the qualitative Bersih/Waspada report stays the human-facing summary. Threshold
> VALUES stay UNCONFIRMED (calibration). (8) **Dashboard look (D20):** paulcodes4
> "Dashboard V18 — Modern & Minimal UI" — modern & minimal, elegant analytics
> cards, smooth charts, clean white-and-blue theme, premium, responsive; grounded
> by Moza's screenshot 2026-11-18 01:25 (dark sidebar + light content, glassmorphism
> stat cards with large value + change arrow, hover lift). (9) **Zero hardcoding
> (D21):** NO hardcoded values at all, for anything — every value that varies by
> scheme, org, or deployment comes from config; a fallback is itself a config value.

## 0. Changelog — v1.0 → v1.1 (2026-11-17)

| Change | Where |
|---|---|
| Queue decided: pg-boss (was "BullMQ or pg-boss, decide at build") | §2, §4, §12 |
| Prompt registry, completeness gate, triage, encrypted-06B flow, combined report mirrored at system level | §5.2, §5.5–§5.8, §6 |
| AK.05 accept/return + sign-off flow; row-scoping rule (only assessees the assessor actually assessed) | §5.4 |
| Load case updated: "single assessor" → multi-assessor shared folder | §9 |
| Repo-privacy constraint in the security section (repo never a data store; no personal data in git) | §7.5 |
| MFA wording fixed (no finance roles in this system) | §7.1 |
| Export fidelity: validated against the real AK3U blanks (v1.0's "no samples" no longer true) | §13 |

## 0.1 Changelog — v1.1 → v1.2 (2026-11-17)

Moza decisions, 17 Nov 2026 23:45. New FRs for these changes are added by Group A
in doc 02 v1.2 (numbering dependency — this doc references them by name, not by
number, until the v1.2 FR list lands).

| Change | Where |
|---|---|
| KTP OCR + name-jury flow; assessor confirm/override step; pending verdict blocks AK.05 | §1, §5.9, §6, §7.3 |
| Assessor signature lifecycle flow (upload → active → applied at sign-off → superseded; old docs keep old signature) | §1, §5.10, §6, §7.6 |
| Export rule D8 **decided** (AK.05 = PDF + DOCX; other documents DOCX only; XLSX data extracts only); combined-report export corrected to DOCX | §5.4, §5.8, §12, §13 |
| Signature security section (private bucket, RLS, no signature in logs/exports metadata); signature in the context diagram + module map | §2, §4, §7.5 |
| Scaling/failure table + runbook rows (OCR, jury, signature, export format) | §9, §10 |
| Sequence diagram extended (OCR/jury + signature sign-off) | §11 |
| Decisions log 14–16 (name jury, export rule, assessor signature) | §12 |
| Open questions: D8 resolved; new Q10–Q13 (OCR threshold, jury cut, virus scan, signature legal standing) | §13 |

## 0.2 Changelog — v1.2 → v1.3 (2026-11-18)

Moza decisions, 18 Nov 2026 01:06.

| Change | Where |
|---|---|
| Certificate-name rule **DECIDED (D6, closes OQ-06)**: KTP is the authority — certificate name is the KTP name verbatim; jury proposal on `mismatch_resolved` is ALWAYS the KTP spelling (Declan Rice example) | §1, §5.9, §6, §7.3, §12, §13 |
| Pass-mark shape **DECIDED (refines D7/OQ-04)**: per-question verdicts + per-student error summary ("Ringkasan Kesalahan") + plagiarism as a SEPARATE qualitative report (Bersih / Waspada + reasoning); no overall % as the decision; roll-up default = assessor's judgement per KUK (OQ-04 open only for LSP confirmation of the default) **[superseded in v1.4 by D16]** | §5.3, §5.8, §12, §13 |
| 06B password + key structure **(D12; OQ-14 answered in part)**: PASSWORD Excel file per scheme, holder = assessor at runtime; two copies exist (repo SKEMA blank OLE-encrypted, AK3U working key plain OOXML) — encryption detected first; key answers are PROSE; embedded images flagged, never silently dropped | §5.7, §7.4, §9, §10, §12, §13 |
| Schema summary corrected: 53 tables (was "49 tables in v1.1" — stale since v1.2) | §6 |

## 0.3 Changelog — v1.3 → v1.4 (2026-11-18)

Moza decisions, 18 Nov 2026 01:18 + 01:23 + 01:24 + 01:26.

| Change | Where |
|---|---|
| Upload flow **(D13)**: scheme + scheme-level forms registered once per scheme; per batch only Drive link(s) + Kelompok Asesi; filled 04A/04B/09 ingested from the Drive folder | §5.1 |
| FR.IA.04B official form **(D14, closes OQ-02)**: 13 built-in questions, Ya/Tidak per KUK, binary recommendation; evidence = DIT task + presentation | §5.2 |
| No "Kompeten Bersyarat" **(D15, closes OQ-03)** | §5.2 |
| AI judges the roll-up, VATM-based **(D16, answers OQ-04)**: AI judges VATM sufficiency per unit → recommends K/BK; assessor confirms/overrides; reasoning stored on `decisions`; REPLACES the v1.3 default | §5.3, §6, §12, §13 |
| Per-scheme file manifest **(D17)**: new table `scheme_form_manifest` (54 tables); manifest also carries question counts, decision-rule ref, prerequisites, registration requirements | §1, §5.1, §6, §12 |
| Provider-agnostic, free-first, BYOK **(D18)**: provider + base URL/gateway + model + key are runtime config; GPT-4o-mini NO LONGER primary; provider-settings endpoints (doc 05 §2.15) | §3, §7.4, §8, §12 |
| Numeric similarity thresholds + details **(D19, refines OQ-08)**: numeric flag + qualitative Bersih/Waspada section in the report | §5.8, §13 |
| Scheme document found **(OQ-01 ANSWERED, OQ-10 partly)** | §1, §13 |
| Zero hardcoding **(D21)**: no hardcoded values at all — every scheme/org/deployment-varying value comes from config | §1 |
| Dashboard look **(D20)**: one-line direction (dark sidebar + light content, glassmorphism stat cards) | §3 |
| Table count 53 → 54 | §6 |

## 1. Goals & non-goals

**Goals.** (1) One assessor can run a whole batch — messy public Google Drive folders,
23+ assessees, several assessors sharing one flat folder with no assessor separation
— without a timeout or a lost file. (2) Every AI suggestion is attributable,
replayable and overridable; the assessor's professional judgement is the decision.
(3) The certificate name is human-confirmed against the government ID before AK.05
is submitted — in v1.2 with a KTP OCR + AI name-jury proposal the assessor
confirms or overrides, never an auto-decided name. **In v1.3 the rule is decided
(D6): the KTP is the authority — the certificate name is the KTP name verbatim,
and a jury proposal on `mismatch_resolved` is always the KTP spelling.** (4) The system works for any certification scheme, not only AK3U:
scheme, units, form mappings and thresholds are config. **In v1.4 (D17/D21): each scheme registers its own manifest — file set, question counts, decision-rule reference, prerequisites, registration requirements — and NOTHING is hard-coded: every value that varies by scheme, org, or deployment comes from config (scheme names and manifests, question counts — never a literal 13 in code, 13 is only the AK3U manifest's value — rules, thresholds, prerequisites, requirements, roles, export formats, providers, models, temperatures, UI labels); a fallback for a missing config is itself a config value.** (5) The assessor's own
prompts are versioned, auditable artefacts — not strings hidden in code.
(6) Every document the assessor signs carries the assessor's own uploaded,
versioned signature, applied at sign-off — and AK.05 cannot be submitted without
one. (7) Exports follow one rule: AK.05 = PDF + DOCX, every other generated
document = DOCX only, XLSX only for tabular data extracts.
**Non-goals (v1).** No candidate-facing portal; no payment / QRIS; no certificate
printing (that is the LSP pleno → BNSP stage); no private-Drive OAuth ingestion;
no on-premise deployment; no real-time proctoring; no generation or application of
assessee signatures (wet signatures on scanned originals).

## 2. System context

```mermaid
flowchart LR
  A[Assessor<br/>browser] -->|HTTPS, Supabase JWT| W[Next.js app<br/>Vercel / VPS]
  L[LSP admin<br/>browser] -->|HTTPS| W
  T[TUK admin<br/>browser] -->|HTTPS, read-only| W
  W -->|PostgREST / Auth| S[(Supabase<br/>Postgres + Auth<br/>Storage + pgvector)]
  W -->|enqueue| Q[Job queue<br/>pg-boss (Postgres)]
  Q --> K[Worker<br/>Railway / Fly / VPS]
  K -->|Drive API v3<br/>API key| D[(Google Drive<br/>public folders)]
  K -->|Sheets export CSV| G[(Google Sheets<br/>Kelompok Asesi)]
  K -->|generateObject| O[LLM provider<br/>configured model (BYOK, v1.4)]
  K -->|read/write| S
  K -->|Tesseract / pdfjs / python-pptx / msoffcrypto| K
  K -->|KTP OCR + name jury (redacted text only)| K
  W -->|signed URLs| S
```

External actors: assessor (primary user), LSP admin (scheme/config, prompt approval,
pleno handoff), TUK admin (read-only batch view, receives and reviews AK.05),
assessee (never a direct user in v1 — their data arrives via Drive / sheet).
External systems: Google Drive + Sheets (read-only, public links), LLM provider,
Supabase. **Not** an external system: the GitHub repo — it holds code + docs only
and is never read for assessee data (§7.5).

## 3. Frontend architecture (Next.js App Router)

- **Framework:** Next.js App Router + TypeScript + React. Server Components for
  read-heavy pages (batch list, completeness matrix, AK.05 preview); Client Components
  only where interactivity needs it (ingest progress, similarity review, 04B scoring,
  triage queue). Server Actions are **not** used for heavy work — Route Handlers
  (`app/api/v1/…`) are the API surface (doc 05); the UI calls them with `fetch`.
- **Auth (client):** `@supabase/ssr` — `httpOnly` cookies, `SameSite=Lax`, `Secure` in
  production. Middleware refreshes the session and redirects unauthenticated users
  to `/login`. Role-based route guards: `/admin/*` requires `lsp_admin`/`super_admin`;
  assessor pages check the batch assignment server-side (RLS is the backstop, not
  the only check).
- **Key screens:** Login (+ MFA) → Dashboard (batches, status, worker health) — **v1.4 (D20): modern & minimal, clean white-and-blue theme, premium, responsive; dark icon sidebar + light content, glassmorphism stat cards (large value + change arrow, hover lift), right-hand panel — grounded by Moza's screenshot 2026-11-18 01:25; the detailed restyle is doc 08/13's work** →
  Batch detail (completeness matrix, ingest progress, unmatched queue, **triage
  queue**) → Assessee detail (documents, DIT + coverage matrix, gap questions,
  question bank, **readiness block, model answers (assessor-only)**, portfolio,
  written test + verdicts + roll-up, decisions) → Similarity (flagged pairs, span
  evidence, review) → Identity (KTP vs APL.01 vs surat-tugas, **KTP OCR run +
  name-jury verdict with evidence, confirm/override**, confirm certificate
  name; assessor-side matching) → AK.05 (draft, **sign-off (applies the active
  signature)**, submit gate, **accept/return status**, export) → Prompt registry
  (versions, approval — `lsp_admin`) → **Settings → My signature** (upload,
  preview, history, deactivate) → **Settings → LLM provider** (**v1.4, D18:** provider / base URL / model / key, test connection — doc 05 §2.15; the key is never shown back) → Jobs & Audit log.
- **State & data fetching:** server-side fetching per page (RSC) + `fetch` with
  `revalidate` for job polling (3 s → 10 s backoff, §5.6 of doc 05); Supabase
  Realtime subscription on `drive_ingest_jobs` / job rows as the preferred live
  channel (200 concurrent connections on Free is far above the assessor count).
- **i18n:** UI in Bahasa Indonesia; all user-facing strings in one locale file
  (`lib/i18n/id.ts`) — no hard-coded strings in components. Dates in Asia/Jakarta
  (`WIB`); the reference batch is Kamis 12 Nov 2026, 09.00 WIB.
- **Accessibility (lansia-friendly assessors):** large tap targets, high contrast,
  no jargon without explanation, every AI suggestion labelled "Rekomendasi AI —
  perlu konfirmasi asesor".

## 4. Backend architecture

```
                 ┌─────────────────────────────────────────────┐
                 │  Next.js (Vercel / VPS) — thin API layer   │
                 │  Route Handlers: Zod validate → auth →      │
                 │  RLS-guarded DB write → enqueue → 202       │
                 └───────┬─────────────────────────┬───────────┘
                         │ PostgREST/Auth          │ enqueue
                         ▼                         ▼
              ┌────────────────────┐      ┌──────────────────┐
              │ Supabase Postgres  │      │ Job queue        │
              │ + Auth + Storage   │◄────►│ pg-boss (in      │
              │ + pgvector + RLS   │      │ Postgres — §8    │
              └────────────────────┘      │ of doc 06)       │
                                           └──────┬───────────┘
                                                 │ consume
                                                 ▼
                                      ┌──────────────────────┐
                                      │ Worker (persistent)  │
                                      │ crawl · file · OCR   │
                                      │ LLM · similarity     │
                                      │ export · retention   │
                                      │ triage · redact      │
                                      └──────┬───────────────┘
                                             │ Drive API · LLM API
                                             ▼
                                      Google Drive / Sheets · OpenAI/Gemini
```

- **Why this split:** the hard problems are long-running ingestion, OCR quality,
  deterministic grading and auditability — not the UI. The web tier stays stateless
  and fast; the worker is the only stateful, long-running process. This is the
  single most important architectural decision in the system.
- **Edge Functions:** dispatcher/trigger only (e.g. a cron that enqueues a
  retention check). Never the worker: 150 s wall / 2 s CPU on Free, 400 s on Pro —
  an OCR/embedding step blows the CPU budget even when the wall clock fits.
- **Module map:** see doc 06 §1 (`app/`, `lib/drive|extract|ocr|jury|signatures|
  similarity|llm|prompts|redact|export|identity|triage`, `worker/jobs`,
  `supabase/migrations`). In v1.1 `lib/prompts/` is the **registry loader**
  (DB-backed), not a folder of prompt files; `lib/redact/` is the PDP redaction
  function; `lib/triage/` is the shared-folder assignment algorithm. In v1.2
  `lib/ocr/` gains the KTP field extraction, `lib/jury/` is the name-jury
  prompt + verdict handling, and `lib/signatures/` is upload validation +
  placement into the blank's signature block.

## 5. API structure & flow

Full contract: doc 05. The flows that matter most, end to end:

### 5.1 Ingest a batch (the highest-risk flow)

```
Assessor pastes Drive folder URL
  → POST /batches/{id}/ingest {drive_folder_url, scope} + Idempotency-Key → 202 + job_id
  → UI polls GET /jobs/{id} (or Realtime)
  → worker crawl: files.list pages (pageSize=100, nextPageToken checkpointed)
       → persist raw tree (drive_files, status=queued) BEFORE downloading
       → enqueue one job per file
  → per-file jobs (concurrency 5–10): download (alt=media | files.export)
       → classify (MIME + filename + folder + content sniffing)
       → extract (pdf text → PPTX → DOCX → Tesseract ind+eng → LLM fallback on flagged pages;
         encrypted Office files → §5.7 blocker state)
       → store extracted_text + document row → status=done/failed
  → triage pass (doc 06 §2.6): propose file/assessee → assessor assignments;
     unassigned files stay in the triage queue
  → batch status: ingesting → ready; unmatched files land in the review queue
  → assessor maps unmatched files manually; completeness matrix fills in
```

**Manifest-driven intake (v1.4, D17/D13).** The crawl above is driven by the scheme's manifest (`scheme_form_manifest`, doc 04 §4.2) — never by a hard-coded AK3U file list. The batch takes only Drive link(s) + Kelompok Asesi; the scheme and its scheme-level forms (06A, 06B) come from the scheme registration. A missing manifest-required file → `422 MANIFEST_FILE_MISSING` (doc 05 §2.4).

**Ordering rule (v1.1).** The Kelompok Asesi sheet import runs **before** the Drive
crawl classifies files — the sheet is what lets a flat shared folder be split by
assessee. A crawl that starts first leaves its files `unassigned` until the sheet
lands; triage then assigns them (doc 05 §3.8).

### 5.2 DIT analysis (async LLM, with completeness gate)

```
Assessor: POST /dit/{id}/analyse {include_question_bank: true} → gate check
  → if FR.IA.04A / transcript / profile incomplete: 422 + missing_documents list
       (analysis deferred, never run on partial inputs — doc 05 §3.9)
  → if complete: 202 + job
  → worker: load 04A focus points + presentation transcript + profile
       → PDP REDACTION (lib/redact: allow-list, pseudonym ASESI-NNN — §7.3)
       → load active gap_analysis prompt version from the registry
       → generateObject (Zod: coverage matrix + gap questions + question
         bank (count per-scheme — 13 for AK3U) + readiness block) → validate
       → store coverage_matrix + gap_questions + question_bank_13
         + readiness_assessments (readiness_pct, strengths, critical gaps,
           follow-up actions, readiness_recommendation as a TEXT note)
         + llm_runs row (prompt version, model, tokens, cost, raw output)
  → assessor reviews the matrix, overrides any row, answers gap questions,
    and confirms/overrides the 04B draft (Ya/Tdk per KUK from the DIT deck +
    presentation against the form's built-in questions — 13 for AK3U, per-scheme
    manifest; v1.4, D14) — the assessor's confirmation is the 04B score
  → assessor may generate model answers for the bank (assessor-only, RLS)
```

### 5.3 Written-test grading (rules-first) — v1.3 judging shape, v1.4 VATM roll-up (D16)

```
Assessor: POST /assessees/{id}/tests/ia06/grade → 202 + job
  → worker: branch on question_type —
       MC / true-false / matching: deterministic letter match, NO LLM call
       essay: deterministic exact match first (verbatim-correct never sent to LLM)
       → LLM semantic judgement ONLY for the rest (key text in-context,
         must quote master + student spans, must return covered-points list,
         Zod-validated, retry once)
       → per-question verdict Benar / Sebagian / Salah (correct / partial /
         incorrect) + Bahasa Indonesia explanation; score = coverage_pct of
         acceptable_points — INFORMATIONAL ONLY, never the pass/fail
       → store test_item_verdicts.ai_* + score + coverage_pct + llm_runs
  → assessor sets assessor_verdict + assessor_kbk per item (the decision)
  → per-unit roll-up computed (doc 04 §4.8; GET /tests/{family}/rollup):
       v1.4 (D16, answers OQ-04) — the AI judges VATM sufficiency per unit
       (scheme §9.3.3–9.3.4) and recommends K/BK; the assessor confirms or
       overrides (AI recommends, assessor decides); the record stores the AI's
       VATM reasoning per unit + the assessor's confirm/override; NO overall
       percentage as the decision; the roll-up returns the recommendation +
       VATM reasoning + confirmation state and the undecided items only
  → POST /batches/{id}/similarity/run → pairwise flags + spans (doc 06 §4)
  → POST /batches/{id}/written-report/generate → combined Markdown report
       (per-participant tables + per-student error summary "Ringkasan Kesalahan"
       + a SEPARATE qualitative plagiarism section: per-assessee Bersih /
       Waspada + reasoning — never a numeric plagiarism verdict;
       no overall % as the decision; names resolved post-hoc — §5.8)
```

### 5.4 AK.05 submission (the gate) — accept / return / sign-off (v1.1) + signature (v1.2)

```
Assessor: POST /ak05/{id}/sign-off (attestation: rows match the AK.02 records)
  → sign-off applies the caller's ACTIVE signature to the AK.05 signature
    block (document_signatures row, doc 04 §4.13); blocked with
    422 NO_ACTIVE_SIGNATURE while the assessor has no active signature
  → POST /ak05/{id}/submit
  → server checks: all assigned assessees decided (all units, K/BK) AND
    all certificate_name_confirmed = true
    AND rows contain ONLY the assessees the assessor actually assessed
    (row-scoping rule, doc 04 §4.10 — never the whole batch)
    AND the submitting assessor has an active signature (v1.2)
  → if any fails: 422 with the blocking items listed (doc 05 §3.7)
  → if ok: status submitted, audit_log row, export job enqueued (PDF + DOCX,
    the only artefact with both formats — v1.2 export rule)
  → TUK/LSP reviews: POST /ak05/{id}/accept  → status accepted (closed loop)
                  or POST /ak05/{id}/return {returned_reason} → status returned
  → on return: assessor creates a NEW draft (resubmission_of = returned id),
    corrects it, signs off (fresh signature application — re-opening voids
    the old one), re-submits. The returned version is never edited
    in place. Pleno / certification decision is a separate stage the assessor
    does not control.
```

### 5.5 Triage — one flat folder, several assessors (v1.1)

```
Sheet import (assessee → group → assessor) completes
  → crawl persists the raw tree
  → triage pass proposes assignments (folder signal → filename→person →
    sheet join → flat-folder fallback to the queue; doc 06 §2.6)
  → assessor opens the triage queue: proposed assignments with confidence,
    unassigned files, unassigned assessees
  → confirm / reject per item (audited triage_assignments rows);
    a rejected proposal returns the file to the queue
  → confirmed assignments drive RLS visibility: an assessor sees only their
    group's files + the triage queue they may claim from
```

### 5.6 Completeness gate (v1.1)

The gate is a server-side check on `POST /dit/{id}/analyse`, not a UI hint:
FR.IA.04A classified + extracted, presentation transcript present, profile inputs
present (CV / education / work history — the fields the RCTFA profile summary
needs). A failed gate returns `422` with `missing_documents` listing exactly what
is missing; the job is never enqueued. The same gate shape applies to any future
pipeline that needs complete inputs before an LLM call.

### 5.7 Encrypted master key (v1.1) — two copies exist (v1.3, D12)

```
Assessor uploads the 06B key file → worker detects encryption FIRST (magic bytes)
  → ENCRYPTED (e.g. the repo's SKEMA 06B blank, OLE-encrypted):
       document row enters `blocked` ("kunci terkunci — masukkan kata sandi")
       → assessor supplies the password per-request on the key-upload endpoint
       → worker decrypts in memory (msoffcrypto), parses, stores extracted key text
       → password is never stored, never logged, never in any job payload
       → wrong password → 422 KEY_PASSWORD_WRONG, row stays blocked
  → UNENCRYPTED (plain OOXML — e.g. the AK3U working key):
       parsed directly, key_protection='none'; a password is NEVER required
       for an unencrypted file and the client must not prompt for one
The real AK3U 06B blank is OLE-encrypted (verified 17 Nov 2026) and the AK3U
working key is a plain OOXML docx (verified 18 Nov 2026,
research/06b-key-structure-2026-11-18.md) — both copies exist, and the flow
above handles both. Each scheme's 06B ships with a PASSWORD Excel file; the
holder is the assessor, who supplies the password at runtime (OQ-14 answered
in part, v1.3). The PASSWORD file is handled as an assessor-supplied secret and
is never committed to the repo.
```

**Key answers are PROSE (v1.3).** The AK3U key holds 13 answers in one table,
written as prose — acceptable points are embedded in sentences, not pre-split
lists. `test_keys.acceptable_points` is derived from the prose at key-import time
(LLM extraction, assessor-verified; doc 06 §5.2). The key file also embeds 8
images; extraction flags embedded images, never silently drops them (doc 06 §3).

### 5.8 Combined written report (v1.1) — error summary + qualitative plagiarism (v1.3)

```
POST /batches/{id}/written-report/generate → 202 + job
  → worker reads test_item_verdicts + similarity_pairs/spans from the DB
       (deterministic skeleton: per-participant tables + similarity section)
       **v1.3 — the skeleton also contains, deterministically built from the
       verdicts: a "Ringkasan Kesalahan" per assessee (the question numbers
       whose verdict is incorrect — never invented) and the similarity
       section as a SEPARATE qualitative report (per-assessee Bersih /
       Waspada + reasoning; never a numeric plagiarism verdict, never a
       pass/fail). The report carries NO overall percentage as the decision.**
       **v1.4 (D19): the report carries BOTH the numeric flag (per-scope
       threshold, with flag_level and combined_score) AND the qualitative
       Bersih / Waspada section — the number is the triage signal, the
       qualitative section is the human-facing summary.**
  → one LLM call (written_grading prompt, temp 0, pseudonyms in) for the
       "coincidental vs indicative of copying" judgements + analytical summary
  → worker resolves pseudonyms → real names POST-HOC in the stored Markdown
       (the LLM never sees a real name; the report never shows a pseudonym)
  → store combined_reports row (report_markdown, prompt_version_id, llm_run_id)
  → export Markdown → DOCX via §7 pipeline (v1.2 export rule — DOCX only,
       never PDF; the combined report is a generated document, not AK.05)
```

### 5.9 KTP OCR + name jury (v1.2) — KTP is the authority (v1.3, D6)

```
Assessor opens the Identity screen for an assessee
  → POST /assessees/{id}/identity/ocr-run → 202 + job (ocr_ktp)
  → worker: read the KTP image from the private ktp-ids bucket (worker only)
       → preprocess (deskew, 300 DPI, threshold) → Tesseract 5 ind+eng
       → extract the Nama field by layout (label-anchored) + per-field confidence
       → REDACT the full OCR text (NIK, address, phone, email, place/date of
         birth stripped) BEFORE writing the ocr_runs row; the unredacted raw
         text is never stored (raw_text_location points at the source image)
       → if confidence < identity.ktp_ocr_min_confidence (UNCONFIRMED value):
         run ends low_confidence, 422 OCR_LOW_CONFIDENCE, NO jury call —
         the assessor types the name from the KTP image
       → if above threshold: update identity_verification.ocr_name,
         enqueue the name_jury job
  → worker (name_jury): read the four names + ocr_name (+ pseudonym only)
       → generateObject with the active name_jury prompt version (temp 0,
         Zod NameJuryOutput — doc 06 §5.6)
       → **the jury compares each source AGAINST the KTP name, which is the
         authority (v1.3, D6): on mismatch_resolved the proposal is ALWAYS
         the KTP spelling, verbatim — a proposal that is not the KTP spelling
         is a defect, not a judgement call. Abbreviation expansion uses the
         KTP only (surat tugas "Declan Rice P." vs KTP "Declan Rice
         Pangabean" → "Declan Rice Pangabean").**
       → store name_jury_verdicts (verdict, proposed name, reasoning,
         evidence, confidences, prompt_version_id, llm_run_id),
         assessor_confirmation='pending'
       → if ocr_confidence < jury.min_confidence (UNCONFIRMED value):
         verdict='needs_human', no proposal
  → assessor reviews the verdict + evidence in the Identity screen
       → POST .../identity/jury/confirm → proposal becomes certificate_name
         (source='jury_proposed', confirmed_by/at set)
         OR POST .../identity/jury/override {certificate_name, override_reason}
         → assessor's own value (source='assessor_override')
       → either action unblocks AK.05 for that assessee; a pending verdict
         blocks it exactly like an unconfirmed name
  → audit_log rows: ocr_run, jury_verdict, identity.confirm / identity.override
The KTP image never goes to any LLM at any step — not to OCR (Tesseract runs
locally in the worker), not to the jury (redacted text + name strings only),
not as a multimodal fallback (forbidden for ID cards, doc 06 §3.5).
**When the KTP itself is unclear** (unreadable image or low OCR confidence)
there is no authority to compare against: `needs_human`, no proposal, the
assessor types the name from the KTP image — a low-confidence KTP read never
produces a proposed name. The rule is the config key
`identity.certificate_name_rule = 'ktp_authoritative'` (doc 04 §4.11).

### 5.10 Assessor signature lifecycle (v1.2)

```
Assessor: Settings → My signature → upload PNG
  → POST /assessors/me/signature (multipart) → validate MIME (image/png) +
    size (config signature.max_size_mb, UNCONFIRMED) + hash (SHA-256) +
    virus-scan hook if configured (none chosen — UNCONFIRMED)
  → store in the private signatures bucket (owner-only, no public URL)
  → new version becomes is_active=true; the previous active version is
    superseded in the same transaction (superseded_by/at set) — never deleted
  → assessor previews it (15-minute signed URL, owner only) and can deactivate
    it (POST .../signature/deactivate) — deactivation blocks further sign-offs
    until a new signature is uploaded
  → at sign-off (POST /ak05/{id}/sign-off or any assessor-signed document
    export): the worker takes the caller's ACTIVE signature and places the
    image into the blank's signature block (DOCX cell / AK.05 PDF block,
    doc 06 §7), writing a document_signatures row (signature_id = the version
    applied, signed_by = the caller, signing_context, placement)
  → superseding the signature afterwards does NOT rewrite signed documents:
    their document_signatures rows keep pointing at the old version
  → re-opening a signed draft voids the applied signature (the
    document_signatures row stays as history; a fresh sign-off applies the
    then-active signature)
Assessee signatures are never uploaded or applied by the system — assessee
signature cells stay blank in generated exports (wet signature on the scanned
original).

## 6. Database schema (summary)

Full schema: doc 04 (**54 tables in v1.4** — new in v1.4: `scheme_form_manifest`, D17). The load-bearing relationships:

- `organisations` → `schemes` → `scheme_versions` → `units` → `elements` → `kuk`
  (the standard, versioned, never hard-coded) + `form_version_mapping` +
  `scheme_form_manifest` (**v1.4, D17:** the per-scheme file manifest — forms,
  file patterns, required flags, instrument roles — with the scheme-level fields
  on `scheme_versions`: question counts, decision-rule reference, prerequisites,
  registration requirements).
- `batches` → `assessment_groups` → `assessee_group_members` → `assessees`;
  `assessor_assignments` links the surat tugas to assessor + batch (+ assessor-side
  name matching in v1.1).
- `drive_ingest_jobs` → `drive_files` → `documents` → `extracted_text`
  (Drive is the source of truth for originals; Supabase holds metadata + text);
  `drive_files` → `triage_assignments` (v1.1 — the shared-folder split).
- `assessees` → `identity_verification` (four names + human-confirmed certificate
  name + `similarity_score`; assessee titles split prefix/suffix in v1.1;
  **v1.2:** `ocr_name` + `jury_verdict_id` + `certificate_name_source`;
  **v1.3:** the certificate name is the KTP name verbatim — `certificate_name_source`
  gains the KTP-authoritative semantics; a jury-proposed name is by definition
  the KTP spelling (config `identity.certificate_name_rule='ktp_authoritative'`).
- **v1.2:** `assessees` → `ocr_runs` (KTP OCR, redacted text only) → `name_jury_verdicts`
  (verdict + proposal + evidence + assessor confirm/override) → `identity_verification`.
  `assessors` → `signatures` (versioned PNG images) → `document_signatures`
  (which version signed which document, in which context).
- DIT route: `dit_submissions` → `presentations` → `coverage_matrix` →
  `gap_questions`; `question_bank_13` (separate artefact) → `model_answers`
  (assessor-only, v1.1); `dit_submissions` → `readiness_assessments` (RCTFA Task 4,
  v1.1); `presentation_assessments` (official 04B). Portfolio: `portfolio_items`
  (IA.08) → `portfolio_interviews` (IA.09) → `portfolio_verifications` (IA.10/11).
  Written: `written_tests` → `test_answers` → `test_item_verdicts` (with `score`,
  `coverage_pct`, `grading_method` in v1.1; **v1.3:** `score`/`coverage_pct`
  informational only — the decision is the verdict + the AI's VATM judgement per
  unit, confirmed by the assessor (v1.4, D16), no overall %); `test_questions` → `test_keys`
  (with `key_protection` in v1.1; **v1.3:** key text comes from prose answers,
  both encrypted and unencrypted 06B copies handled); `batches` → `combined_reports`
  (v1.1; **v1.3:** error summary + separate qualitative plagiarism report;
  **v1.4 (D19):** the report also carries the numeric similarity flag).
- `similarity_pairs` → `similarity_spans` (flags + evidence, never a verdict;
  per-scope thresholds in v1.1).
- `decisions` (AK.02, K/BK — **v1.4 (D16):** the row also carries the AI's VATM recommendation (`ai_recommendation`), its VATM reasoning (`ai_vatm_reasoning`), and the producing run (`ai_llm_run_id`); the assessor's confirm/override is the decision) → `ak05_reports` → `ak05_report_rows` (AK.05, with
  accept/return/sign-off fields in v1.1).
- Prompt registry: `prompt_templates` → `prompt_versions` → `llm_runs` (v1.1).
- Cross-cutting: `audit_log` (append-only), `llm_runs` (prompt version, model, raw
  output, now scheme- + form-scoped), `app_config` (key–value, no hard-coding),
  `embeddings` (pgvector HNSW, `vector(1536)` for `text-embedding-3-small` only).
- Free-tier arithmetic (doc 04 §9): extracted text ~20–40 KB + embeddings ~120 KB
  per assessee; 500 assessees ≈ 50–150 MB — fits 500 MB **only if** originals and
  large blobs stay out of Postgres. Monitor `pg_database_size()`; alert at 80%.

## 7. Authentication & security flow

### 7.1 Sign-in

```
Browser → POST /auth/login {email, password}
  → Supabase Auth (GoTrue) verifies → JWT (access ~1 h) + refresh token (httpOnly cookie)
  → middleware: session → users row (organisation_id, role, mfa_enabled)
  → if role is lsp_admin / super_admin and mfa_enabled=false → force MFA enrolment
  → MFA (TOTP): POST /auth/mfa/verify → AAL2 session
```

- MFA is required for `lsp_admin` / `super_admin`; assessor MFA follows LSP
  policy. **There are no finance roles in this system** (v1.0's "finance/admin"
  wording was a copy error, fixed in v1.1). Enrolment is TOTP (authenticator
  app); no SMS in v1.
- Passwords: Supabase Auth (bcrypt, server-side). No custom password storage, no
  passwords in `users`. Password reset via Supabase email flow only.

### 7.2 Authorisation (RLS — the real enforcement)

- RLS is enabled on **every** table (doc 04 §6). The JWT's `auth.uid()` resolves to
  a `users` row; policies check `organisation_id` (tenant isolation) and, for
  assessors, the `assessee_group_members` link (an assessor sees only their group's
  assessees). `lsp_admin` sees the whole org; `tuk_admin` sees batch-level
  aggregates + AK.05 (names per LSP confirmation — see open question, doc 05 §10).
- The service-role key is used **only** by the worker and by server-side admin
  functions; it never reaches the browser. Client code uses the anon key + user JWT.
- Storage bucket policies mirror table RLS: `ktp-ids` = assigned assessor +
  `lsp_admin` only; `exports` via signed URLs (1 h; KTP URLs 15 min).
- **New in v1.1:** `model_answers` SELECT is restricted to the assigned assessor +
  `lsp_admin` (never `viewer`/`tuk_admin`, never any candidate-facing view);
  `prompt_versions` are immutable once approved (trigger + policy); an assessor's
  crawl is scoped to `own_group` (doc 05 §2.4) — batch-scope crawls are admin-only.

### 7.3 PDP (UU 27/2022) — data-flow rules

```
KTP / ijazah / CV ──► private bucket (RLS) ──► assessor's eyes only
                          │  (OCR suggestion for the NAME only)
                          ▼
            identity_verification (four name columns, human confirms)
                          │
LLM input ──► REDACTION (lib/redact, allow-list — doc 06 §5.4):
              pseudonym (ASESI-001) + DIT/transcript/answers ONLY
              NIK, address, phone, email, KTP photo, signatures: NEVER sent
              Redaction count logged on llm_runs (never the values)
                          │
            llm_runs (pseudonym only — never a real name in an LLM row)
```

- NIK plaintext is **never stored** (only a SHA-256 hash, and only if the LSP
  requires it — v1 can run without it). KTP images never go to an LLM. Cross-border
  transfer (LLM leg, Art. 56) needs adequacy / safeguards / explicit consent; breach
  notification is 3×24 h (Art. 46). Each LLM provider's data-retention / training-use
  terms and DPA position are **UNCONFIRMED — verify before the first live batch**.
- **v1.2 — OCR + jury data flow.** The KTP image is read by the worker from the
  private bucket and never leaves it. OCR text is redacted (NIK, address, phone,
  email, place/date of birth stripped) before the `ocr_runs` row is written; the
  unredacted raw text is never stored. The jury call receives redacted text + the
  four name strings under the assessee pseudonym — never the image, never a NIK.
  The jury's proposal is never written to `certificate_name` except by the
  assessor's own confirm/override call. **v1.3 (D6): the proposal is the KTP
  spelling by rule — the jury compares the other sources against the KTP name,
  which is the authority (config `identity.certificate_name_rule =
  'ktp_authoritative'`); a jury proposal that is not the KTP spelling is a
  defect.** Audit covers every step: OCR run, jury verdict, identity
  confirm/override, and every KTP image view.
- **Injection guardrail:** all candidate text is untrusted data, delimited in the
  prompt; model output never changes a verdict without assessor sign-off (doc 06 §5.4).
- **Audit:** every mutation, every KTP view, every export, every model-answer read
  and every LLM run writes `audit_log` (actor, action, entity, before/after).
  `audit_log` is append-only — no UPDATE/DELETE grants for any role.

### 7.4 Secrets

- `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_DRIVE_API_KEY`, `OPENAI_API_KEY` /
  `GEMINI_API_KEY`, `WORKER_SECRET`: environment variables / secret manager only
  (Vercel env vars, Railway/Fly secrets). Never in the repo, never in client code,
  never in logs. Drive API key restricted by API + referrer/IP. Rotate on staff change.
- **LLM provider key (v1.4, D18 — BYOK):** the provider API key is user-supplied at runtime (Settings → LLM provider, doc 05 §2.15), stored only as a reference (`llm.api_key_ref`); it is **never in an env file, never in the repo, never in any log, never echoed by any endpoint (including the test endpoint), and never in the DB in plaintext**. There is no primary model — the provider and model are runtime config.
- The 06B key password is **not** a secret in this sense: it is supplied per-request
  by the assessor and never stored anywhere (§5.7). **v1.3 (D12): each scheme's
  06B ships with a PASSWORD Excel file; the holder is the assessor, who supplies
  the password at runtime** — the PASSWORD file itself is handled as an
  assessor-supplied secret (never committed to the repo, never stored by the
  system), and the password value is never recorded in any doc, note, or memory.

### 7.5 Assessor signatures — security (v1.2)

- **Storage:** the `signatures` bucket is private, owner-only. No public URLs, no
  bucket listing. Preview is a 15-minute signed URL for the owner only; an
  `lsp_admin` audit read returns metadata, not image bytes, unless the request
  itself is audit-logged.
- **Ownership:** a signature belongs to exactly one assessor (`signatures.user_id`).
  The sign-off / export path checks `signature.user_id = auth.uid()` AND the
  document's owning assessor before writing the `document_signatures` row (RLS +
  service check). Applying another assessor's signature is impossible by
  construction, not just by UI hiding.
- **No leakage:** a signature image is never returned in a list payload, never
  embedded in export metadata, never written to any log, and never cached in the
  browser beyond the preview URL's lifetime. The SHA-256 hash in the metadata is
  of the image bytes — it identifies the version, it is not a secret.
- **Upload validation:** PNG only, size capped by config (`signature.max_size_mb`,
  value UNCONFIRMED), unreadable files rejected, duplicates detected by hash.
  A virus-scan hook runs at upload if a scanner is configured — **none is chosen
  (UNCONFIRMED)**; until one is, validation is type/size/hash only and the gap
  stays in the risk register (doc 05 §8).
- **Versioning is the control:** old versions are retained, never overwritten;
  a signed document keeps pointing at the version applied at its sign-off, so a
  later supersede cannot rewrite history. Re-opening a signed draft voids the
  applied signature and forces a fresh sign-off.

### 7.6 Repo privacy constraint (v1.1)

- **The GitHub repo (`danste-kun/asesorkompetensi`) is never a data store.** It
  holds code, migrations, and documentation only. No assessee personal data — no
  KTP scans, diplomas, CVs, photos, filled forms, completeness spreadsheets, or
  password files — is ever committed to it. On 17 Nov 2026 the public repo was
  found to contain assessee data (by filename: KTP, ijazah, CV, photos); that is
  a privacy incident for the repo owner to remediate (make private; deletion alone
  does not clear git history), not a data source for this system.
- **Enforcement:** `.gitignore` excludes all assessee-data patterns; CI runs a
  filename/content scan that fails the build if a commit adds a file matching the
  personal-data patterns (KTP, ijazah, CV, pas foto, NIK-like content) or any
  `PASSWORD*` file. The system itself never reads assessee data from the repo —
  ingestion comes only from Google Drive / Sheets and direct uploads.

## 8. Deployment topology

```
                          ┌─────────────────────────┐
Internet ──HTTPS────────► │  Vercel (Next.js app)   │  Prototype: Hobby $0 (demo only —
                          │  Pro $20/seat in prod   │  Hobby is non-commercial only)
                          └────────┬────────────────┘
                                   │ Supabase client (PostgREST/Auth/Storage)
                          ┌────────▼────────────────┐
                          │  Supabase project       │
                          │  Free $0 → Pro $25/mo   │  Singapore ap-southeast-1
                          │  Postgres + pgvector    │  (Jakarta region UNCONFIRMED)
                          │  Auth · Storage · RLS   │
                          │  + pg-boss queue        │
                          └────────┬────────────────┘
                                   │ pg-boss consume
                          ┌────────▼────────────────┐
                          │  Worker (persistent)    │  Railway / Fly.io / ~$5 VPS
                          │  Node.js + Tesseract    │  (may share the VPS with the
                          │  + pdfjs + docx/pdfkit  │   app in the cheapest topology)
                          │  + python-pptx + msoffcrypto │
                          │  + KTP OCR + name jury  │
                          └────────┬────────────────┘
                                   │ HTTPS (API key)
                          ┌────────▼────────────────┐
                          │  Google Drive API v3    │  Public folders only
                          │  + Google Sheets export │  $0 under the quota threshold
                          └─────────────────────────┘
                          ┌─────────────────────────┐
                          │  LLM provider (user-    │  Provider + model in runtime
                          │  chosen, BYOK)          │  config; no primary model
                          │  (v1.4, D18)            │  (v1.4, D18). Reference figures
                          │                          │  for GPT-4o-mini $0.15/$0.60
                          │                          │  per 1M; ~$1–15 per 100–500
                          │                          │  candidates at those rates
                          └─────────────────────────┘
```

| Environment | App | DB | Worker | Notes |
|---|---|---|---|---|
| Prototype / demo | Vercel Hobby $0 | Supabase Free $0 | Local (`npm run worker:dev`) | Demo only; project pauses after 1 week idle — restore manually |
| First live batch | Vercel Pro $20/seat **or** Cloudflare Workers Paid $5/mo via OpenNext **or** ~$5–10 VPS | Supabase Pro $25/mo | ~$5/mo worker (or same VPS) | **≈ $30–50/mo during an active batch; $25/mo idle (Supabase Pro only)** |
| Cheapest honest prod floor | ~$5 VPS (app + worker) | Supabase Pro $25/mo | Same VPS ($0 extra) | ~$25–30/mo; you pay in ops time |

- **Vercel Hobby is non-commercial only** — an LSP assessor tool used for paid
  certification work is commercial use; do not plan production on Hobby.
- **Cloudflare caveat:** Workers Free is 10 ms CPU/invocation (unsuitable as the
  worker); OpenNext bundle limit 3 MiB free / 10 MiB paid is **UNCONFIRMED** as a
  blocker for this app — verify before choosing Cloudflare for Next.js.
- **Alternative topology (if the builder is PHP-fluent):** Laravel on a VPS with
  Horizon queues + Blade/Dompdf forms is a legitimate alternative (best queue story,
  best pixel-faithful forms); it pays an AI-integration tax and Supabase Auth/RLS
  becomes DIY. The decision is recorded in the tech brief (§1.4); this SDD assumes
  the Next.js recommendation stands.
- **CI/CD:** GitHub (`danste-kun/asesorkompetensi`) → Vercel preview per PR,
  production on `main`; Supabase migrations via CLI in CI (`supabase db push` on a
  staging project first). Worker deploys separately (Railway/Fly/VPS) with its own
  health check. CI also runs the repo-privacy scan (§7.5).

## 9. Scaling limits & failure modes

| Limit / failure | Behaviour |
|---|---|
| **Vercel serverless timeout** | Official figure **UNCONFIRMED** (secondary sources conflict: 10s/15s/60s/300s). Irrelevant by design: no heavy work runs in a serverless function; everything is a queued job. |
| **Supabase Edge Functions 150 s wall / 2 s CPU (Free)** | Edge Functions are dispatcher-only; the worker does the work. |
| **Supabase Free pauses after 1 week inactivity** | Most likely production incident on Free (batches are sporadic). Mitigation: Pro (no pausing). A keep-alive ping is dev-only and fragile — do not rely on it. Health endpoint surfaces a paused project before a session. |
| **Supabase Free 500 MB DB / 1 GB storage** | First wall is storage at ~70–125 candidates **if** originals were stored — they are not (Drive holds them). DB fits 500 candidates if text + embeddings are pruned per batch. Alert at 80%. |
| **Drive API quota** | 1M units/min/project; a 500-file folder ≈ 100,500 units. Not the bottleneck. Per-minute per-user 325k: keep concurrency 5–10 so one minute's budget is never blown. |
| **Drive 403 / 429** | Backoff 1s→64s + jitter, 5 attempts, then `failed` + Retry (doc 06 §9). |
| **Large files (Materi PDFs 9.9–53.5 MB, ~260 MB/folder)** | Streamed download, never buffered whole-file in memory; per-file jobs, not one batch download. Materi is skipped by default unless explicitly included (§2.6 of doc 06). |
| **OCR on phone photos / handwriting** | Tesseract degrades; low-confidence pages are flagged, LLM fallback on flagged pages only, assessor verifies. Never silently trust OCR. |
| **KTP OCR below threshold (v1.2)** | Run ends `low_confidence`; `422 OCR_LOW_CONFIDENCE`; no jury call; the assessor types the name from the KTP image. Blurred/glared/cropped cards are a re-scan or a manual task — never an LLM-vision fallback (forbidden for ID cards). **v1.3 (D6): a low-confidence KTP read never produces a proposed name — the KTP is the authority, and without a readable KTP there is nothing to compare against.** |
| **Encrypted 06B key, no/wrong password (v1.1)** | Row stays `blocked`, `422 KEY_PASSWORD_REQUIRED` / `KEY_PASSWORD_WRONG`; no retry without a new password (§5.7). |
| **Unencrypted 06B key uploaded (v1.3)** | Parsed directly, `key_protection='none'`; a `password` field — if sent — is ignored, never stored; **never require a password for an unencrypted file** (§5.7, doc 05 §3.14). |
| **Key file with embedded images (v1.3)** | Extraction flags the images (count + placement) on the document row; image content is NOT auto-OCR'd into key text and NOT silently dropped; the assessor reviews the flagged file before grading runs (§5.7, doc 06 §3). |
| **Jury needs-human (v1.2)** | Verdict stored with no proposal; the assessor types the name manually; AK.05 stays blocked until confirm/override. A pending jury verdict blocks exactly like an unconfirmed name. |
| **No active signature (v1.2)** | Sign-off / export of an assessor-signed document / AK.05 submit → `422 NO_ACTIVE_SIGNATURE`. The assessor uploads a signature in Settings → My signature; already-signed documents are unaffected. |
| **Export format rejected (v1.2)** | `422 EXPORT_FORMAT_NOT_ALLOWED` — PDF requested for a non-AK.05 document, or XLSX for a document. The client offers the allowed format instead of retrying. |
| **LLM provider down / rate-limited** | Job retries with backoff, then fails closed; fallback model on manual retry; no verdict is ever stored from a failed run. |
| **LLM non-determinism** | Temp 0, pinned model version, Zod validation, retry once, borderline second pass + human confirmation. |
| **Worker crash** | Resume from `next_page_token` + per-file `done` status (idempotent re-run). Heartbeat < 60 s; stale heartbeat = red banner on the dashboard. |
| **Supabase region** | Singapore `ap-southeast-1`; Jakarta availability **UNCONFIRMED** — verify at project creation. Region alone does not satisfy UU PDP cross-border rules for the LLM leg. |
| **Multi-assessor shared folder (v1.1 load case — was "single assessor" in v1.0)** | The reference batch is 2 assessors, 23 assessees, one long Drive folder with no assessor separation: ~250 files. Sheet import first (assessee → group → assessor), then crawl, then triage proposals; each assessor's crawl is scoped to `own_group`. No single request exceeds a few seconds; the triage queue is the coordination point, not a shared spreadsheet. |

### Scaling headroom

- **10× (230 assessees / batch):** same topology; Drive crawl ≈ 2,500 files ≈
  ~500k units (still < 1% of the daily threshold); pairwise similarity 26k pairs —
  still a batch job. Watch DB size (text + embeddings ≈ 0.5 GB at 2,300 assessees —
  that is the Pro 8 GB boundary, not the Free one).
- **100×:** split the worker into per-pipeline workers (ingest vs LLM vs export),
  move to BullMQ/Redis (the documented escape hatch for the pg-boss decision),
  move embeddings to a dedicated pgvector read replica pattern, and revisit the
  LLM budget cap. None of this is needed for v1.

## 10. Observability & operations

- **Health:** `GET /api/v1/health` — DB reachable, queue depth, worker heartbeat,
  Drive API reachable. Dashboard red banner on stale heartbeat / paused project.
- **Logs:** structured JSON from the worker (job_id, type, pseudonym, duration,
  attempt, error_code). No personal data in logs.
- **Metrics:** job throughput + failure rate by type; Drive units per crawl; LLM
  tokens + cost per batch (from `llm_runs`); DB size vs plan; storage vs quota;
  triage queue depth (unassigned files) per batch.
- **Backups:** Supabase Pro daily backups, 7-day retention. PITR is a paid add-on
  (from $100/mo per the pricing page — **UNCONFIRMED** for this project's needs).
  Export a batch snapshot (DB dump of the batch's rows + `audit_log`) to the
  `exports` bucket at batch close as a cheap second copy.
- **Runbook (v1):** paused project → restore from the Supabase dashboard; dead
  worker → restart the Railway/Fly/VPS service, jobs resume from checkpoints;
  Drive 403 spike → check the API key restrictions + quota in Cloud Console;
  LLM cost spike → check `llm_runs` by prompt version, freeze re-runs, lower the
  batch cap; triage queue growing → the sheet import is stale or a folder
  structure changed — re-import the sheet before re-crawling.
- **Runbook (v1.2 additions):** KTP OCR failing on every card → check the
  preprocessing flags and the Tesseract `ind+eng` install on the worker (a
  missing language pack fails all runs the same way); jury stuck on `pending` →
  the verdict exists but the assessor has not confirmed/overridden it — it is a
  human queue, not a job failure; sign-off returning `NO_ACTIVE_SIGNATURE` →
  the assessor's signature was deactivated or never uploaded — upload in
  Settings → My signature; export returning `EXPORT_FORMAT_NOT_ALLOWED` → the
  client requested a format the export rule forbids (PDF for a non-AK.05
  document) — offer the allowed format, do not retry.
- **Runbook (v1.3 additions):** an encrypted 06B key stuck in `blocked` → the
  assessor supplies the password at the key-upload step (the holder is the
  assessor, per scheme's PASSWORD Excel file — D12); an unencrypted key must
  never prompt for a password — if it does, the encryption detection is broken,
  not the file; a key file flagged for embedded images → the assessor reviews
  the flagged images before grading runs; a jury proposal that is not the KTP
  spelling → treat as a defect (the proposal rule is KTP-authoritative, D6),
  do not confirm it; a combined report carrying an overall % as a decision →
  the report template is stale, regenerate from the v1.3 template.
- **Runbook (v1.4 additions):** provider test failing (`POST /llm/provider/test` returns auth error) → the key is wrong or expired — re-supply it in Settings → LLM provider; the key is never in a log, so check the provider's dashboard, not the logs; a batch stuck at intake with `MANIFEST_FILE_MISSING` → supply the missing file or correct the manifest (`lsp_admin` only) — never hand-edit the file list; a roll-up stuck on `pending` → the assessor has not confirmed/overridden the AI's VATM recommendation — it is a human queue, not a job failure; a similarity flag with no spans → the flag is a defect (D19 requires evidence details), re-run the similarity job.

## 11. Mermaid — deployment & sequence

```mermaid
sequenceDiagram
  participant A as Assessor
  participant W as Next.js (Vercel)
  participant S as Supabase
  participant Q as Queue (pg-boss)
  participant K as Worker
  participant D as Drive API
  participant L as LLM
  A->>W: POST /batches/{id}/assessees/import-sheet
  W-->>A: 202 + job_id (sheet first — triage needs it)
  A->>W: POST /batches/{id}/ingest (Drive URL, scope)
  W->>S: INSERT drive_ingest_jobs (queued)
  W->>Q: enqueue crawl job
  W-->>A: 202 + job_id
  K->>Q: consume crawl job
  K->>D: files.list (pageSize=100, pageToken)
  K->>S: persist drive_files tree
  K->>Q: enqueue per-file jobs
  K->>D: files.get alt=media / files.export
  K->>S: INSERT extracted_text + documents
  K->>S: UPDATE job (done/failed counts)
  A->>W: GET /batches/{id}/triage (confirm assignments)
  A->>W: POST /dit/{id}/analyse
  W->>S: completeness gate (422 if inputs missing)
  W->>Q: enqueue llm_gap_analysis
  K->>L: generateObject (Zod, temp 0, registry prompt version)
  K->>S: INSERT coverage_matrix, gap_questions, question_bank_13, readiness_assessments, llm_runs
  A->>W: POST /assessees/{id}/identity/ocr-run
  W->>Q: enqueue ocr_ktp
  K->>S: INSERT ocr_runs (redacted text only; raw text never stored)
  K->>Q: enqueue name_jury
  K->>L: generateObject (name_jury prompt, pseudonym, redacted names only)
  K->>S: INSERT name_jury_verdicts (pending)
  A->>W: POST .../identity/jury/confirm (or /override)
  W->>S: UPDATE identity_verification (certificate_name + source + confirmed_by/at)
  A->>W: POST /assessors/me/signature (upload PNG)
  A->>W: POST /ak05/{id}/sign-off
  W->>S: apply caller's ACTIVE signature (document_signatures row)
  A->>W: POST /ak05/{id}/submit
  W->>S: check decisions + certificate_name_confirmed + row scope + active signature
  W-->>A: 200 submitted (or 422 with blocking items)
  participant T as TUK/LSP
  T->>W: POST /ak05/{id}/accept (or /return with reason)
```

## 12. Decisions log (architecture)

| # | Decision | Alternative rejected | Why |
|---|---|---|---|
| 1 | Next.js + TypeScript | SvelteKit (smaller bundles), Laravel (queues/forms) | Largest AI + Supabase ecosystem; easiest handover; AI SDK is Next-first |
| 2 | Supabase (Postgres/Auth/Storage/pgvector) | Self-hosted Postgres, Firebase | Free tier fits the prototype; RLS + pgvector in one place; Pro removes all first walls for $25 |
| 3 | Async worker, never serverless for heavy work | Vercel functions / Edge Functions alone | Timeouts (10s–300s, UNCONFIRMED) and 2 s CPU make serverless unfit for Drive/OCR/LLM |
| 4 | Drive API key (public folders) | OAuth, service account, HTML scraping | Simplest correct choice for public links; scraping is unsupported and breaks silently |
| 5 | Originals stay in Drive | Re-upload to Supabase Storage | Storage wall at ~70–125 candidates on Free; egress 5 GB/mo |
| 6 | ~~GPT-4o-mini primary, provider-swappable~~ **SUPERSEDED in v1.4 by D18: provider-agnostic, free-first, BYOK — no primary model** | Gemini 3.8 Flash, Claude Haiku (as the fixed primary) | Best verified price:quality ($0.15/$0.60); Gemini pricing volatile + 2.5 deprecation — that was the v1.0–v1.3 rationale; v1.4 makes provider + model runtime config, user-supplied (§7.4, §8) |
| 7 | Rules-first grading, LLM for partial credit | Pure-LLM grader | The 06 form requires professional judgement; a pure-LLM grader is not defensible |
| 8 | Similarity = flag, never verdict | Auto-fail above a threshold | No BNSP-wide threshold exists; VATM "Asli" is the assessor's judgement |
| 9 | **pg-boss queue (decided v1.1)** | BullMQ/Redis (kept as the 100× escape hatch) | One datastore, no extra service/cost; queue state and the state it guards live in one transaction; batch-shaped workload, not latency-shaped (doc 06 §8) |
| 10 | Prompt registry in Postgres (versioned templates) | Prompt text in code files | Auditability: every run points at an immutable version; approval is a workflow, not a commit |
| 11 | Model answers assessor-only, never candidate-facing | Draft candidate answers from the presentation | VATM "Asli" — the system must not write the candidate's evidence (D1 resolved) |
| 12 | Encrypted 06B key: password per-request, never stored | Store the password / commit the PASSWORD file | The key is the grading anchor; a stored password in a public-repo project is a leak waiting to happen |
| 13 | Repo is never a data store (CI privacy scan) | Treat the repo as a backup of assessee data | UU PDP: assessee personal data in a public git repo is a breach, not a backup (§7.6) |
| 14 | **Name jury + KTP OCR (v1.2)** | Auto-decide the certificate name from OCR / auto-merge the four names | The jury proposes with evidence; only the assessor's confirm/override writes the name. Auto-merge is how certificates get printed wrong — and the KTP image must never reach an LLM (§5.9, §7.3) |
| 15 | **Export rule D8 decided (v1.2)** | PDF for every form | One PDF builder to maintain, and the LSP's own workflow prints/forms from DOCX; AK.05 is the only artefact the TUK/LSP receives in both formats (§5.4) |
| 17 | **Certificate-name rule: KTP is the authority (v1.3, D6 — closes OQ-06)** | KTP vs ijazah as canonical; auto-merge the four names | The KTP is the government ID and the certificate name is its name verbatim; the other three sources are compared against it and discrepancies resolve to the KTP spelling (e.g. surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean"). A jury proposal on mismatch_resolved is always the KTP spelling (§5.9, §7.3) |
| 18 | **Pass-mark shape: per-question verdicts + error summary + separate qualitative plagiarism report; no overall % as the decision (v1.3, D7 refined)** — **roll-up default SUPERSEDED in v1.4 by D16** | A numeric overall % or coverage cut as the pass/fail | Follows Moza's Test Grader app: the decision is the verdict (Benar / Sebagian / Salah) + the assessor's per-item judgement and the AI's VATM judgement per unit, confirmed by the assessor (D16, OQ-04 answered). No numeric threshold is invented (§5.3, §5.8) |
| 19 | **06B password: holder = assessor at runtime (v1.3, D12 — OQ-14 answered in part)** | Store the password / derive it from the scheme | Each scheme's 06B ships with a PASSWORD Excel file; the assessor supplies the password at the key-upload step, per-request, never stored. The extractor detects encryption first — an unencrypted copy is parsed directly with no password (§5.7, §7.4) |
| 20 | **Upload flow: scheme + scheme-level forms registered ONCE per scheme; per batch only Drive link(s) + Kelompok Asesi (v1.4, D13)** | Re-present the scheme + all forms at every batch | The assessor's question was "must I present all of those every time?" — no. Blanks live at scheme level; filled 04A/04B/09 copies are ingested from the Drive folder per batch; direct upload is the fallback (§5.1) |
| 21 | **FR.IA.04B is the official form: 13 built-in questions, Ya/Tidak per KUK, binary recommendation (v1.4, D14 — closes OQ-02)** | The RCTFA bank as the 04B assessment | The real 04B form (verified from the zip + repo, same size 230,417 B) carries 4 Kelompok Pekerjaan, 13 built-in questions (one per unit); evidence = DIT task + presentation. The bank stays a separate assessor artefact (§5.2) |
| 22 | **No "Kompeten Bersyarat" (v1.4, D15 — closes OQ-03)** | Keep it as a readiness suggestion | Binary K/BK only. The AK3U scheme §9.3.4 has only Kompeten / Belum Kompeten, and the 04B form offers only those two; no prompt may emit the third value even as a suggestion |
| 23 | **AI judges the roll-up, VATM-based; assessor confirms/overrides (v1.4, D16 — answers OQ-04)** | Assessor's judgement per KUK as the roll-up default (v1.3) | The scheme's own rule (§9.3.3–9.3.4): evidence meeting VATM → "Kompeten", otherwise "Belum Kompeten"; NO numeric pass mark. The AI judges VATM sufficiency per unit and recommends K/BK; the assessor confirms or overrides. The record stores the AI's VATM reasoning + the confirm/override (§5.3, §6) |
| 24 | **Multi-scheme by default — per-scheme file manifest (v1.4, D17)** | AK3U-only by default; hard-coded file lists | Each scheme registers its own manifest (forms, file patterns, required flags, instrument roles) PLUS question counts, decision-rule reference, prerequisites, registration requirements. The manifest drives intake validation (422 when a manifest-required file is missing). AK3U values are AK3U's only; no other scheme's values are invented (§1, §5.1, §6) |
| 25 | **Provider-agnostic, free-first, BYOK (v1.4, D18)** | A fixed primary model (GPT-4o-mini) | Provider + base URL/gateway + model + key are runtime config, user-supplied (Anthropic, OpenAI-compatible, Gemini, OpenRouter / OmniRouter / 9Router, Nvidia NIM, etc.); keys stored locally (browser) and sent per request, never logged, never committed, never in the DB in plaintext — only a key reference is stored. No provider is claimed free (§3, §7.4, §8) |
| 26 | **Numeric similarity thresholds + details (v1.4, D19 — refines OQ-08)** | Qualitative report only, no numeric flag | Flags use per-scope NUMERIC thresholds WITH evidence details (spans, shared unique errors); the qualitative Bersih/Waspada report stays the human-facing summary. Threshold VALUES stay UNCONFIRMED (calibration) (§5.8) |
| 27 | **Dashboard look: paulcodes4 "Dashboard V18" (v1.4, D20)** | Any default dashboard | Modern & minimal, elegant analytics cards, smooth charts, clean white-and-blue theme, premium, responsive; grounded by Moza's screenshot 2026-11-18 01:25 (dark sidebar + light content, glassmorphism stat cards, hover lift). One-line direction in this doc; the detailed restyle is doc 08/13's work (§3) |
| 28 | **Zero hardcoding — config-based system (v1.4, D21)** | Literals in code with config for the big items only | NO hardcoded values at all, for anything. Every value that varies by scheme, org, or deployment comes from config: scheme names and manifests, question counts (never a literal 13 in code — 13 is only the AK3U manifest's value), decision rules, thresholds, prerequisites, requirements, roles, export formats, providers, models, temperatures, UI labels. A fallback for a missing config is itself a config value (§1, doc 06 §5.7) |

## 13. Open questions

1. Vercel function timeout (official figure) — UNCONFIRMED; verify on `vercel.com/docs`.
2. Supabase Jakarta region availability — UNCONFIRMED; verify at project creation.
3. LLM provider DPA / data-retention terms — UNCONFIRMED; verify before the first live batch. **v1.4 (D18):** the provider is user-chosen (BYOK), so the DPA check is per chosen provider, not per a fixed primary.
4. `tuk_admin` visibility: assessee names or pseudonyms only?
5. Export formats: DOCX only, or DOCX + PDF for every form? **DECIDED in v1.2
   (D8): AK.05 = PDF + DOCX; every other generated document = DOCX only; XLSX
   only for tabular data extracts.**
6. ~~FR form fidelity: validate exports against the LSP's real blank forms (no samples in research).~~ **Resolved in v1.1: real AK3U blanks extracted in
   `research/form-blanks-extracted.md`; export templates are validated against
   them (doc 06 §7). Remaining: same extraction for the Migas and ICT schemes.**
7. Webhook for job completion, or polling + Realtime only?
8. Per-scope similarity thresholds, partial-credit cut, trigram threshold,
   batch LLM budget cap — **UNCONFIRMED**; LSP to confirm before the first
   live batch. **v1.4 note:** the pass-mark *shape* is decided (per-question
   verdicts + error summary, no overall % — §5.3) AND the roll-up is answered
   (D16, OQ-04): the AI judges VATM sufficiency per unit and recommends K/BK;
   the assessor confirms or overrides. Numeric similarity thresholds + details
   is the decided mechanism (D19); only the threshold VALUES (calibration) and
   the partial-credit cut value stay open.
9. Certificate-name rule — **DECIDED in v1.3 (D6, closes OQ-06): the KTP is
   the authority** — the certificate name is the KTP name verbatim; surat
   tugas, APL.01, ijazah are compared against the KTP and discrepancies
   resolve to the KTP spelling (surat tugas "Declan Rice P." vs KTP "Declan
   Rice Pangabean" → "Declan Rice Pangabean").
10. KTP OCR confidence threshold (`identity.ktp_ocr_min_confidence`) — **UNCONFIRMED (v1.2)**.
11. Jury confidence cut (`jury.min_confidence`) — **UNCONFIRMED (v1.2)**.
12. Signature upload virus scanning — no scanner chosen; **UNCONFIRMED (v1.2)**.
13. Signature legal standing — whether the LSP/BNSP accepts an uploaded signature
    image on the generated document as the signed original (vs a wet signature on
    the printed form) — **UNCONFIRMED (v1.2)**.
14. 06B key password holder + FR.IA.07-key fallback — **answered in part in v1.3
    (D12)**: each scheme's 06B ships with a PASSWORD Excel file; the holder is
    the assessor, who supplies the password at runtime (key-upload step) — never
    stored, never logged, never recorded. Whether the FR.IA.07 key text may serve
    as the fallback acceptable-points source when the 06B file is unavailable
    stays **UNCONFIRMED**.
15. Per-scheme manifests for schemes other than AK3U (e.g. Petugas K3: file set, question counts, decision rule, prerequisites, registration requirements) — **UNKNOWN; they come from that scheme's own scheme document and blank forms, never invented.** AK3U's manifest values are AK3U's only. Scheme-document currency (2021 scheme vs 2023 MUK) stays open (OQ-11).

---

*End of doc 12 v1.4.*
separately; the canonical decisions in the header of each Group B doc are the
shared source of truth across both groups.*
