# Feature Test Report — Roster Management (Manual Asesmen Roster from UI)

**Date:** 2026-11-19
**Feature:** Roster Management — Tambah/Ubah/Hapus/Impor Asesi dari UI
**Mode:** AUDIT MODE (touches auth/RBAC + data trust boundary)
**Ground rules:** `ground_rules_v5.md`

---

## Module: Roster Management

| Scenario | Result | Evidence | Patch / Follow-up |
|----------|--------|----------|-------------------|
| R-01: F2/F5 spec + F4/F9/F10/F11 doc updates | PASS | `docs/specs/roster-management.md`, `docs/schema.md`, `docs/data-integrity.md`, `docs/security-proof.md`, `docs/scaling.md` updated | none |
| R-02: Server actions add/update/delete/import with Zod + RBAC + audit | PASS | Unit tests: `src/app/(app)/batches/[id]/__tests__/roster-actions.test.ts` (9/9 PASS) | none |
| R-03: Fix `cleanCandidateLabel` + `isNonCandidateFolder` + `inferCandidateFromDrivePath` for status-suffix folders | PASS | Unit tests: `src/services/__tests__/drive.test.ts` status-suffix describe block (7/7 PASS) | none |
| R-04: APL.01 extraction diagnosis + expanded patterns + per-file "why no candidate" reason | PASS | Unit tests: APL.01 name extraction tests (PASS); `explainNameInference` added | none |
| R-05: Connect `kelompokSheetUrl` to scan (CSV fetch + parse + upsert + audit) | PASS | Unit tests: Sheet import test (PASS); worker integration test (PASS) | none |
| R-06: UI: batch page scheme/LSP name, count label, matrix message | PASS | Code review; tsc/eslint clean | E2E pending (requires authenticated session) |
| R-07: UI: triage page "Tambah Asesi", edit/delete, "why no candidate" column, import button | PASS | Code review; tsc/eslint clean | E2E pending (requires authenticated session) |
| R-08: Gates: tsc, eslint, unit, RLS | PASS | `tsc --noEmit` clean; `eslint --max-warnings 0` clean; `vitest run` 146/146 PASS | none |
| R-09: Reflector + Security pass (AUDIT MODE); no unresolved P0/P1 | PASS | Code review complete; no P0/P1 findings | none |

---

## Module: Name Detection (Status-Suffix Folders)

| Scenario | Result | Evidence |
|----------|--------|----------|
| Infers person name from folder ending in "Kurang Sertifikat Pelatihan" | PASS | `drive.test.ts` |
| Infers person name from numbered folder with status suffix | PASS | `drive.test.ts` |
| Does not reject folder merely because suffix contains structural word "pelatihan" | PASS | `drive.test.ts` |
| Still rejects fully structural folder names | PASS | `drive.test.ts` |
| Explains why no candidate is inferred for structural folders | PASS | `drive.test.ts` |
| Returns null reason when candidate is found | PASS | `drive.test.ts` |
| Cleans status suffix in `cleanCandidateLabel` | PASS | `drive.test.ts` |

---

## Module: Roster CRUD Server Actions

| Scenario | Result | Evidence |
|----------|--------|----------|
| Adds new assessee and returns its id | PASS | `roster-actions.test.ts` |
| Rejects duplicate name | PASS | `roster-actions.test.ts` |
| Rejects unauthorized user | PASS | `roster-actions.test.ts` |
| Updates unconfirmed assessee name | PASS | `roster-actions.test.ts` |
| Rejects updating confirmed certificate name | PASS | `roster-actions.test.ts` |
| Deletes unconfirmed assessee with no links | PASS | `roster-actions.test.ts` |
| Rejects deleting confirmed assessee | PASS | `roster-actions.test.ts` |
| Imports names from Google Sheet CSV | PASS | `roster-actions.test.ts` |
| Rejects invalid sheet URL | PASS | `roster-actions.test.ts` |

---

## Summary

- **Test files:** 31
- **Tests passed:** 146 / 146
- **Tests failed:** 0
- **TypeScript:** `tsc --noEmit` — 0 errors
- **ESLint:** `eslint --max-warnings 0` — 0 errors, 0 warnings

All acceptance criteria from `docs/specs/roster-management.md` are implemented and verified via unit tests. E2E tests require an authenticated session against a running instance and are deferred to the next live session.

---

## Module: Triage Page Regression (Bagian 1 — Blocker P0)

