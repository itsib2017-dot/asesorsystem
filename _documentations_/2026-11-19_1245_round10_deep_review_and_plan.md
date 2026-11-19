# Round 10 Audit Deep Review & Remediation Plan

**Timestamp:** 2026-11-19 12:45 WIB  
**Target Commit Audited:** `c67b632` (Live: `https://assessor-zeta.vercel.app`)  
**Audit Batch:** `Demo Audit R4` (`f98e5671-fbcb-42cb-a724-9f69d24f780b`), Tenant `LSP-K3-ID2`, Scheme `AK3U` (`cb75c1cc-8019-42fb-bc33-e675516ec4ad`)  
**Mode:** Read-only forensic review & planning (zero code or DB mutations performed yet)

---

## 1. Forensic Root-Cause Findings (Hard Evidence from Code + Read-Only Remote DB)

### Cacat 1 (Tinggi) — Rescan changed roster `26 → 23` assessees without explanation
- **Verdict:** **Zero real assessees were lost.** The `Persyaratan Pelatihan AK3 umum BNSP/` directory in Demo Audit R4 contains **exact 23 real assessees** (`1.`–`21.` + `NAILA KHAIRIYAH` + `SUCI FITRIANI`).
- **Exact mechanism & records involved:**
  - During the initial scan (`7f09ce96-6383-4f37-be06-d5d76255f5cc`, `2026-11-18 08:55:24–28 UTC`, commit `8c13ec7`), `Tugas DIT/` was processed before `Persyaratan/` using naive substring matching and an older `cleanCandidateLabel` that did not strip bare `TUGAS ` or trailing ` K3`. That created **26 rows (`ASESI-001`..`ASESI-026`)**, including **3 unconfirmed duplicates**:
    1. **`ASESI-003`** (`BAGAS K3`, from `Tugas DIT/TUGAS DIT BAGAS K3.pptx`) → duplicate of canonical **`ASESI-022` `Bagas Prakoso`** (`0615bb87-7703-44c7-8302-81e0fe22c544`).
    2. **`ASESI-013`** (`M. RIYAN SYAHRONI`, from `Tugas DIT/DIT M. RIYAN SYAHRONI/`) → duplicate of canonical **`ASESI-023` `Muhammad Riyan Syahroni`** (`2b376a93-1136-49cc-8bda-8c98633dd917`).
    3. **`ASESI-017`** (`tugas KIKI`, from `Tugas DIT/tugas KIKI/`) → duplicate of canonical **`ASESI-018` `Kiki Triyana Dermawan Putra A.Md`** (`f6c85743-46b2-4a0c-af97-9e882420de40`).
  - During Round 10 rescan (`96c64849-a82d-45a6-8e74-695c4ce68bed`, `2026-11-19 04:58:56–04:59:28 UTC`, commit `c67b632`):
    - Pass 1 (`authoritativeNames` from `Persyaratan/`) identified the 23 canonical assessees (`canonicalIds`).
    - `src/worker/index.ts:431–437` flagged the 3 unconfirmed non-canonical duplicates (`ASESI-003`, `ASESI-013`, `ASESI-017`) in `staleDuplicateIds`.
    - All Drive files from those 3 duplicates were reassigned to `0615bb87...`, `2b376a93...`, and `f6c85743...`.
    - `pruneOrphanedDuplicateAssessees` (`src/repositories/assessees.repository.ts:369`) deleted the 3 now-0-file unconfirmed duplicates.
  - **Why it looked silent in UI/Audit Log:**
    - `audit_log` row `id=49` (`job.drive_scan.completed`) only persisted integer `prunedDuplicateAssessees: 3` — **without** recording which duplicate names/IDs merged into which canonical assessee.
    - `src/app/(app)/settings/audit/page.tsx` (`formatAuditSummary`) did not include `prunedDuplicateAssessees` or roster-merge details in `preferredKeys`.
    - Neither `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx` nor `src/app/(app)/batches/[id]/triage/page.tsx` displayed a roster change/merge trail.

