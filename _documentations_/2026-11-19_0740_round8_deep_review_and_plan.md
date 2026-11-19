# Round 8 Audit Review & Remediation Plan — AsesorKompetensi

- **Timestamp:** `2026-11-19 07:40 WIB`
- **Status:** Deep Review & Architecture Plan (awaiting owner approval before implementation)
- **Target Batch Inspected (Read-Only):** `"Demo Audit R4"` (`f98e5671-fbcb-42cb-a724-9f69d24f780b`), Tenant `LSP-K3-ID2`, Scheme `AK3U` (`cb75c1cc-8019-42fb-bc33-e675516ec4ad`), HEAD `ea2efde`

---

## 1. Forensic Findings & Critical Evaluation per Finding

### Cacat 1 (High) — DIT Completeness Gate Fails to Load `04b` & Multi-File/Multi-Format Deliverables
- **Live Evidence Observed:**
  - Out of 26 assessee rows in `Demo Audit R4`, 19 show `0` files typed `04a`, and several assessees (`Bagas Prakoso`, `Kiki Triyana Dermawan Putra A.Md`, `Muhammad Riyan Syahroni`, `Wiwi Widiawati, S.K.M`, `Ns. Niwan .S`) show `0` `04b` files because their DIT work ended up attached to split/duplicate rows (`BAGAS K3`, `tugas KIKI`, `M. RIYAN SYAHRONI`, `TUGAS DIT WIWI` -> `WIWIK`, or `unmatched`).
  - Furthermore, `src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/page.tsx:48-50` and `src/services/drive-extract.ts:185-187` call `.find((f) => f.docType === ...)` — keeping only **1 single file** per type and discarding all other files when an assessee splits their DIT across Kelompok Pekerjaan (`PEKERJAAN 1..4.pptx`, `Tugas 1..4.pptx`, `FR_IA_04A_Kelompok_1..4.pptx`) or uses `.docx`/`.pdf` deliverables (`Form IBPR`, `Form ERP`, `Form Work Permit`, `Form Inspeksi`, `Form Investigasi`, `Permit_Kerja...docx`).
  - `dit/page.tsx:57` also hard-requires a per-assessee `04a` row instead of falling back to batch-level `04a` files or the AK3U scheme's `kelompokPekerjaan` specification.
- **Proposed Fix:**
  1. Aggregate **all** mapped files (`filter`, concatenated with filenames/headings) for `04a`, `04b`, `dit_form`, and `cv` instead of `.find()`.
  2. Resolve **FR.IA.04A instruction reference** in priority order: assessee `04a` -> batch-level `04a` (if shared across candidates) -> scheme manifest `kelompokPekerjaan` (`resolveSchemeKelompokPekerjaan`).
  3. Treat multi-format `.pptx`/`.ppt`/`.docx`/`.pdf` DIT submissions (whether 1 combined deck/doc, multiple `Kelompok Pekerjaan` files, or a bundle of filled `dit_form` deliverables requested by FR.IA.04A) as valid candidate DIT evidence.
  4. On `dit/page.tsx` and `DitAnalysisTrigger`, show exact actionable diagnostics (e.g., whether a file exists in Triage as `unmatched` for a similar name, or awaits extraction, rather than generic `"Belum tersedia"`).

### Cacat 2 (High) — 80 DIT Supporting Forms Labeled `portofolio` (Position & Better Argument)
- **Live Evidence Observed:** All 80 `portofolio` rows in `Demo Audit R4` are assessee-completed operational K3 forms (`1. Form IBPR-HIRADC`, `2. Form ERP`, `3. Form Work Permit`, `4. Form Inspeksi P3K/APD`, `5. Form Investigasi`, `IBPR_P~1.DOC`) — ~40 under `Pelatihan .../Tugas DIT/...` and ~40 under `Persyaratan/...`.
- **Critique of Binary Choice in Brief (Why Neither `04a` Nor Ambiguous `portofolio` Is Right):**
  - **Rejecting labeling them as `04a`:** In BNSP MUK, `FR.IA.04A` is the *assessor/LSP task prompt sheet* ("Daftar Instruksi Terstruktur"), whereas the 80 `.docx`/`.doc`/`.pdf` files are the **assessee's completed evidence forms** responding to FR.IA.04A's prompts. Labeling candidate answers as `04a` misfeeds the DIT rubric prompt as candidate evidence.
  - **Better Solution — Dedicated `dit_form` Category (`Formulir Tugas DIT`) + Content Verification:** Note that `public.drive_files.doc_type` has **no** restrictive SQL CHECK constraint (`doc_type text not null default 'unknown'`). Introducing `dit_form` separates completed DIT project forms (`Form IBPR/HIRADC`, `ERP`, `Work Permit`, `Inspeksi P3K/APD`, `Investigasi`) cleanly from generic prior-career `portofolio` (`paklaring`, `jobdesc`, prior work reports), lets `FR.AK.02` count them accurately toward `Proyek Kerja`, AND feeds them directly into the assessee's DIT evidence bundle.
- **Honoring "Don't Just Judge by Filename":**
  Add bounded **content-based classification** during Drive ingestion (when file extension is `.docx`/`.pptx`/`.pdf` and either `docType === "unknown"` OR file sits in a DIT/assessee folder with a non-standard/generic filename like `PEKERJAAN 1.pptx`, `Tugas 1.pptx`, `Document.pdf`, `Permit_Kerja...docx`) using `extractTextFromBuffer`, plus an explicit **"Deteksi Isi Berkas (Konten & OCR)"** action in Triage for opaque images/PDFs (`SUKET S2.jpeg`, `IMG-20261107-WA0005.jpg`, `SK Kenaikan Pangkat III.b.pdf`) so `triage_reason` explains *why* each label was assigned (e.g., filename vs document body vs needs human triage).