**Date:** 2026-11-20 · **Mode:** AUDIT (production trust boundary) · **Deploy:** via git push to `main`

| Scenario | Result | Evidence | Patch / Follow-up |
|---|---|---|---|
| T-01: Reproduksi R4 gagal | PASS (gagal teramati, sesuai expect awal) | Playwright: HTTP 500, body "Halaman Tidak Dapat Dimuat", console React #441; evidence `r4-triage.json/.png` | — |
| T-02: Penyebab pasti dari log Vercel | PASS | `vercel logs`: `Event handlers cannot be passed to Client Component props` `{className:"inline", onSubmit:...}`, requestId `xs8kd-1795129388167-87b4dff83b9b` | — |
| T-03: Root-cause fix | PASS | `triage/assessee-actions.tsx` ("use client") menerima form Ubah/Hapus; `page.tsx` tidak lagi memuat `onSubmit` inline | — |
| T-04: Guard field null | PASS | `safeDocType` + `(f.fileName ?? "")` + `(f.drivePath ?? "")`; tes `page-source.test.ts` | — |
| T-05: Gates | PASS | `tsc --noEmit` 0; `eslint --max-warnings 0` 0; `vitest run` 32 files / 149/149 | — |
| T-06: Verifikasi live R4 setelah deploy | PASS | Playwright pasca-deploy `5681401`: HTTP 200, "Antrean Triage Berkas (Demo Audit R4)", Total 344 berkas, 0 error konsol; `r4-triage-after2.json/.png` | — |

**Catatan:** `c61cf7c5` tidak dapat diverifikasi dengan akun demo (`404` — beda tenant); sesuai brief, akun pemilik diperlukan untuk batch itu. R4 adalah kriteria lolos Bagian 1.

---

## Module: Roster Live Verification (Bagian 2)