### Bonus Critical Finding (discovered during Cacat 1/3 forensics) — `TUGAS DIT WIWI/` (9 files) misassigned to `WIWIK SRIWAHYUNI BATUBARA`
- **Evidence (live DB):**
  - `30d3d127-0315-47a3-a020-a1a4b72f6b8b` (`WIWIK SRIWAHYUNI BATUBARA`) holds **28 files** (her own 9 Persyaratan + 10 `DIT WIWIK...` + **9 `TUGAS DIT WIWI/` files**).
  - `591699b8-11bd-4e4c-a153-7ecc7cf28b84` (`Wiwi Widiawati, S.K.M`) holds only **7 files** (0 DIT files).
- **Root cause (`src/services/drive.ts:592,657`):**
  - `EXTRA_NON_CANDIDATE_FOLDER_RE` matches `/^(?:...|tugas\s*dit|...)\b/i` against the raw subfolder name `"TUGAS DIT WIWI"` **before** `cleanCandidateLabel` strips `"TUGAS DIT "`.
  - `inferCandidateFromDrivePath` therefore returns `candidateName: null` for all 9 files in `TUGAS DIT WIWI/`, causing `handleDriveScanJob` (`keepManualAssessee`, `src/worker/index.ts:500–505`) to preserve the legacy Nov 18 substring-bug assignment to `WIWIK` instead of reassigning to `Wiwi Widiawati, S.K.M` (where `scoreCandidateNameMatch("WIWI", "Wiwi Widiawati, S.K.M") === 0.90` vs `0` for `WIWIK`).

### Cacat 2 (Menengah) — `F.ERP_Lintang Trenggono.docx` labeled `04b` instead of `dit_form`
- **Evidence (live DB):** `drive_files.id = 5db4a833-24a5-4917-b07a-bccd111a0139`, `doc_type = "04b"`, `triage_reason = "Dokumen penugasan / proyek DIT (.pptx/.pdf/.docx)"`.
- **Root cause (`src/services/drive-doc-types.ts:101–115`):**
  - `detectDitFormKind` replaces `[_-]+` with spaces but leaves `.` intact, turning `"F.ERP_Lintang Trenggono.docx"` into `"f.erp lintang trenggono.docx"`.
  - Line 113 checks `/(?:^|\s)erp(?:$|\s)/` (which fails after `.`), whereas lines 110/119/122/130 use `\b` word boundaries (`\bibpr\b`, `\bp3k\b`, `\bapd\b`).
  - Because `dit_form` missed, the file fell through to `04b_multiformat` (`src/services/drive.ts:232`).
- *(Related observation: `Persyaratan/18. Suangi/Cv. Suangi new.jpg` has the same dot-boundary miss on `(?:^|\s)cv(?:$|\s)` in `UNIFIED_CLASSIFIER_RULES.cv`.)*

### Cacat 3 (Menengah) — Folder/task-named assessee `TUGAS SUANGI` still in roster
- **Evidence (live DB):** `5b80e34c-af0f-4fe5-802f-087ea64ac08a` (`ASESI-010`, `display_name = "TUGAS SUANGI"`, `certificate_name_confirmed = null`) holds **8 files**: all 7 files from `Persyaratan Pelatihan AK3 umum BNSP/18. Suangi/` + `Tugas DIT/TUGAS SUANGI.pptx`.
- **Root cause (2 distinct bugs):**
  1. **Legacy polluted `display_name` never normalized:** On Nov 18, `Tugas DIT/TUGAS SUANGI.pptx` created `ASESI-010` as `"TUGAS SUANGI"`. On subsequent rescans, Pass 1 matched authoritative `"Suangi"` to existing `"TUGAS SUANGI"` (score `0.99` since `"tugas"` is a stop-word) without upgrading the unconfirmed `display_name` from `"TUGAS SUANGI"` → `"Suangi"`.
  2. **Non-authoritative fallback still allowed to create fake assessees:**
     - `src/services/drive.ts:677–683` falls back to any arbitrary `immediateParent` folder as a candidate name.
     - `src/worker/index.ts:439–448` (`trulyNewNonAuth`) still auto-inserts new assessee rows from non-authoritative `Tugas DIT/` or fallback folders even when an authoritative roster (`authoritativeNames.length > 0`) already exists, instead of leaving unmatched files in Triage (`unmatched`).

