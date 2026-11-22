# Laporan Remediasi & Pengembangan Brief Gabungan (T1–T10)

- **Tanggal:** 2026-11-22 15:10 +07:00
- **Basis Brief:** `brief-developer-gabungan-2026-11-19.md` (disetujui 2026-11-22)
- **Target Supabase:** `oiplhsmmfuqriaqrxjud` (migrasi `20261122000014` & `20261122000015` diterapkan)
- **Batasan Keamanan:** Zero sentuhan/mutasi pada batch pemilik `c61cf7c5-dd98-418b-85b7-9690caf1bdb2`, nol perubahan ambang kemiripan `0.85/0.65/0.45`, nol konfirmasi nama asesi nyata, nol pengiriman PII KTP/nama asli ke LLM.

---

## Ringkasan Tugas (T1–T9)

1. **T1 — Normalisasi Confidence OCR KTP & Pemunculan Error (`3955ce3`):**
   - Root cause: `tesseract.js` mengembalikan skala `0–100`, menyebabkan nilai seperti `33` melewati floor `0.75` lalu memicu overflow PostgreSQL `22003` pada kolom `name_jury_verdicts.ocr_confidence NUMERIC(5,4)` dan error tertelan diam-diam.
   - Solusi: fungsi tunggal `normalizeOcrConfidence` (`src/lib/ocr/confidence.ts`) + validasi error eksplisit pada `assessees.repository.ts`, `batches.repository.ts`, action/UI KTP, dan `worker/index.ts`.

2. **T2 — Pseudonim Monotonik & Indeks Unik (`f64cfb0`):**
   - Root cause: penomoran `ASESI-NNN` memakai `pool.length + 1`, mendaur ulang nomor asesi yang dihapus.
   - Solusi: `computeNextPseudonymSeq` di `src/repositories/assessees.repository.ts` + migrasi forward-only `20261122000014_unique_assessee_pseudonym.sql` yang menomori ulang duplikat historis per batch secara aman dan memasang unique partial index `assessees_batch_pseudonym_uidx`.

3. **T3 — UI Skor Kemiripan `max`, Refresh Audit & Warning Cookie (`ed9f5bd`):**
   - Root cause: UI kemiripan hanya menampilkan Jaccard & Cosine terpisah tanpa menyorot nilai gabungan `max(Jaccard, Cosine)`; tombol muat ulang audit memakai `<Link>` statis; `names.test.ts` memicu `getConfig()` `cookies()` di luar Next request.
   - Solusi: tampilan aturan `max(Jaccard, Cosine)` & skor gabungan di `similarity/page.tsx`, client `RefreshAuditButton` di `/settings/audit`, serta injeksi thresholds eksplisit pada `names.test.ts`.

4. **T4 — Klasifikasi Triage 2-Tahap (`04b` & `cv`) + Registry ADR-0005 (`efd28c2`):**
   - Root cause: pola `'dit'` pada `04a` (`sort_order=6`) menyambar `.pptx` sebelum aturan `04b` (`sort_order=7`); aturan CV belum mencakup `DRH`, `Riwayat Hidup`, `Resume`, `Biodata`, serta nama menempel `CVBudiSantoso`.
   - Solusi: `matchSchemeFormsByName` 2-pass + proteksi `.ppt/.pptx` & token `presentasi|paparan` di `src/services/drive.ts`, migrasi `20261122000015_refine_ak3u_manifest_and_adr0005_forms.sql` yang memperketat `04a`, melengkapi pola `04b`, dan mendaftarkan 11 blanko opsional ADR-0005 (`mapa01`, `mapa02`, `fr_va`, `ia07`, `ia08`, `ia10`, `ak03`, `ak04`, `ak06`, `ak07`, `berita_acara`).