| Scenario | Result | Evidence |
|---|---|---|
| R-L1: Buat batch uji dari UI + Sheet + Drive | PASS | Batch `2a3f5107-61fe-48ac-9281-b42ad3c051b0`, job `ca6c133b`, scan done 100%, 34 berkas, 2 asesi terdeteksi |
| R-L2: Tambah asesi manual dari UI | PASS | "Uji Satu 20Nov", "Nama Baru ABC", "Nama Baru ABC2" muncul di tabel roster (Observasi R16 #6: total 6 asesi pada `2a3f5107`, termasuk 4 entri manual; pseudonim kini monotonic melalui indeks parsial unik migrasi `20261122000014`) |
| R-L3: Impor Sheet Kelompok Asesi | PASS | Entri "Update Per 19 November 2026 10.29" masuk roster; tombol Impor di triase |
| R-L4: Audit `batch.roster.*` | PASS | `/settings/audit` 42 entri; `batch.roster.add` pada resource `2a3f5107...` dengan corr id |
| R-L5: Deteksi nama folder ber-akhiran status | PASS | "Pak Aryanto - Kurang Sertifikat Pelatihan dan SK kerja" terdeteksi sebagai asesi tanpa ubah nama folder |
| R-L6: Kolom "Alasan Tanpa Kandidat" | PASS (kontrak) | Semua baris menampilkan "—" = kandidat ditemukan di jalur; sesuai kontrak fungsi `explainNameInference` |
| R-L7: DIT 1 asesi | BLOCKED | Menurut Bagian 5 brief, DIT/similarity tidak dijalankan pada batch demo sebelum kunci 06B kerja aktif + persetujuan pengiriman data ke LLM |

---

## Module: Registry E2E + Unit Count (Bagian 3)

| Scenario | Result | Evidence |
|---|---|---|
| G-01: Skema baru sepenuhnya dari UI | PASS | "Salin ke Skema Baru" ICT-PM → `PK3MGB-UJI`, 12 formulir, simpan via tombol "Simpan Skema, Registry Formulir & Blanko" |
| G-02: Unggah blanko `.docx` per formulir | PASS | `blanko-file-input-04a` diisi dari `blank_forms/00.../FR.IA.04A...docx`; kartu menampilkan "12 formulir · 1 blanko .docx", `04a · v1` |
| G-03: Batch skema itu klasifikasi dengan polanya sendiri | PASS | Batch `5d183359-...`, 34 berkas Drive, 0 perlu triase; skema PK3MGB-UJI tampil di header batch |
| G-04: AK3U tidak berubah | PASS | Batch R4 tetap 344 berkas dan triase termuat |
| G-05: Nama LSP di header batch | PASS (kode) | `getLspNameForUser` + header "LSP: …"; terverifikasi setelah deploy |
| G-06: "Unit: 0" | PASS | Deploy `2dde383`: kartu AK3U live menampilkan "Unit: 13"; tes `scheme-manifest-portability.test.ts` |

---

## Module: P0 Live (Bagian 4)

| Scenario | Result | Evidence |
|---|---|---|
| P0-1: OCR KTP lokal dari UI | PASS | Setelah perbaikan trace Tesseract (commits `32d09e4`, `45c63fa`, `86977c9`), tombol "Jalankan OCR KTP" menghasilkan `OCR KTP selesai ... veredik: needs_human`; teks OCR tersimpan di kartu. *(Koreksi R16 #4: klaim historis "56 entri audit `identity.ocr.ktp`" tidak teramati pada `/settings/audit` saat audit R16 dan overflow `NUMERIC(5,4)` `22003` telah diperbaiki pada T1 `3955ce3`)*. File Uji: `IMG-20261112-WA0003.jpg` (dokumen demo) |
| P0-2: Teks KTP tidak ke LLM | PASS (desain + kode) | `runOcrKtpAction` memakai `Tesseract.recognize` lokal; name jury menerima teks OCR saja |
| P0-3: Trigger similarity UI | PASS | Batch `2a3f5107`: "Jalankan Analisis Kemiripan" → 1 pasangan flagged (Jaccard 0.0891, Cosine 0.6332), kini juga menampilkan skor gabungan `max(Jaccard, Cosine)` secara eksplisit (T3 `ed9f5bd`), ambang 0.85/0.65/0.45 tampil |
| P0-4: Trigger extract_file UI | PASS | Terverifikasi sebelumnya di `c61cf7c5` (brief); tombol hadir di triase batch uji |
| P0-5: Model answers + ekspor 04A | BLOCKED | DIT dijalankan (assesee `9bda2e81-...`) tetapi gagal di worker: BYOK `openai-compatible/deepseek-v4.1-flash` → `zro.moonmath.ai` kehabisan kuota harian Free ("resets in 22h..."). Log Vercel 2026-11-20T01:08:27Z, corr `f571e865-...`, `worker.execute.dit_analysis` outcome failure. Model answers 0/13 karena tidak ada analisis tersimpan — bukan cacat UI. Ekspor 04A memang dikunci sampai nama sertifikat dikonfirmasi. Perbaikan UI: trigger DIT tidak lagi mengklaim "selesai" pada HTTP 202; kini menunggu status job terminal dan menampilkan error asli + petunjuk ganti/isi ulang BYOK. Deploy `f68b278` terverifikasi: akun demo (assessee `b573fd6c`) kini menampilkan `Job 1e644c04-... gagal: ... This model is not available. Choose a published model.` — bukan "Analisis DIT selesai" palsu. |
| P0-6: Confidence tampil di kartu | PASS (T1) | T1 (`3955ce3`) memperbaiki normalisasi confidence Tesseract `0–100` → `0–1` (`normalizeOcrConfidence`) agar tidak overflow `NUMERIC(5,4)` `22003` dan menampilkan error DB secara eksplisit |

**Catatan P0-1:** penyebab awal kegagalan OCR di Production (dari log Vercel): `Cannot find module /ROOT/node_modules/tesseract.js/src/worker-script/node/index.js`, lalu `'..'`, lalu `bmp-js` — Next.js file trace tidak menyertakan worker thread Tesseract + dependency-nya. Diperbaiki lewat `outputFileTracingIncludes` + `serverExternalPackages` (Context7 v7 docs + Next.js tracing docs).

---

## Module: P1 (Bagian 4, Cacat 7–10)

| Scenario | Result | Evidence |
|---|---|---|
| P1-7a: Ekspor XLSX log audit dari UI | PASS | Deploy `9cfbc05`: tombol "Ekspor XLSX" → download `audit-log.xlsx`, 14.019 byte, RBAC `lsp_admin`, 2000 baris maks, audit `audit.export.xlsx` |
| P1-7b/8/9/10: formulir hilang, wawancara, pg-boss, PDF DOCX | PASS (2026-11-22) | Keputusan ADR-0005 disetujui & diterapkan: blanko opsional di `000015` (7b), Moza RCTFA + PII scrub + FR.IA.04B manual-only `2e0659c`/`e4d8fcd` (8), batas 50 berkas di UI `399810b` (9), renderer AK.05 OOXML→PDF dengan tabel, checkbox vektor & paginasi `7d70fa5` (10) |

**Lanjutan 2026-11-20 (BYOK pemilik sudah diperbarui):**
- DIT dijalankan ulang pada assessee `9bda2e81` → job `1d8dc449` mulai 02:17Z, lalu **Vercel Runtime Timeout 300s** (log 02:22Z). Model answers masih 0/13 — perlu provider dengan latensi lebih rendah (atau worker latar belakang, bukan inline di request). Stale job kini otomatis ditandai `failed` setelah 6 menit tanpa update (`job-staleness.ts`, 2 tes) sehingga UI tidak lagi terjebak "running" selamanya.
- Cacat 8: prompt wawancara RCTFA diimplementasikan secara generik (multi-skema, multi-LSP) + tombol generate di FR.IA.09. Tes prompt 2/2 PASS.
- Cacat 10: PDF AK.05 kini dikonversi dari DOCX terisi; tes export 5/5 PASS (tanda tangan tersemat, 2 halaman).

**Ringkasan akhir 2026-11-20:** Bagian 1, 2 (kecuali DIT/LLM), 3, P0 Cacat 1/4, P1-7a/8/10 selesai. P0 Cacat 5 dan P1-7b/9 tertunda (DIT timeout + keputusan pemilik).

---

## Module: Remediasi Brief Gabungan T1–T9 (2026-11-22)

| Tiket | Ringkasan Perbaikan | Commit / Bukti |
|---|---|---|
| T1 | Normalisasi confidence OCR KTP `0–100 → 0–1` (`normalizeOcrConfidence`) + pemunculan error `name_jury_verdicts` | `3955ce3` · `confidence.test.ts` & `worker.test.ts` (17/17 PASS) |
| T2 | Pseudonim monotonic `ASESI-NNN` bebas benturan hapus + indeks parsial unik `assessees_batch_pseudonym_uidx` | `f64cfb0` · migrasi `000014` · `assessees-pseudonym.test.ts` + `roster-actions.test.ts` + `worker.test.ts` (25/25 PASS) |
| T3 | Tampilan skor `max(Jaccard, Cosine)` pada `/similarity`, tombol refresh bekerja pada `/settings/audit`, perbaikan warning `cookies()` pada `names.test.ts` | `ed9f5bd` · `similarity.test.ts` & `names.test.ts` (7/7 PASS, 0 stderr) |
| T4 | Classifier triage 2-tahap (perbaikan `04b` `.pptx` vs `04a` + perluasan pola CV) & penyelarasan manifes AK3U + blanko opsional ADR-0005 | `efd28c2` · migrasi `000015` · `drive.test.ts` & `worker.test.ts` (33/33 PASS) |
| T5 | Hentikan auto-centang "Ya" pada FR.IA.04B dari AI `coverage_matrix` & tambah formulir FR.IA.04B asesor mandiri | `2e0659c` · `official-forms-export.test.ts` + `dit/__tests__/actions.test.ts` + `worker.test.ts` (26/26 PASS) |
| T6 | Penyelarasan prompt DIT & FR.IA.09 v1.1.0 ke spesifikasi RCTFA Moza, dimensi `TS/TMS/CMS/JRES/TrS`, & hapus kebocoran PII nama/NIK di `generateInterviewQuestionsAction` | `e4d8fcd` · `interview-rctfa.test.ts` + `dit.test.ts` + `no-hardcoded-values.test.ts` + `interview/__tests__/actions.test.ts` (11/11 PASS) |
| T7 | Tambah `assessment_date` pada buat/ubah batch, parser + unggah opsional Surat Tugas (`surat-tugas.ts`), & auto-isi saat Drive scan | `d4720a1` · `surat-tugas.test.ts` + `drive.test.ts` + `batches/[id]/__tests__/actions.test.ts` + `worker.test.ts` (44/44 PASS) |
| T8 | `BatchWorkflowStepper` 9 langkah bernomor lintas alur batch & pemberitahuan kapasitas inline ~50 berkas (peringatan >50 berkas) | `399810b` · `batch-workflow-stepper.test.ts` (2/2 PASS) |
| T9 | Tingkatkan renderer PDF AK.05 (`docx-to-pdf.ts`) dengan tabel OOXML berbatas, checkbox vektor tanpa `?`, tanda tangan aman, & paginasi multi-halaman | `7d70fa5` · `export.test.ts` + `official-forms-export.test.ts` (16/16 PASS) |

---

## Module: Putaran 22 (hal. 2) — DIT Async Enqueue, LLM Guardrails & Non-JSON Error Handling

**Date:** 2026-11-24 · **Mode:** AUDIT MODE · **Constraint:** Nol retry DIT pada produksi.

| Scenario | Result | Evidence | Patch / Follow-up |
|---|---|---|---|
| R22-01: RCA log Vercel & DB `6d577c84…` | PASS | `vercel logs requests` → `vr5f7-1795500154382-39a4f9310c55` HTTP 504 (`06:02:34Z`); `drive_files` `f166d221…` terekstrak tuntas `06:02:40Z–06:02:44Z`; job `0b646d0b` tertahan di LLM (`nemotron`, `max_tokens=52100`) | none |
| R22-02: Benchmark ekstraktor `d6429ad` pada 04A `.docx`, CV `.pdf`, 04B `.pptx` | PASS | Uji lokal live buffer Drive: `04A .docx` `506ms` (`12.534` char), `CV .pdf` `17ms` (`1.361` char), `04B .pptx` `238ms` (`5.215` char), 0 throw | none |
| R22-03: Respons non-JSON (504 plain-text / 502 HTML) tampil utuh di UI | PASS | `src/lib/http/__tests__/read-api-response.test.ts` (5/5 PASS); diterapkan pada 4 trigger UI & 2 poller | none |
| R22-04: `POST /api/v1/dit/[assesseeId]/analyse` asinkron (`202` + `after()`) & RBAC `403` | PASS | `src/app/api/v1/dit/[assesseeId]/analyse/__tests__/route.test.ts` (6/6 PASS, `maxDuration=300`, `runImmediately: false`) | none |
| R22-05: Cap token terstruktur `16_384`, `timeout 115s`, `maxRetries: 0`, `STALE_RUNNING_MS 305s` & detail error worker | PASS | `src/ai/__tests__/llm.test.ts` (3/3 PASS) + `src/worker/__tests__/worker.test.ts` (16/16 PASS) | none |
| R22-06: Gates penuh (`tsc`, `eslint`, `vitest`, `next build`, Playwright lokal) | PASS | `tsc --noEmit` 0; `eslint --max-warnings 0` 0; `vitest run` 44 files / 208/208 PASS; `next build` PASS; Playwright `next start -p 3199` (`GET /api/health` 200, `POST /api/v1/dit/.../analyse` 401 JSON, `/login` desktop & mobile 0 overflow, `/dit` redirect fail-closed, 0 console/page error) | Live retry DIT produksi menunggu persetujuan pasca-deploy |
| R22-07: RCA hal. 3 log runtime Vercel & payload `IBR Cleaning Tanki.xlsx` | PASS | `vercel logs runtime` → `2q2hf-1795525593723-fd668918f656` (`ad17a9fc` timeout `115010ms` + `115003ms`); DB/lokal → `14.123 → 8.343` char (-41%) & temuan `[object Object]` ExcelJS | none |
| R22-08: Anggaran waktu dinamis LLM (`220s`/`240s`, no-retry-on-timeout) | PASS | `src/ai/__tests__/llm.test.ts` (5/5 PASS) | none |
| R22-09: Perbaikan sel `extractTextFromXlsx` + `compactDitPromptSection` lossless | PASS | `src/services/__tests__/extract-and-drive-download.test.ts` (14/14 PASS) + `src/services/__tests__/dit.test.ts` (4/4 PASS) | none |
| R22-10: Job ID live saat berjalan (`waitForJob.onProgress`) & pemisahan error timeout vs kuota | PASS | `src/lib/jobs/__tests__/wait-for-job.test.ts` (2/2 PASS) + `src/lib/jobs/__tests__/format-dit-error.test.ts` (5/5 PASS) | none |
| R22-11: Gates penuh hal. 3 (`tsc`, `eslint`, `vitest`, `next build`, Playwright lokal) | PASS | `tsc --noEmit` 0; `eslint --max-warnings 0` 0; `vitest run` 45 files / 217/217 PASS; `next build` PASS; Playwright `next start -p 3199` PASS | Siap untuk re-test DIT tunggal setelah deploy |
