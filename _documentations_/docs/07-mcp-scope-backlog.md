# 07 — MCP Scope and Backlog

**Project:** AsesorKompetensi — LSP/BNSP assessor web app (OHSE-first, general certification)
**Version:** v1.4 — 18 November 2026 · **Status:** Draft for review · **Repo:** https://github.com/danste-kun/asesorkompetensi
**Changelog v1.4:** scheme document found (OQ-01 answered — AK3U 2021 scheme, LSP HSE Indonesia; no numbered KKNI level); official 04B form answered (OQ-02 — 4 Kelompok Pekerjaan, 13 built-in questions, Ya/Tidak per KUK); no "Kompeten Bersyarat" (OQ-03 closed); AI judges the roll-up, VATM-based (OQ-04 answered — scheme §9.3.3–9.3.4, no numeric pass mark; replaces the v1.3 assessor-judgement default); multi-scheme manifest (D17 — per-scheme file set, question counts, rules, prerequisites, requirements; AK3U is one manifest); provider-agnostic BYOK, free-first (D18 — no GPT-4o-mini primary; MCP never serves provider keys); numeric similarity thresholds + details (D19 — values UNCONFIRMED); dashboard design language from the Dashboard V18 screenshot (D20 — glass-card, hover lift, dark sidebar, StatsCard); **no hardcoded values at all — config-based throughout (D21, top-level canonical rule)**. **Changelog v1.3:** certificate-name rule decided (D6 — the KTP is the authority; OQ-06 closed); pass-mark shape decided (D7 — per-question verdicts + Ringkasan Kesalahan, no overall %; roll-up default is assessor judgement per KUK, OQ-04 stays open on the roll-up rule only); 06B key structure verified (D12 — plain working key vs encrypted blank, PASSWORD xlsx, runtime-only password); T14 combined-report shape confirmed (per-question tables + error summary + separate qualitative similarity section). **Changelog v1.2:** name jury + KTP OCR tools (T19/T20, read-only verdict; confirm/override stay human-only) + guardrails G11–G13; export-format rule enforced (AK.05 PDF + DOCX, every other generated document DOCX only — D8 decided); assessor signature is never applied or served by MCP (G13). Changelog v1.1: combined-report tool (T14, single Markdown report, grading + similarity); prompt-registry tools (T15/T16, read-only); triage tools (T17/T18); completeness-gate precondition on T7; AK.05-via-MCP stays P1 with the reason stated in §6 (MCP-09/MCP-10); pseudonym rule (G10) and model-answers rule (G9) added. Repo note: the repo is no longer empty — it now holds the scheme blank forms, completed-batch records, and the Nov 2026 batch data (517 files); the MCP server never serves assessee personal data from the repo, only from the app database.
**Companion docs:** PRD (02), BRD (03), ERD (04), API Contract (05), Technical Design (06).
**Language:** Docs in English; Indonesian form names preserved. UI and AI reports in Bahasa Indonesia.

## 1. What "MCP" means here

MCP = **Model Context Protocol**. In this system it has two directions, and they must not be conflated:

