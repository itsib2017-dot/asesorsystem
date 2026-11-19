# Round 8 Audit Remediation & Verification Report

- **Timestamp:** 2026-11-19 09:56 WIB
- **Target Project:** AsesorKompetensi (`webapps_asesor`)
- **Database:** Supabase PostgreSQL (`oiplhsmmfuqriaqrxjud`)
- **Pre-Rollout Deep Plan:** [2026-11-19_0740_round8_deep_review_and_plan.md](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/_documentations_/2026-11-19_0740_round8_deep_review_and_plan.md)

---

## 1. Summary of Remediations Implemented

1. **Dedicated `dit_form` Doc Type & Multi-Format / Multi-Part DIT Aggregation (`Cacat 2`)**
   - Separated operational Tugas DIT worksheets (`1..5 Form IBPR / HIRADC / ERP / Work Permit / Inspeksi P3K-APD / Investigasi Kecelakaan`) from prior-career `portofolio` under explicit `docType = "dit_form"` across [drive.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/drive.ts), [triage/page.tsx](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/batches/[id]/triage/page.tsx), [completeness-matrix](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/batches/[id]/page.tsx), and [assessee-forms.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/lib/forms/assessee-forms.ts) (`FR.AK.02` ticks `Proyek Kerja`).
   - Upgraded [drive-extract.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/drive-extract.ts), [dit/page.tsx](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/page.tsx), and [analyse/route.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/api/v1/dit/[assesseeId]/analyse/route.ts) to aggregate all deduplicated `.pptx`/`.pdf`/`.docx` `04b` and `dit_form` parts, with `04a` cascading from assessee files → batch-level `04a` → scheme `kelompokPekerjaan` manifest instructions.

2. **Two-Pass Authoritative Roster Merge, Underscore/Typo Name Matching & Safe Duplicate Pruning (`Cacat 1 & 3`)**
   - Expanded [names.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/lib/names.ts) (`normalisePersonName`, `scoreCandidateNameMatch`, `findBestMatchingCandidate`) to prevent short-token substring hijack (`Wiwi` vs `Wiwik`), resolve `M.` ↔ `Muhammad`, repeated-consonant typos (`Suangi` ↔ `Suanggi`, `Chairunisa` ↔ `Chairunnisa`), and middle-name omissions (`Faradhila A.Manaf` ↔ `Faradhila Aushafiana Manaf`).
   - Fixed JS word-boundary `\b` underscore failures in [drive.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/drive.ts) (`DIT_Faradhila`, `TUGAS SUANGI`, `BAGAS K3`) and tightened `NON_CANDIDATE_FOLDER_RE` prefix boundaries so root/batch container folders (`Pelatihan AK3`, `Kelompok Pekerjaan 1`, etc.) never spawn fake assessees.
   - Implemented two-pass authoritative roster ingestion and safe zero-reference pruning (`pruneOrphanedDuplicateAssessees`) in [worker/index.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/worker/index.ts) and [assessees.repository.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/repositories/assessees.repository.ts), backed by new `assessees_delete` RLS policy in migration [20261119000010_drive_file_metadata.sql](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/supabase/migrations/20261119000010_drive_file_metadata.sql).

3. **Newest Revision Freshness & Safe In-Memory ZIP Archive Unpacking**
   - Added [drive-revisions.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/drive-revisions.ts) sorting by `driveModifiedTime` (Drive API `modifiedTime` / ZIP entry `date`), filename embedded dates (ISO, `DD-MM-YYYY`, `YYYYMMDD`, Indonesian month names), and explicit `Rev`/`vN`/`Final`/`(N)` rank — wired into `handleWrittenGradingJob`, `handleSimilarityRunJob`, DIT input resolution, and `written/page.tsx` + `written/actions.ts`.
   - Added bounded in-memory `.zip` unpacking (`unpackSafeZipEntries`, `repairBrokenZipCrcBuffer`) with path-traversal and zip-bomb caps in [extract.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/extract.ts), supporting on-demand ZIP member extraction (`<parentDriveId>::<entryPath>`) in [drive-extract.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/drive-extract.ts).

4. **Content-Based Classification Beyond Filename + Triage Diagnostics & XML Polish (`Cacat 4 & 5` + `muk_asesor` Selective Ports)**
   - Added `classifyDocumentTextContent` and `extractCandidateNamesFromDocumentText` (`FR.APL.01` / `Surat Tugas`, names-only, zero unredacted NIK/phone) running both during bounded ingest (`MAX_CONTENT_INSPECT_PER_SCAN = 12`) and on-demand in Triage via **"Deteksi Ulang Isi Berkas"** ([triage/actions.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/batches/[id]/triage/actions.ts)).
   - Added `triageReason` & `driveModifiedTime` visibility in Triage rows and a 1-click **"Muat Ulang Log"** refresh button on [settings/audit/page.tsx](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/settings/audit/page.tsx).
   - Ported tenant-neutral XML layout guards from `muk_asesor` (`normalizeBlankoXmlForExport`: header textbox `wrap="none"` and positive `<w:pgMar>` top/bottom bounds) into [export.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/export.ts); documented why hardcoded personal/scheme constants and default-positive verdicts from `muk_asesor` were rejected.

---

## 2. Database Migration & Verification Evidence

- **Applied Migration:** `20261119000010_drive_file_metadata.sql` pushed cleanly to remote `oiplhsmmfuqriaqrxjud`.
- **RLS Multi-LSP Suite (`tests/rls-multi-lsp.test.sql`):** `36/36 PASS` (`RLS-01..RLS-36`, including `RLS-36` blocking cross-LSP `DELETE` on `public.assessees`).
- **Static & Unit Gates:**
  - `npm run typecheck`: `0 errors`
  - `npm run lint`: `0 errors, 0 warnings`
  - `npm test`: `24 passed (24)`, `96 passed (96)`
  - `npm run build`: succeeded cleanly (`36` routes incl. Proxy Middleware)