5. **T5 — Hentikan Centang "Ya" Otomatis 04B & Tambah Formulir FR.IA.04B Asesor (`2e0659c`):**
   - Root cause: `buildIa04bPayload` membaca AI `coverageMatrix` dan memicu centang otomatis `Ya`.
   - Solusi: `buildIa04bPayload` kini hanya membaca `official_04b` (atau keputusan unit eksplisit asesor), tidak pernah dari AI `coverageMatrix` / `readiness`; ditambahkan formulir interaktif `Ia04bAssessmentForm` (`#form-04b`), Server Action `saveIa04bAssessmentAction` (Auth/Zod/RBAC/rate-limit/audit `dit.ia04b.save`), repositori dual-path `saveOfficial04bAssessment`, dan proteksi agar pemrosesan ulang AI DIT tidak menimpa nilai resmi asesor.

6. **T6 — Penyelarasan Prompt RCTFA Moza & Scrub PII Wawancara (`e4d8fcd`):**
   - Root cause: `generateInterviewQuestionsAction` mengirimkan `apl01Name`, `suratTugasName`, dan `ijazahName` langsung ke LLM; prompt belum memuat penuh kalibrasi peran/wilayah & 5 dimensi di skema output `FR.IA.09`.
   - Solusi: pembaruan `dit-gap-analysis.v1.ts` & `interview-rctfa.v1.ts` (`v1.1.0`) sesuai RCTFA Moza (adaptasi peran Manajerial/Lulusan Baru/Transisi/Operator, adaptasi wilayah non-metro vs metro, STAR berakar materi nyata kandidat, 5 dimensi `TS/TMS/CMS/JRES/TrS`, aturan tunda, biner `K/BK`), skema Zod + dropdown dimensi di UI wawancara, rate-limiting `interview:generate`, serta `scrubCandidateIdentityText` yang membersihkan nama asli & NIK dari payload LLM.

7. **T7 — Edit Metadata Batch, `assessment_date`, & Parser Surat Tugas Opsional (`d4720a1`):**
   - Solusi: `src/services/surat-tugas.ts` (`parseSuratTugasText` untuk tanggal Indonesia `DD Bulan YYYY`/`DD/MM/YYYY`/`YYYY-MM-DD`, TUK, nomor surat, asesor, dan daftar peserta + perbaikan regex multi-baris di `drive.ts`), dukungan `assessmentDate` di buat/ubah batch (`batches.repository.ts`, `/api/v1/batches`, `create-batch-panel.tsx`), aksi `updateBatchMetadataAction`, `parseSuratTugasPreviewAction`, `uploadBatchSuratTugasAction` (`#surat-tugas`), dan auto-fill metadata kosong pada `handleDriveScanJob`.

8. **T8 — Stepper Alur Kerja 9 Langkah & Pemberitahuan Kapasitas 50 Berkas (`399810b`):**
   - Solusi: komponen `BatchWorkflowStepper` (`1. Buat Batch` s.d. `9. Ekspor`) terpasang di detail batch, triage (`#roster`), detail asesi, DIT (`#form-04b`), wawancara, dan AK.05 (`#ekspor`); pemberitahuan batas optimal ~50 berkas inline + lencana peringatan saat `> 50` berkas pada panel buat batch dan status ingest.

9. **T9 — Peningkatan Renderer AK.05 DOCX→PDF (`7d70fa5`):**
   - Solusi: `renderAk05DocxToPdf` di `src/lib/ak05/docx-to-pdf.ts` kini mem-parsing struktur tabel OOXML (`<w:tbl>`, `<w:tr>`, `<w:tc>`, `gridSpan`, shading header), merender checkbox vektor (`☑`/`☐`) bebas karakter `?`, menyematkan tanda tangan tanpa bertumpuk dengan teks, mendukung templat kustom, serta menomori dan memaginasi halaman A4 secara konsisten.

---

## Celah Dokumentasi (Ground Rules §A.1)

- `Audit Menyeluruh v2` (`A1–A11, B2–B8, C1–C5`) yang dirujuk oleh brief tidak ditemukan pada repositori dan telah dicatat pada `docs/00-skill-gap-log.md`.

## Catatan Risiko & Rollback

- Perubahan kode tersebar per tiket terisolasi (`3955ce3`..`7d70fa5`), sehingga rollback per modul dapat dilakukan lewat `git revert <commit>`.
- Migrasi `20261122000014` dan `20261122000015` bersifat forward-only & non-destruktif (entri `000015` berupa pembaruan pola aturan AK3U dan penambahan blanko opsional `required: false`).