### Cacat 3 (Medium) — Triage Quality: `unknown`, Folder-Named Assessees, & Unmatched DIT Decks
- **Live Root Causes Found in Code & DB:**
  1. **Unmatched DIT Decks (`DIT_Faradhila...`, `DIT_MEIDA...`, `DIT_NAILA...`):** Line 392 of `src/services/drive.ts` used `/^(?:tugas|dit)\b/i`. Because `_` is a `\w` regex character, `DIT_` has **no word boundary** between `T` and `_`, causing all underscore-prefixed DIT decks to fail extraction! Also normalized name matching didn't tolerate double-letter typos (`Meida Chairunisa` vs `MEIDA CHAIRUNNISA`) or extra middle names (`Faradhila A. Manaf` vs `Faradhila Aushafiana Manaf`) or short suffix tokens (`NAILA` vs `NAILA KHAIRIYAH`).
  2. **4 Fake / Split Assessee Rows (`TUGAS SUANGI`, `tugas KIKI`, `BAGAS K3`, `M. RIYAN SYAHRONI`) & Wrong Substring Hijack:**
     - `cleanCandidateLabel` didn't strip standalone leading `tugas\s+` (`"TUGAS SUANGI"`, `"tugas KIKI"`), AND `Tugas DIT` crawled *before* `Persyaratan`, minting bogus/partial assessee rows first. Worst of all, `findMatchingAssessee` let `"tugas suangi".includes("suangi")` absorb all 7 files from real `"18. Suangi"` into the fake `"TUGAS SUANGI"` row, and `"wiwik...".includes("wiwi")` absorbed `TUGAS DIT WIWI` away from `Wiwi Widiawati`!
  3. **7 `unknown` Files:**
     - `"Naila pass poto.jpeg"` failed `pas_foto` (`p?foto` didn't match `poto` typo without `f`).
     - `"SUKET S2.jpeg"` failed `ijazah` (`sket\s*lulus|\bs\s*1\b` missed `suket` and `s\s*2`).
     - `"SK Kenaikan Pangkat III.b Faradhila.pdf"` failed `surat_tugas` (missed `kenaikan pangkat` / Roman numerals `iii[ab]`).
     - `"IMG-20261107-WA0005.jpg"`, `"WhatsApp Image...jpeg"`, `"Gemini_Generated_Image...jpeg"` (opaque camera/AI filenames) and `"AK3U LSP K3 Nasional.zip"` had no explanation surfaced in `triage_reason` on Triage UI.
- **Proposed Fix:**
  - Two-pass **Roster-First Candidate Resolution** in `handleDriveScanJob`: discover authoritative candidate folders from `Persyaratan/` (plus fallback to verified subfolders excluding structural/generic prefixes like `tugas`, `kelompok`, `pekerjaan`, `k3`), then match DIT files/folders using scored token overlap (preferring exact token match like `Wiwi` -> `Wiwi Widiawati` over prefix `Wiwik`), fuzzy token tolerance (`Chairunnisa` <-> `Chairunisa`, `M.` <-> `Muhammad`, `Suangi` <-> `Suanggi`), and zero-file unconfirmed duplicate pruning during rescan.
  - Populate `triage_reason` during ingest and render `f.triageReason` visibly in `triage/page.tsx`.

### Cacat 4 (Medium, Design Question) — Global vs Per-Tenant/Per-Scheme Similarity Thresholds
- **Honest Design Answer:**
  - The repository's `findConfigWithSource("similarity.flag_thresholds", { lspId, schemeId })` (`src/repositories/config.repository.ts`) **already implements multi-tenant & per-scheme hierarchy**: `scheme -> lsp -> global -> default` (`D17` & `D21`).
  - Live currently displays `"Konfigurasi Global (app_config)"` only because `public.app_config` currently contains only the initial uncalibrated global baseline seed row (`scope='global'`, `0.85/0.65/0.45`, `unconfirmed: true`) and no tenant-specific (`scope='lsp'`) or scheme-specific (`scope='scheme'`) override has been calibrated yet by `LSP-K3-ID2`.
  - **Gap Worth Closing:** Add an Admin-only threshold calibration UI (or document that global acts as baseline fallback until calibrated per tenant/scheme) so `lsp_admin` can save tenant/scheme overrides without manual SQL.

### Cacat 5 (Low) — Does `job.drive_scan.completed` Enter `/settings/audit`?
- **Live Verification Answer:** **Yes — already fixed and verified in DB!**
  - Querying `public.audit_log` showed all 4 rows for Round 8 rescan job `4b3c5099-0a8b-4329-a959-e7e4d12544a9`:
    - `id=38`: `job.drive_scan.created` (`00:15:26.55Z`)
    - `id=39`: `job.drive_scan.rescan` (`00:15:27.22Z`)
    - `id=40`: `job.drive_scan.started` (`00:15:29.15Z`)
    - `id=41`: `job.drive_scan.completed` (`00:15:44.29Z` — 15s later, after `/settings/audit` had already been loaded mid-job).
  - Rescan runtime improved from 92.1s to **15.1s**; we can optionally show the live scan status banner on `/batches/[id]` with an explicit reminder/link when a job just finished or add a manual `"Muat Ulang"` button on `/settings/audit`.
