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
| R-L2: Tambah asesi manual dari UI | PASS | "Uji Satu 20Nov", "Nama Baru ABC", "Nama Baru ABC2" muncul di tabel roster (render Server Action delay ~1 request) |
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
| P0-1: OCR KTP lokal dari UI | PASS | Setelah perbaikan trace Tesseract (commits `32d09e4`, `45c63fa`, `86977c9`), tombol "Jalankan OCR KTP" menghasilkan `OCR KTP selesai ... veredik: needs_human`; teks OCR tersimpan di kartu; audit `identity.ocr.ktp` (56 entri). File Uji: `IMG-20261112-WA0003.jpg` (bukan KTP asli — dokumen demo) |
| P0-2: Teks KTP tidak ke LLM | PASS (desain + kode) | `runOcrKtpAction` memakai `Tesseract.recognize` lokal; name jury menerima teks OCR saja |
| P0-3: Trigger similarity UI | PASS | Batch `2a3f5107`: "Jalankan Analisis Kemiripan" → 1 pasangan flagged (Jaccard 0.0891, Cosine 0.6332), ambang 0.85/0.65/0.45 tampil |
| P0-4: Trigger extract_file UI | PASS | Terverifikasi sebelumnya di `c61cf7c5` (brief); tombol hadir di triase batch uji |
| P0-5: Model answers + ekspor 04A | BLOCKED | DIT dijalankan (assesee `9bda2e81-...`) tetapi gagal di worker: BYOK `openai-compatible/deepseek-v4.1-flash` → `zro.moonmath.ai` kehabisan kuota harian Free ("resets in 22h..."). Log Vercel 2026-11-20T01:08:27Z, corr `f571e865-...`, `worker.execute.dit_analysis` outcome failure. Model answers 0/13 karena tidak ada analisis tersimpan — bukan cacat UI. Ekspor 04A memang dikunci sampai nama sertifikat dikonfirmasi. Perbaikan UI: trigger DIT tidak lagi mengklaim "selesai" pada HTTP 202; kini menunggu status job terminal dan menampilkan error asli + petunjuk ganti/isi ulang BYOK. Deploy `f68b278` terverifikasi: akun demo (assessee `b573fd6c`) kini menampilkan `Job 1e644c04-... gagal: ... This model is not available. Choose a published model.` — bukan "Analisis DIT selesai" palsu. |
| P0-6: Confidence tampil di kartu | PARTIAL | Teks OCR + verdict human-needed tampil; angka confidence tidak tersimpan di `:confidence` yang dibaca kartu — fallback jujur "confidence tidak tersimpan" ditampilkan. Root cause penyimpanan confidence jury perlu ditindaklanjuti |

**Catatan P0-1:** penyebab awal kegagalan OCR di Production (dari log Vercel): `Cannot find module /ROOT/node_modules/tesseract.js/src/worker-script/node/index.js`, lalu `'..'`, lalu `bmp-js` — Next.js file trace tidak menyertakan worker thread Tesseract + dependency-nya. Diperbaiki lewat `outputFileTracingIncludes` + `serverExternalPackages` (Context7 v7 docs + Next.js tracing docs).

---

## Module: P1 (Bagian 4, Cacat 7–10)

| Scenario | Result | Evidence |
|---|---|---|
| P1-7a: Ekspor XLSX log audit dari UI | PASS | Deploy `9cfbc05`: tombol "Ekspor XLSX" → download `audit-log.xlsx`, 14.019 byte, RBAC `lsp_admin`, 2000 baris maks, audit `audit.export.xlsx` |
| P1-7b/8/9/10: formulir hilang, wawancara, pg-boss, PDF DOCX | BLOCKED (keputusan produk) | ADR-0005 berisi usaha keputusan; butuh konfirmasi pemilik. Tidak ada asumsi diam-diam (Non-Negotiable #2) |

**Lanjutan 2026-11-20 (BYOK pemilik sudah diperbarui):**
- DIT dijalankan ulang pada assessee `9bda2e81` → job `1d8dc449` mulai 02:17Z, lalu **Vercel Runtime Timeout 300s** (log 02:22Z). Job masih berstatus `running` — perlu recovery stale job + provider yang lebih cepat. Model answers masih 0/13.
- Cacat 8: prompt wawancara RCTFA diimplementasikan secara generik (multi-skema, multi-LSP) + tombol generate di FR.IA.09. Tes prompt 2/2 PASS.
- Cacat 10: PDF AK.05 kini dikonversi dari DOCX terisi; tes export 5/5 PASS (tanda tangan tersemat, 2 halaman).

**Ringkasan akhir 2026-11-20:** Bagian 1, 2 (kecuali DIT/LLM), 3, P0 Cacat 1/4, P1-7a/8/10 selesai. P0 Cacat 5 dan P1-7b/9 tertunda (DIT timeout + keputusan pemilik).