| Direction | Meaning | Owner |
|---|---|---|
| **A. System as MCP server** | AsesorKompetensi exposes tools that an MCP client (e.g. an assessor's AI assistant / Claude Desktop / another agent) can call to work on a batch. | This document |
| **B. System as MCP client** | The app itself calls external MCP servers (e.g. a Google Drive MCP server, a document-extraction MCP server) instead of hand-rolling every integration. | This document, §5 |

**Scope decision (canonical):** MCP is an **integration layer, not the product**. The web app must work fully without any MCP client. No assessor workflow may depend on MCP being connected. MCP tools are read-mostly and analysis-triggering; **no MCP tool may write a K/BK decision, confirm a certificate name, or finalise FR.AK.05**. Those are human actions in the web UI only (see §4, Guardrails).

**What MCP is NOT in this project:** it is not a replacement for the REST API (05), the job queue, or Supabase RLS. MCP tools call the same service layer and the same RLS-scoped queries as the REST API — they are a second front door, not a second backend.

## 2. Principles

1. **Same rules, both doors.** Every MCP tool enforces the same checks as the UI: authentication, batch scoping (assessor sees only their own batch), PDP redaction (NIK/KTP never sent to an LLM — UU 27/2022), and audit logging.
2. **Tools are narrow and verifiable.** One tool = one job, with a typed input/output schema. A tool that "does the assessment" is out of scope.
3. **Async by default.** Anything that touches Drive, OCR, embeddings, or LLM grading enqueues a job and returns a `job_id`. Tools never block waiting for a 500-file scan.
4. **AI output is a recommendation.** Tool outputs carry `ai_recommendation: true` and `requires_human_confirmation: true` where applicable. No tool returns a verdict phrased as final.
5. **Deterministic before LLM.** Similarity and grading tools return deterministic scores (TF-IDF cosine, n-gram overlap, exact-match) alongside any LLM summary. The LLM never replaces the deterministic layer.
6. **Config, not code.** Form-suffix mapping (06B = key under MUK 2023, configurable per LSP), question-bank count (default 13), similarity thresholds, and unit lists live in `app_config` / scheme config — never in tool code. **v1.4 (D17):** each scheme registers a **manifest** in scheme config — its file set, its question counts (04B built-in count, 06A essay count, question-bank default count), its decision/assessment rules reference, its prerequisites, and its registration requirements. AK3U's values (13 questions, and so on) are AK3U's manifest values only; no other scheme's values are assumed.

## 3. MCP server surface (system as server)

Transport: MCP over HTTP (Streamable HTTP) at `/api/mcp`, plus stdio for local dev only. Auth: per-assessor API token (scoped to `assessor_id` + batch list), revocable, shown once at creation. Rate limit: 60 tool calls/min/token (configurable). All calls logged to `audit_log` with `actor_type = 'mcp_token'`.

### 3.1 Tool catalogue

| # | Tool | Purpose | Input (key fields) | Output (key fields) |
|---|---|---|---|---|
| T1 | `list_batches` | List batches the token may access | `status?`, `limit?` | `batches[]: {id, scheme_name, tuk_name, assessment_date, assessee_count, status}` |
| T2 | `get_batch_summary` | Completeness + identity + decision roll-up for one batch | `batch_id` | `completeness{by_doc_type, missing[]}`, `identity_mismatches[]`, `decisions{k,bk,undecided}` |
| T3 | `drive_scan_start` | Start a Drive ingest job for a public folder URL | `batch_id, drive_folder_url, source_label` | `job_id, status: queued, estimated_files?` |
| T4 | `drive_scan_status` | Poll an ingest job (paginated, resumable) | `job_id, page?, page_size?` | `status, files_total, files_done, files_failed, failures[], next_page_token?` |
| T5 | `list_unmatched_files` | Files the classifier could not map to a doc type / assessee | `batch_id, limit?` | `files[]: {file_id, drive_path, mime_type, size, suggested_type?, confidence}` |
| T6 | `get_candidate_profile` | Pseudonymised profile + extracted text refs for one assessee (no KTP image, no NIK) | `batch_id, assessee_id` | `profile, documents[]: {doc_type, extracted_text_ref, extraction_confidence, method}` |
| T7 | `analyse_dit` | Trigger DIT (FR.IA.04A) analysis for one assessee (coverage matrix + gap questions + question bank) | `batch_id, assessee_id, question_count? (default = the active scheme's manifest value; 13 for AK3U, never hard-coded)` | `job_id` (+ result via T8). **Completeness-gate precondition (v1.1):** if any required input is missing (FR.IA.04A file, presentation/transcript, candidate profile), the tool does NOT enqueue; it returns error `incomplete_inputs` with `missing[]` listing exactly which inputs are absent. Analysis is delayed until complete — never run on partial inputs. |
| T8 | `get_dit_analysis` | Fetch a completed DIT analysis | `analysis_id` | Coverage matrix, gap questions with TS/TMS/CMS/JRES/TrS labels, question bank, readiness estimate (readiness_pct, strengths, critical gaps, follow-up actions; readiness *recommendation* is a note field, never a decision), `model`, `prompt_version`, evidence quotes |
| T9 | `grade_written_test` | Trigger FR.IA.06 grading (06B key vs 06C answers) for one assessee | `batch_id, assessee_id, form_version_id` | `job_id`. If the 06B key file is encrypted, the tool returns error `key_locked` (see §3.4) instead of enqueueing. |
| T10 | `get_written_grading` | Fetch grading result | `grading_id` | Per-question `correct / partial / incorrect`, master vs student spans, explanation (Bahasa Indonesia), assessor-confirmation status |
| T11 | `similarity_report` | Trigger/fetch cross-assessee similarity for a batch (DIT and/or 06C) | `batch_id, scope: dit \| written \| both` | `job_id` or report: top pairs, per-question overlap, shared-error spans, `flag_only: true`. **v1.4 (D19):** flags use per-scope **numeric thresholds with evidence details** (spans, shared unique errors); the threshold values are config and **UNCONFIRMED** (calibration) — no number is asserted here. The qualitative status (Bersih / Waspada) stays as the human-facing summary alongside the numeric flag. |
| T12 | `get_ak05_draft` | Fetch the FR.AK.05 draft (per-assessor, per-batch) as structured data | `batch_id, assessor_id` | `rows[]: {assessee, recommendation_k_bk, notes}`, `status: draft`, `blocked_by[]` (e.g. unconfirmed names) |
| T13 | `export_ak05` | **Request** (not execute) an AK.05 export; returns a job | `batch_id, assessor_id, format: pdf \| docx` | `job_id, download_url` (when done; URL expires, audit-logged). **Export-format rule (v1.2, D8 decided):** AK.05 is the ONLY generated document that may be exported as PDF. Every other generated document is DOCX only — a PDF request for any non-AK.05 document is rejected with error `format_not_allowed`. Tabular data extracts (audit log, completeness matrix) may additionally be XLSX, as data, not as documents. The combined Markdown report (T14) is a data report, not a generated FR document, and keeps its Markdown format. |
| T14 | `combined_report` | Fetch (or trigger generation of) the single combined Markdown report for a batch: per-assessee 06 grading tables + cross-assessee similarity section, entirely in Bahasa Indonesia (v1.1, P0) | `batch_id` | `report_id, report_markdown, generated_at, prompt_version` — or `job_id` if generation is still running. The report is built from stored verdicts/pairs, never re-graded on the fly; the LLM similarity summary inside it is the stored `llm_run`, not a fresh call. **v1.2:** the Markdown format is unchanged by the export-format rule — the rule governs generated FR *documents* (AK.05, AK.02, 04B, graded 06); the combined report is a data report, not a document. **v1.3:** shape confirmed — the grading tables are per-question verdicts (Benar / Sebagian / Salah) with Bahasa Indonesia explanations plus a per-student error summary (Ringkasan Kesalahan), and the similarity section is a separate qualitative section (Bersih / Waspada + reasoning, never a numeric plagiarism verdict); no overall percentage is used as a pass/fail anywhere in the report (D7 decided). |
| T15 | `list_prompts` | List prompt-registry entries: prompt key, scheme, versions, active version, source hash (v1.1, P1) | `scheme_id?` | `prompts[]: {prompt_key, scheme_id, versions[]: {version, created_at, source_sha256, active}}` |
| T16 | `get_prompt` | Fetch one prompt version: adapted template text + adaptation notes + source-file reference (v1.1, P1) | `prompt_key, version` | `prompt_key, version, template_text, source_file, source_sha256, adaptations[]` (e.g. "Kompeten Bersyarat removed — see doc 15 §2.1 rule 3"). Read-only: no tool creates or edits a prompt version. |
| T17 | `list_unassigned` | List triage items for a batch: files with no assessee/assessor and assessees with no assessor (v1.1, P0) | `batch_id, kind?: files \| assessees \| both` | `files[]: {file_id, drive_path, suggested_assessee?, confidence}`, `assessees[]: {assessee_id, pseudonym, suggested_assessor?, reason}` |
| T18 | `assign_triage` | Assign triaged files/assessees to an assessor (v1.1, P0) | `batch_id, assignments[]: {file_id? \| assessee_id?, assessor_id}` | `assigned[], rejected[]: {item, reason}`. Restricted to `ketua_tim` / `lsp_admin` tokens; every assignment is audit-logged. Assignment is a routing decision, not an assessment verdict — it may be proposed by a tool, but the assessor's K/BK decision, name confirmation, and AK.05 finalisation stay human-only (see §4). |
| T19 | `run_ktp_ocr` | Trigger local KTP OCR for one assessee (v1.2, P0) | `batch_id, assessee_id` | `job_id` (+ OCR text via T20). OCR runs locally in the worker (Tesseract `ind+eng`) — never an LLM call, never an external service. If no KTP image is on file, the tool returns error `no_ktp_image` instead of enqueueing. |
| T20 | `get_name_jury_verdict` | Fetch the name-jury verdict for one assessee — READ ONLY (v1.2, P0) | `batch_id, assessee_id` | `verdict: match \| mismatch_resolved \| needs_human`, `proposed_certificate_name?`, `reasoning` (Bahasa Indonesia), `evidence[]: {source, span}`, `ocr_confidence`, `ocr_text`, `model`, `prompt_version`, `status: pending_confirmation \| confirmed \| overridden`. The verdict becomes the certificate name ONLY after assessor confirmation (or override) in the web UI — never through this tool. **v1.3 (D6 decided):** the proposed certificate name is always the KTP spelling — The KTP (government ID) is the authority: the certificate name is the KTP name, verbatim. Surat tugas, APL.01, and ijazah are compared against the KTP, and any discrepancy resolves to the KTP spelling — surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean". |

**Explicitly out of scope as tools:** `set_decision`, `confirm_certificate_name`, `finalise_ak05`, `accept_ak05`, `return_ak05`, `confirm_name_jury_verdict`, `override_name_jury_verdict`, `apply_signature`, `get_signature`, `delete_*`, `update_config`, `create_prompt_version`, `edit_prompt`, any tool that writes to Drive, and any tool that returns a KTP image, a NIK, or an assessor signature image. AK.05 accept/return are sign-off decisions made by a human in the web UI only (see doc 05 v1.1 / doc 13 §10 v1.1); no MCP tool performs them. If a client asks for one, the server returns `method_not_found` with a pointer to the web UI.

### 3.2 Tool schemas (illustrative — normative schemas live in `src/mcp/tools/*.ts` with Zod)

```typescript
// T3 drive_scan_start — input
{ batch_id: string (uuid), drive_folder_url: string (url),
  source_label: string, // e.g. "Persyaratan Pelatihan AK3 Umum BNSP"
  max_depth?: number /* default 4 */ }
// output
{ job_id: string, status: "queued", accepted_at: string (ISO) }

// T7 analyse_dit — input
{ batch_id: string, assessee_id: string,
  question_count?: number /* default 13, from scheme config; min 1, max 30 */ }
// output
{ job_id: string, status: "queued" }

// T11 similarity_report — output (report form)
{ batch_id: string, scope: "dit" | "written" | "both",
  pairs: [{ a_assessee_id, b_assessee_id, question_no?,
             tfidf_cosine: number, ngram_overlap: number,
             shared_spans: string[], shared_errors: string[],
             verdict: "coincidental" | "review" | "indicative" /* LLM-assisted, flag only */ }],
  generated_at: string, model: string | null, prompt_version: string | null }
```

// T7 analyse_dit — completeness-gate failure (v1.1)
// error: { code: "incomplete_inputs", retryable: false,
//          missing: ["fr_ia_04a", "presentation_transcript"],
//          message: "Analisis ditunda: FR.IA.04A dan transkrip presentasi belum lengkap." }

// T14 combined_report — output (report form)
{ batch_id: string, report_id: string, generated_at: string,
  language: "id", // the whole report is Bahasa Indonesia — asserted in QA SIM-08
  report_markdown: string, // per-assessee grading tables + similarity section, one document
  prompt_version: string | null, model: string | null }

// T17 list_unassigned — output
{ batch_id: string,
  files: [{ file_id, drive_path, mime_type, suggested_assessee_id?, confidence }],
  assessees: [{ assessee_id, suggested_assessor_id?, reason }] }

Error shape (all tools): `{ error: { code, message_id, message, retryable: boolean, job_id? } }`.
Codes: `unauthenticated`, `forbidden_batch`, `not_found`, `validation_error`, `job_failed`, `rate_limited`, `method_not_found`, `incomplete_inputs` (v1.1 — completeness gate, T7), `key_locked` (v1.1 — encrypted 06B key, T9), `format_not_allowed` (v1.2 — PDF requested for a non-AK.05 document), `no_ktp_image` (v1.2 — T19 with no KTP on file).

### 3.5 Name jury + KTP OCR (v1.2, D10)

The AI agent inside the app is the **jury** on the name verdict — it does not decide the certificate name, it recommends, and the assessor confirms:

- **OCR is local, never an LLM.** Tesseract (`ind+eng`) in the worker reads the KTP image and extracts the name text with a per-field confidence. The KTP image is never sent to any LLM, any MCP client, or any external service. If the OCR confidence is below the configured floor, the jury returns `needs_human` with no proposed name (the floor value itself is **UNCONFIRMED** — config, see doc 10 §10).
- **The jury compares four name sources** — KTP (OCR text), APL.01, surat tugas, ijazah — and returns one verdict: `match` (all sources agree), `mismatch_resolved` (sources disagree; the jury proposes one certificate name — always the KTP spelling), or `needs_human` (sources disagree and no safe proposal exists, or OCR confidence is too low). **v1.3 (D6 decided):** The KTP (government ID) is the authority: the certificate name is the KTP name, verbatim. Surat tugas, APL.01, and ijazah are compared against the KTP, and any discrepancy resolves to the KTP spelling — surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean". If the KTP itself cannot be read (OCR confidence below the floor), the jury returns `needs_human` with no proposed name — the KTP spelling is never guessed from another source.
- **Jury exception to the pseudonym rule (G10), stated explicitly.** The jury must compare *real* names — pseudonyms cannot be compared. So, and only for this one prompt, the jury runs on real name strings inside the app's audited LLM path: the payload contains the four name strings + OCR confidence and nothing else — no NIK, no address, no phone, no KTP image, no other personal data. The KTP image itself is never sent. An MCP client calling T20 receives the verdict, reasoning, and evidence spans — never the KTP image and never a NIK.
- **Confirm / override are human-only.** T20 is read-only. There is no tool that confirms a jury verdict, overrides it, or sets a certificate name — those are web-UI actions (doc 08 §3.4 v1.2, doc 13 §6 v1.2), audit-logged with actor + old → new. A jury verdict that is never confirmed changes nothing: the certificate name stays unconfirmed and AK.05 stays blocked.

### 3.4 Encrypted 06B key (v1.1)

The real AK3U 06B key file in the repo (`SKEMA/1. Ahli K3 Umum/…/FR.IA.06B…docx`) failed to parse as a normal OOXML file, and the repo also contains a `PASSWORD FR.IA.06B.xlsx` — the key is password-protected in the LSP's practice. The system therefore treats an encrypted 06B as a normal, expected state, not an error in the data:

- `grade_written_test` (T9) returns `key_locked` when the key file cannot be decrypted with any stored material. It never asks for, accepts, or stores a password over MCP.
- The assessor supplies the password once, in the web UI (doc 08 §3.4 v1.1, doc 13 §8 v1.1), for that grading run only. The password is held in memory for the decryption step, never written to the DB, a log, or an `llm_run`.
- Decryption happens in the worker (`msoffcrypto-tool`, see doc 11 §2/§7 v1.1). If the password is wrong, the job fails with `key_password_wrong` and the assessor retries in the UI; three consecutive failures lock the grading run until an `lsp_admin` reviews it (QA GRD-19).

### 3.3 Resources and prompts (MCP-native, secondary)

- **Resources (read-only):** `asesor://batches/{id}/completeness`, `asesor://schemes/{id}/form-mapping` (the per-LSP 05/06 suffix mapping), `asesor://schemes/{id}/manifest` (v1.4, D17 — the scheme's file set, question counts, rules reference, prerequisites, and registration requirements; AK3U's values are AK3U's only), `asesor://schemes/{id}/units` (AK3 Umum: 13 units M.71KKK01.001.1–013.1 under SKKNI Kepmenaker 38/2019; served from config, not hard-coded), `asesor://batches/{id}/triage` (v1.1 — the unassigned files/assessees from T17), `asesor://prompts/{key}/{version}` (v1.1 — the registry entry from T16), `asesor://batches/{id}/assessees/{assessee_id}/name-jury` (v1.2 — the jury verdict from T20: verdict + reasoning + evidence, never the KTP image, never a NIK).
- **Prompts (templates, not execution):** `dit-gap-analysis` and `written-test-grading` — the versioned prompt texts derived from the user's `prompt_wawancara_k3.md` / `prompt_test_tulis.md` (verbatim sources in `research/prompts/`, see doc 15 §4.4 v1.1), with placeholders. The server returns the prompt text + required inputs; the model call itself happens inside the app's job worker, so prompt version, model, and output are all audited together. Prompt versions are created in code + deploy only; the MCP surface is read-only for prompts (T15/T16).

## 4. Guardrails (non-negotiable)

| # | Guardrail | Enforcement |
|---|---|---|
| G1 | NIK / KTP number / KTP image / full address / phone never leaves the app toward any LLM or MCP client. | Redaction step in the service layer, before tool output serialisation; tested in QA (10). |
| G2 | Similarity is a flag, never an auto-fail. No tool output may state "plagiarised" as a verdict. | Wording allow-list in output schemas; `flag_only: true` on every similarity payload. |
| G3 | Decision is binary K / BK only. No "Kompeten Bersyarat" outcome — not as a decision value, not as a readiness note, not as a report column (v1.4, D15 — OQ-03 closed; the v1.1 free-text-note allowance is removed). | Zod enum `["K","BK"]` everywhere; "bersyarat" appears only inside explicit prohibitions, never as an outcome. |
| G4 | DIT = Daftar Instruksi **Terstruktur** (FR.IA.04A). Official FR.IA.04B is presentation assessment; the user's 13-question bank is a separate artefact. | Separate tool outputs / separate DB tables; never merged. |
| G5 | Assessor sees only their own batch(es). | RLS + token scope check on every tool; cross-batch access returns `forbidden_batch`. |
| G6 | Every tool call is audited (who, when, batch, tool, job_id, outcome). | `audit_log` insert in the MCP handler, before returning. |
| G7 | Long work is a job, never a blocking call. | Tools that scan/grade/analyse return `job_id` in < 2 s; worker does the work. |
| G8 | **Completeness gate (v1.1).** A DIT analysis never runs on incomplete inputs. | `analyse_dit` (T7) returns `incomplete_inputs` + `missing[]` instead of enqueueing when FR.IA.04A, the presentation/transcript, or the candidate profile is absent. The gate is a precondition in the service layer, so the REST API and MCP behave identically. |
| G9 | **Model answers are assessor-only (v1.1).** The system may generate model/expected answers for the assessor to judge against; it never drafts a candidate's answers. | Model answers are served only to `assessor` / `ketua_tim` / `lsp_admin` roles, labelled "Jawaban model — hanya untuk asesor", and never appear in any candidate-facing view, export handed to a candidate, or MCP output to a non-assessor token. |
| G10 | **Pseudonyms to the model, real names in the report (v1.1).** | LLM calls and similarity payloads use assessee pseudonyms (`ASESI-001`); the prompt's "never mix up identities" rule is honoured by resolving pseudonym → exact real name post-hoc, in the app, when the report is rendered. A report row always echoes the `assessee_id` alongside the name. |
| G11 | **Name jury recommends; the assessor confirms (v1.2, D10).** | The jury verdict (`match` / `mismatch_resolved` / `needs_human`) is a recommendation with reasoning + evidence spans + OCR confidence. No MCP tool confirms, overrides, or applies it. An unconfirmed verdict changes nothing — the certificate name stays unconfirmed and AK.05 stays blocked. **v1.3 (D6 decided):** the proposed name is always the KTP spelling — The KTP (government ID) is the authority: the certificate name is the KTP name, verbatim. Surat tugas, APL.01, and ijazah are compared against the KTP, and any discrepancy resolves to the KTP spelling — surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean". |
| G12 | **Export formats (v1.2, D8 decided).** | AK.05 is the only generated document exportable as PDF. Every other generated document is DOCX only; a PDF request for one returns `format_not_allowed`. Tabular data extracts may additionally be XLSX (data, not documents); the combined Markdown report keeps its Markdown format (it is a data report, not a document). |
| G13 | **Assessor signature is never served or applied by MCP (v1.2, D11).** | No MCP tool returns, uploads, or applies an assessor signature image, and no tool applies a signature to a document. Signatures are applied only in the web UI, at sign-off, by the owning assessor (doc 08 §3.4 v1.2). |

## 5. System as MCP client (consuming external servers)

| External server | Used for | Status |
|---|---|---|
| Google Drive MCP server (community / official, if available) | Folder listing as an alternative to direct Drive API v3 calls | **Evaluate in Phase 2.** Default remains direct Drive API v3 + API key (proven, quota-known: `files.list` 100 units/page, pageSize 100). Do not adopt an MCP Drive server until it is verified to handle pagination, `files.export` for Google Docs/Sheets, and 403-on-non-public handling at least as well as the direct API. |
| Document-extraction MCP server | PDF/DOCX/image text extraction | **Evaluate in Phase 3.** Default is in-worker extraction (`pdfjs-dist` / `mammoth` / Tesseract `ind+eng`). Adopt only if it beats Tesseract on real TUK scans in a measured test. |
| LLM provider via Vercel AI SDK | Grading / gap analysis | **Not MCP.** The app calls the provider through the AI SDK (`generateObject` + Zod). **v1.4 (D18):** provider-agnostic, free-first, BYOK — provider + base URL/gateway + model + key are runtime config supplied by the user (Anthropic, OpenAI-compatible, Gemini, OpenRouter / OmniRouter / 9Router, Nvidia NIM, etc.); there is no primary model. Do not route LLM calls through MCP. **MCP never serves provider keys:** no tool returns, lists, or accepts a provider API key, and no key is stored in env files or the database. |

Rule: an external MCP server is adopted only after a written evaluation (accuracy on real batch files, cost, PDP handling, timeout behaviour) is filed in `docs/`. No silent swaps.

## 6. Backlog — prioritised user stories

Priority: **P0** = MVP (ships with first live batch) · **P1** = next batch · **P2** = later.
Story format: *As a [role], I want [goal] so that [benefit].* Acceptance criteria (AC) are testable; "AC" references map to QA Test Plan (10).

### P0 — MVP

| ID | Story | AC | PRD ref |
|---|---|---|---|
| MCP-01 | As an assessor, I want to start a Drive scan from my AI assistant (T3) and poll its progress (T4) so I don't have to watch the web UI for a 500-file folder. | T3 returns `job_id` in < 2 s; T4 shows per-file counts; a killed-and-restarted job resumes from the persisted tree (no re-download of `done` files). | PRD § ingest |
| MCP-02 | As an assessor, I want `get_batch_summary` (T2) to show completeness per doc type and identity mismatches so I can triage the 23-person batch in one call. | Matches the web Batch Detail numbers exactly; identity mismatches list KTP vs APL.01 vs surat-tugas names without exposing NIK. | PRD § identity |
| MCP-03 | As an assessor, I want to trigger DIT analysis (T7) and fetch it (T8) with the coverage matrix, gap questions labelled TS/TMS/CMS/JRES/TrS, and a question bank of exactly the configured count (default 13). | Count assertion passes; every gap question carries a dimension label + linked focus point; every matrix row quotes evidence. **v1.1:** if any required input is missing, T7 returns `incomplete_inputs` with `missing[]` and enqueues nothing (completeness gate, G8). |
| MCP-17 | As an assessor, I want one combined report (T14) for the batch — per-assessee grading tables plus the cross-assessee similarity section, in a single Markdown document entirely in Bahasa Indonesia — so I can hand one document to the Ketua Tim instead of two separate outputs. | The report contains both sections; every grading row echoes the assessee's exact name + `assessee_id`; the similarity section names pairs, question numbers, shared spans, and shared unique errors with a coincidental-vs-indicative label; the whole document is Bahasa Indonesia (QA SIM-08). |
| MCP-18 | As a Ketua Tim, I want to list unassigned files/assessees (T17) and assign them to assessors (T18) from my assistant, so a single flat shared folder can be split across assessors without opening the web UI. | Unassigned items are listed with a suggested assessee/assessor + confidence; assignments are audit-logged and restricted to `ketua_tim`/`lsp_admin` tokens; an assessor token calling T18 gets `forbidden_batch`. | PRD § DIT |
| MCP-04 | As an assessor, I want to trigger written-test grading (T9/T10) that grades 06C against the 06B key per question (`correct / partial / incorrect`) with master-vs-student spans in Bahasa Indonesia. | Deterministic exact-match runs before the LLM; LLM output validated against Zod; no identity is ever mixed up (assessee_id echoed on every row). | PRD § grading |
| MCP-05 | As an assessor, I want a similarity report (T11) that names pairs, question numbers, shared spans and shared errors, and says only "review" / "coincidental" / "indicative" — never an auto-fail. | Known copy-paste pair scores high on TF-IDF + n-gram; paraphrase pair scores lower but is flagged by embeddings (if enabled); unrelated pair is not flagged. | PRD § similarity |
| MCP-06 | As an LSP admin, I want every MCP call audit-logged and token-scoped so a leaked token cannot read another assessor's batch. | Cross-batch call → `forbidden_batch`; revoked token → `unauthenticated`; audit row exists for every call incl. failures. | PRD § security |
| MCP-07 | As a developer, I want all MCP tools to share the service layer and Zod schemas with the REST API so a fix in one fixes both. | No tool implements its own DB query or grading logic; import graph test passes. | Tech Design (06) |
| MCP-20 | As an assessor, I want to check the KTP OCR status and the name-jury verdict for an assessee from my assistant (T19/T20), so I know whether the certificate name is ready to confirm without opening the web UI. | T19 enqueues a local OCR job (never an LLM call) and returns `job_id`; T20 returns the verdict (`match` / `mismatch_resolved` / `needs_human`) with reasoning, evidence spans, and OCR confidence; the verdict is labelled as a recommendation needing human confirmation; no tool confirms or overrides it. | PRD § identity |
| MCP-21 | As an assessor, I want a PDF request for a non-AK.05 document to be refused cleanly, so an assistant cannot accidentally produce a format the LSP does not accept. | Any export tool call requesting PDF for a non-AK.05 document returns `format_not_allowed` with the allowed format named; AK.05 accepts `pdf` or `docx`. | PRD § export |

### P1 — Next batch

| ID | Story | AC |
|---|---|---|
| MCP-08 | As an assessor, I want `list_unmatched_files` (T5) with a suggested doc type + confidence so I can map messy Drive files quickly. | Suggestion accuracy ≥ 80% on the real 23-person batch's unmatched set; low-confidence files stay in the review queue, never auto-mapped. |
| MCP-09 | As an assessor, I want `get_ak05_draft` (T12) via MCP so my assistant can draft the covering note, while finalisation stays in the UI. | Draft rows match the UI exactly; `blocked_by` lists unconfirmed certificate names; no finalise tool exists. **v1.1 decision: stays P1.** Reason: AK.05 is a human sign-off document; MCP's job in the first live batch is read + analysis-triggering, not submission-adjacent work. Draft-via-MCP adds a second surface for the most sensitive document in the system before the UI flow is proven in UAT. It moves to P0 only if a live batch demonstrates assessors actually drafting via an assistant. |
| MCP-10 | As an assessor, I want `export_ak05` (T13) to return an expiring download link for the PDF/DOCX once the job finishes. | Link expires (configurable, default 1 h); download is audit-logged; export bytes match the UI export for the same draft. **v1.1 decision: stays P1**, for the same reason as MCP-09. Accept/return of an AK.05 is never an MCP tool (see §3.1). |
| MCP-11 | As a developer, I want MCP prompt templates (`dit-gap-analysis`, `written-test-grading`) versioned alongside the prompts so a prompt change is traceable to a grading. | Prompt version stored on every analysis/grading row; re-running with a new version creates a new row, never overwrites. **v1.1:** T15/T16 expose the registry read-only; a new prompt version is created in code + deploy, and old runs are replayable unchanged (QA PRM-01). |
| MCP-19 | As a developer, I want the prompt registry (T15/T16) so any client can prove which prompt version produced a given grading. | `list_prompts` returns versions + source hashes; `get_prompt` returns the adapted text + adaptation notes; no tool edits a prompt. |
| MCP-12 | As an LSP admin, I want per-token rate limits and usage reporting so one client cannot starve the worker. | 429 with `retryable: true` above the limit; usage visible per token per day. |

### P2 — Later

| ID | Story | AC |
|---|---|---|
| MCP-13 | As a developer, I want an evaluated Google Drive MCP server as an optional ingest path (see §5). | Evaluation doc filed; pagination + export + 403 handling verified on a ≥ 200-file test folder; fallback to direct API on any failure. |
| MCP-14 | As an assessor, I want an MCP resource for the scheme's form-version mapping so my assistant can explain why 06B means "key" for this LSP. | Mapping served from config; changing it in config changes the resource without a deploy. |
| MCP-15 | As an LSP admin, I want MCP access per role (read-only tokens for auditors) distinct from assessor tokens. | Auditor token can call T1/T2/T12 only; write/trigger tools return `forbidden_batch` / `method_not_found` as appropriate. |
| MCP-16 | As a developer, I want contract tests that run the MCP tool schemas against the REST API schemas on every CI run. | CI fails if a tool's Zod schema drifts from the API contract. |

## 7. Non-goals (explicit)

- No MCP tool writes decisions, confirms names, or finalises AK.05.
- No MCP-based candidate-facing chat; candidates never touch MCP.
- No MCP server for the public / non-login surface (public sees aggregates only, via the web UI).
- No replacement of the REST API or the job queue by MCP.

## 8. Open questions

1. Which MCP clients will assessors actually use (Claude Desktop? a custom assistant? none yet)? — affects transport priority (HTTP vs stdio). **UNCONFIRMED; default to HTTP.**
2. Should LSP auditors get read-only MCP tokens in P1 or P2? — pending LSP confirmation.
3. Does the LSP's Drive MCP evaluation (§5) have a candidate server, or is direct Drive API the permanent path? — **UNCONFIRMED.**
4. **v1.2 — DECIDED (D8, Moza 2026-11-17 23:45):** AK.05 is exported as **PDF + DOCX**. Every other generated document is **DOCX only**. Tabular data extracts may additionally be XLSX (data, not documents). No longer UNCONFIRMED.
5. **v1.1:** who may assign triaged work — Ketua Tim only, or any `lsp_admin`? v1.1 allows both roles on T18; the LSP to confirm.
6. **v1.2:** KTP OCR confidence floor — below what confidence does the jury return `needs_human` with no proposed name? **UNCONFIRMED** — config value, to be calibrated on real KTP scans in Phase 2 (QA IDN-09).
7. **v1.2:** name-jury cut — when exactly does a disagreement become `mismatch_resolved` (propose a name) versus `needs_human` (propose nothing)? **UNCONFIRMED** — the rule shape is in doc 15 §2.6 rule 30; the cut itself is config + LSP confirmation.
8. **v1.3 — DECIDED (D6, Moza 2026-11-18 01:06):** certificate-name rule — The KTP (government ID) is the authority: the certificate name is the KTP name, verbatim. Surat tugas, APL.01, and ijazah are compared against the KTP, and any discrepancy resolves to the KTP spelling — surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean". OQ-06 is closed. The verdict still becomes the certificate name only after assessor confirmation or override.
9. **v1.4 — DECIDED (D13–D21, Moza 2026-11-18 01:18 + 01:24 + 01:26):** (a) **Scheme document found (OQ-01 answered):** *Skema Sertifikasi Okupasi Ahli K3 Umum 2021*, LSP HSE Indonesia, created 2022-12-01; Jenis Skema KKNI / Okupasi / Klaster with **no numbered KKNI level**; 13 units; methods observasi / praktik demonstrasi, pertanyaan tertulis, pertanyaan lisan, verifikasi portofolio, wawancara; decision only by the LSP technical team via meeting + Berita Acara + SK LSP; certificate valid 3 years, recertification min 2 months before expiry, surveillance min once a year, appeal max 3 days with the appeal decision max 7 working days (full extraction in `research/skema-ak3u-2021-extracted.md`). (b) **Official 04B form (OQ-02 answered):** 4 Kelompok Pekerjaan, 13 built-in questions (one per unit), Ya/Tidak per KUK, binary recommendation; its evidence is the DIT task + presentation. (c) **No "Kompeten Bersyarat" (OQ-03 closed):** binary K / BK only — the scheme document §9.3.4 has no such outcome. (d) **AI judges the roll-up (OQ-04 answered):** the AI judges VATM sufficiency per unit (scheme §9.3.3–9.3.4 — evidence meeting VATM → "Kompeten", otherwise "Belum Kompeten"), recommends K/BK, and the assessor confirms or overrides; there is NO numeric pass mark. This replaces the v1.3 default (assessor's judgement per KUK) everywhere. (e) **Multi-scheme manifest (D17):** each scheme registers its own file set, question counts, rules reference, prerequisites, and registration requirements — AK3U's values are AK3U's only. (f) **Provider-agnostic BYOK (D18).** (g) **Numeric similarity thresholds + details (D19):** threshold values stay UNCONFIRMED (calibration). (h) **OQ-11 stays open:** the 2021 scheme document vs the 2023 MUK — currency is still one LSP check. (i) **No hardcoded values at all (D21, Moza 2026-11-18 01:26 — top-level canonical rule):** the system is config-based throughout — every value that varies by scheme, org, or deployment comes from config (scheme names and file manifests, question counts, decision/assessment rules, thresholds, prerequisites, requirements, roles, export formats, providers, models, temperatures, UI labels); even a fallback is a config value, never a code constant. No MCP tool assumes an AK3U value.

## 9. Traceability

| PRD requirement (02) | MCP coverage |
|---|---|
| Drive ingest, paginated, resumable | T3, T4, MCP-01, MCP-13 |
| Completeness + identity check | T2, T6, MCP-02 |
| DIT analysis + 13-question bank | T7, T8, MCP-03 |
| 06 grading vs key | T9, T10, MCP-04 |
| Cross-assessee similarity, flag only | T11, MCP-05 |
| AK.05 export (per-assessor, per-batch) | T12, T13, MCP-09, MCP-10 (P1 — see §6 for the reason). **v1.2:** format rule — AK.05 PDF + DOCX only; PDF for any other document → `format_not_allowed` (G12, MCP-21) |
| Combined report (grading + similarity, one Markdown doc) | T14, MCP-17 (P0, v1.1). **v1.2:** Markdown format unchanged — a data report, not a document |
| Prompt registry (read-only) | T15, T16, MCP-11, MCP-19 (P1, v1.1) |
| Multi-assessor triage | T17, T18, MCP-18 (P0, v1.1) |
| Completeness gate on DIT analysis | T7 (`incomplete_inputs`), G8, MCP-03 (P0, v1.1) |
| KTP OCR + name jury (read-only verdict) | T19, T20, G11, MCP-20 (P0, v1.2). Confirm/override stay human-only — no MCP tool |
| Assessor signature | No MCP tool (G13, v1.2) — applied in the web UI at sign-off only |
| RLS / PDP / audit | §4, MCP-06, MCP-12, MCP-15 |