### Cacat 4 (Rendah) — `.zip` archive (`AK3U LSP K3 Nasional.zip`) failed with `DRIVE_HTML_INTERSTITIAL` & marked `unmatched`
- **Evidence (live DB + HTTP inspection):**
  - `drive_files.id = 4c5543e8-1c22-48a2-ad54-bdeff6cb98af`, `drive_file_id = 1Jl1TfI9IC_FPA5wbl2aGVPjzR1brKg8p`, `triage_status = "unmatched"`.
  - Live HTTP probe to `drive.usercontent.google.com/download?id=...&export=download` returns HTTP 200 `text/html`:
    > `Google Drive - Virus scan warning: AK3U LSP K3 Nasional.zip (9.3M) is encrypted or a multi-volume archive. Would you still like to download this file?`
    with `<form id="download-form" action="https://drive.usercontent.google.com/download" method="get">` (`id`, `export=download`, `confirm=t`, `uuid=...`).
- **Root cause:**
  1. `fetchWithValidatedRedirects` (`src/services/drive-extract.ts:76`) rejects all `text/html` immediately without checking whether it is Google Drive's public `#download-form` (no auth/CAPTCHA gate).
  2. `unpackSafeZipEntries` (`src/services/extract.ts:84`) does not specifically classify password-protected/encrypted ZIP entries (`generalPurposeBitFlag & 0x01`).
  3. `drive_files.triage_status` CHECK constraint (`20261118000005_full_platform_schema.sql:103`) only permits `('unmatched','suggested','assigned','not_needed')`, forcing unextractable archives into `unmatched` so they mix with files awaiting manual mapping.

### Cacat 5 (Rendah) — Batch detail page does not auto-refresh running job status
- **Root cause (`src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`):**
  - Both pages are pure Server Components with zero client polling. When a job is rendered as `pending` or `running (10%)`, nothing queries `GET /api/v1/batches/[id]` or `GET /api/v1/jobs/[jobId]` or triggers `router.refresh()`.

