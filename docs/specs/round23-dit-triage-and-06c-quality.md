# F2 / F5 — Putaran 23 Wave 2: DIT Gate/Charter/Triage (T5–T7) & Kualitas Chunk 06C (T8–T9)

- **Tanggal:** 2026-11-26
- **Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2)
- **Lingkup:** T5 (D1 silent gate DIT), T6 (D2 `muk_portofolio`/Project Charter), T7 (D4 roster pruning & konfirmasi pemetaan massal triase), T8 (N1–N3 kualitas chunk 06C), T9 (N4 progres bertahap 06C).
- **Di luar lingkup:** T10–T11 (ekspor template-fill 04A, checkbox SDT rekomendasi 04B) dan keputusan skema Operator K3.

---

## 1. Trust Boundary & Acceptance Criteria

- **Bulk Assign Triage (`bulkAssignUnmatchedFilesAction`):** hanya dapat dipanggil oleh pengguna terautentikasi dengan peran `lsp_admin`, `tuk_admin`, atau `assessor` pada `batch.lspId`, dengan verifikasi kepemilikan `assessee.batchId === batch.id` (anti-IDOR), penolakan berkas master batch (`materi_pelatihan`, `template_muk`, `surat_tugas`, `06a`, `06b`), serta log audit `triage.file.bulk_assign`.
- **Kriteria Penerimaan:**
  1. `muk_portofolio` (e.g. Project Charter) terbaca sebagai `combinedDitFiles` pada gate DIT dan kolom `04b`/`portofolio` matriks batch.
  2. Tombol **Jalankan Analisis DIT** nonaktif ketika bahan wajib kurang (`missingInputs.length > 0`), menampilkan daftar bahan yang kurang serta tautan ke Triage bila ada berkas `unmatched`, dan tidak pernah menampilkan sukses palsu bila `job_id` kosong.
  3. `pruneOrphanedDuplicateAssessees` tidak menghapus asesi kanonis baru yang terdeteksi dari Surat Tugas/APL.01 pada folder datar (`excludeIds`).
  4. Triage menyediakan form konfirmasi asesor untuk menetapkan seluruh berkas kandidat `unmatched` ke asesi terpilih tanpa inline event handler.
  5. Pipeline koreksi tertulis `runWrittenGradingPipeline` menyaring vonis per rentang chunk (`filterVerdictsToRange`), menjalankan satu pass pemulihan terarah untuk nomor yang hilang, memaksa output 100% Bahasa Indonesia tanpa menilai kode form, dan mengirim progres bertahap (`onProgress`).

---

## 2. Daftar Tiket (F5)

| Tiket | Deskripsi | Status |
|---|---|---|
| **T5 (D1)** | Guard kelengkapan pada `DitAnalysisTrigger`, daftar bahan kurang, & petunjuk `unmatched` | Selesai |
| **T6 (D2)** | Dukung `muk_portofolio` pada `selectDitInputFiles`, matriks batch, & pilihan `DOC_TYPE_OPTIONS` | Selesai |
| **T7 (D4)** | `excludeIds` pada `pruneOrphanedDuplicateAssessees` + `bulkAssignUnmatchedFilesAction` & banner konfirmasi di Triage | Selesai |
| **T8 (N1–N3)** | `filterVerdictsToRange`, recovery pass nomor hilang, prompt Bahasa Indonesia ketat & abaikan kode form | Selesai |
| **T9 (N4)** | Callback progres bertahap `onProgress` di `runWrittenGradingPipeline` & `handleWrittenGradingJob` | Selesai |