### Note — Line-count discrepancy (`src/` footprint)
- Verified with Node `fs` across all `src/**/*.{ts,tsx}` files (`wc -l` newline count):
  - **All `src/` TS/TSX (`162` files):** `27,535` lines (matches auditor's `27,535` exactly).
  - **Non-test `src/` TS/TSX (`137` files):** `24,031` lines (matches auditor's `24,031` exactly).
- Previous PowerShell `Get-Content` report (`25,281`) undercounted by `2,254` lines because PowerShell `Get-Content` treated Next.js bracketed route segments (`[id]`, `[assesseeId]`, `[jobId]`) as wildcard character classes and skipped those files. Going forward, all reports will state the exact `git ls-files` / Node `\n` (`wc -l`-equivalent) methodology with both non-test and total counts.

---

## 2. Proposed Remediation Plan (Modular, One Scoped Change per Defect)

| # | Defect | Exact Files to Touch | Proposed Change |
|---|---|---|---|
| **1** | **Cacat 1** (Roster merge audit trail) | `src/repositories/assessees.repository.ts`, `src/worker/index.ts`, `src/app/(app)/settings/audit/page.tsx`, `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`, `src/app/(app)/batches/[id]/triage/page.tsx` | Return structured merge pairs (`{ fromId, fromName, toId, toName, reason }[]`) & renamed roster entries from `handleDriveScanJob`; persist `rosterChanges` / `mergedAssessees` in `job.drive_scan.completed` `after_summary` (and emit `batch.roster.merged` audit log when non-empty); render readable merge/rename summaries in `/settings/audit`, `/batches/[id]/ingest/[jobId]`, and a collapsible notice banner on `/batches/[id]/triage`. |
| **2** | **Cacat 2** (`F.ERP_...` → `dit_form`) | `src/services/drive-doc-types.ts`, `src/services/__tests__/drive.test.ts` | Fix `detectDitFormKind` ERP regex from `(?:^|\s)erp(?:$|\s)` to `\berp\b` (matching `\bibpr\b`/`\bhiradc\b`/`\bp3k\b`/`\bapd\b` boundary style; optional matching `\bcv\b` fix in `drive.ts` for `Cv. Suangi new.jpg`). Add unit tests covering `F.ERP_Lintang Trenggono.docx`, `F.IBPR-...`, `F.Work Permit_...`, `F.Inspeksi ...`, `F. Investigasi_...`, and negative case `keperluan_administrasi.docx`. |
| **3** | **Cacat 3 + Bonus (`TUGAS SUANGI` & `TUGAS DIT WIWI`)** | `src/services/drive.ts`, `src/repositories/assessees.repository.ts`, `src/worker/index.ts`, `src/services/__tests__/drive.test.ts`, `src/worker/__tests__/worker.test.ts` | (a) Stop auto-creating fake assessees from non-authoritative folders/filenames when an authoritative roster exists (`trulyNewNonAuth` → leave files `unmatched`), and drop blind `immediateParent` raw-folder fallback when parent is structural/task-like. (b) Fix `inferCandidateFromDrivePath` under `Tugas DIT/` so `cleanCandidateLabel` strips `TUGAS DIT ` before `isNonCandidateFolder` checks the remainder (fixing `TUGAS DIT WIWI` → `WIWI` → `Wiwi Widiawati, S.K.M`, never `WIWIK`). (c) Add safe in-place rename helper `updateAssesseeDisplayName` (never deletes rows, never touches `certificateNameConfirmed`, logged to `audit_log`) to clean polluted unconfirmed folder/task names (`"TUGAS SUANGI"` → `"Suangi"`). |
| **4** | **Cacat 4** (`.zip` download/encryption + `unextractable` status) | `supabase/migrations/20261119000011_add_triage_unextractable.sql`, `src/services/drive-extract.ts`, `src/services/extract.ts`, `src/repositories/batches.repository.ts`, `src/worker/index.ts`, `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/triage/page.tsx`, `src/app/(app)/batches/[id]/triage/actions.ts`, tests | (a) Follow SSRF-validated Google Drive public `#download-form` (`confirm=t`, `uuid`) when `text/html` is Google's virus-scan warning; classify encrypted ZIPs cleanly (`ZIP_ENCRYPTED`) and access-denied HTML (`DRIVE_ACCESS_DENIED`). (b) Add `'unextractable'` to `drive_files.triage_status` CHECK constraint via additive migration, set failed archives to `triageStatus: "unextractable"` with clear reason + manual action guide, and separate `unextractable` count/filter/badge from `unmatched` in Batch Detail & Triage UI. |
| **5** | **Cacat 5** (Auto-refresh job status) | `src/components/batch/job-status-poller.tsx` (new), `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`, `src/components/batch/__tests__/job-status-poller.test.ts` (optional/unit) | Add lightweight `"use client"` `JobStatusPoller` polling `GET /api/v1/batches/[id]` (or `/api/v1/jobs/[jobId]`) every 3s ONLY while job is `pending`/`running`, pausing when tab hidden, aborting on unmount, updating badge live, and invoking `router.refresh()` once upon terminal state (`done`/`failed`) or new job completion. |

---

## 3. Verification & Documentation Plan (Post-Approval)

1. **Automated quality gates:** `npm run typecheck`, `npx eslint . --max-warnings 0`, `npm test`, `npm run build`.
2. **Remote Supabase migration & RLS proof:** Push `20261119000011_add_triage_unextractable.sql` via `npx supabase db push`, confirm `migration list --remote`, and re-run `tests/rls-multi-lsp.test.sql` (`36/36 PASS`).
3. **Live UI/UX verification via `agent-browser`:**
   - Check `/login` & `/register` + authenticated `Demo Audit R4` (with user sign-in if session expired) at desktop `1440x900` AND mobile `390x844`.
   - Click **Pindai Ulang Drive** once, verify auto-refresh transitions `running → done (100%)` without manual reload, verify `23` assessees with `"Suangi"` (zero `"TUGAS SUANGI"`), `TUGAS DIT WIWI` mapped to `Wiwi Widiawati`, `F.ERP_Lintang Trenggono.docx` labeled `dit_form`, `AK3U LSP K3 Nasional.zip` either unpacked or `unextractable` with actionable instructions, and audit/triage roster merge trail visible.
4. **Docs, Graphify, Backup, Commit:** Update `docs/architecture.md`, `docs/testing/feature-test-report.md`, write timestamped Round 10 remediation report in `_documentations_/` with exact `wc -l`-equivalent line count methodology, run `python -m graphify update . --force`, save `_backups_/` checkpoint, and push to `origin/main`.
