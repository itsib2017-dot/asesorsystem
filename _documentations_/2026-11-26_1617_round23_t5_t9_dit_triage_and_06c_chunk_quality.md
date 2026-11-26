# Putaran 23 Wave 2 (T5–T9) — DIT Gate/Charter/Triage & Kualitas Chunk 06C

- **Tanggal:** 2026-11-26 16:17 WIB
- **Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2)
- **Cakupan:** T5 (D1 silent gate DIT), T6 (D2 `muk_portofolio`/Project Charter), T7 (D4 pruning roster & pemetaan massal triase dengan konfirmasi asesor), T8 (N1–N3 kualitas chunk 06C), T9 (N4 progres bertahap 06C).
- **Di luar cakupan:** T10–T11 (ekspor template-fill 04A, checkbox SDT rekomendasi 04B) dan keputusan skema Operator K3.

---

## 1. Perubahan & Penyebab

| Tiket | Root Cause | Perbaikan |
|---|---|---|
| **T5 (D1)** | Tombol **Jalankan Analisis DIT** tetap aktif saat bahan kurang dan `DitAnalysisTrigger` tidak menolak respons sukses tanpa `job_id`. | `DitAnalysisTrigger` kini mengecek kelengkapan 3 input (berkas Drive atau tempel manual `>= 10` karakter), menonaktifkan tombol saat bahan kurang, menampilkan daftar input yang kurang + tautan ke Triage (`unmatchedBatchFileCount`), dan melempar pesan error bila `job_id` tidak dikembalikan. |
| **T6 (D2)** | Classifier mengklasifikasikan Project Charter sebagai `muk_portofolio`, tetapi `selectDitInputFiles`, matriks batch, dan dropdown Triage mengabaikan `muk_portofolio`. | Menambah `usedMukPortofolioFiles` ke `combinedDitFiles` di `dit-inputs.ts`, memasukkan `muk_portofolio` pada kolom `04b`/`portofolio` di `batches/[id]/page.tsx`, serta menambah opsi `muk_portofolio` di `DOC_TYPE_OPTIONS` Triage. |
| **T7 (D4)** | `pruneOrphanedDuplicateAssessees` menghapus asesi kanonis baru dari Surat Tugas pada folder datar karena belum memiliki berkas tertaut; belum ada aksi pemetaan massal `unmatched`. | Menambah `excludeIds` pada `pruneOrphanedDuplicateAssessees` (`assessees.repository.ts`) dan mengisi `protectedCanonicalIds` di `handleDriveScanJob` (`worker/index.ts`); menambah `bulkAssignUnmatchedFilesAction` (RBAC + anti-IDOR + skip berkas master + audit `triage.file.bulk_assign`) dan banner konfirmasi asesor di `triage/page.tsx`. |
| **T8 (N1–N3)** | `mergeItemVerdicts` mengizinkan vonis nyasar lintas batas chunk, nomor hilang tidak diulang, dan prompt tidak memaksa Bahasa Indonesia / mengabaikan kode form (`FR.IA.06B`/`FR.IA.06C`). | Menambah `filterVerdictsToRange`, menyaring setiap chunk terhadap rentangnya sebelum merge, menjalankan satu recovery pass terarah untuk nomor yang hilang, menambah `[FOKUS KUNCI NOMOR TARGET]` + aturan Bahasa Indonesia ketat & abaikan kode form di `written-test-grading.v2.ts`. |
| **T9 (N4)** | `written_grading` diam di 10% sampai selesai tanpa progres per chunk/rollup. | Menambah callback `onProgress` (`15` → progres per chunk → `75/80` recovery → `85` → `95`) pada `runWrittenGradingPipeline` dan menyalurkannya dari `handleWrittenGradingJob`. |

---

## 2. Verifikasi & Bukti Keamanan (F10)

- **Static & Test Gates (setelah edit terakhir):**
  - `npm run typecheck` (`tsc --noEmit`): **0 error**.
  - `npx eslint . --max-warnings 0`: **0 error, 0 warning**.
  - `npm run test` (`vitest run`): **61/61 test file lulus, 313/313 tes lulus**.
  - Termasuk tes baru/diperbarui:
    - `src/lib/forms/__tests__/dit-inputs.test.ts` (2/2 PASS)
    - `src/services/__tests__/grading-chunked.test.ts` (10/10 PASS — range bleed N2, recovery pass N1/N3, `onProgress` N4, aturan Bahasa Indonesia & kode form)
    - `src/worker/__tests__/worker.test.ts` (22/22 PASS — regresi D4 folder datar 1 asesi Surat Tugas)
    - `src/app/(app)/batches/[id]/triage/__tests__/actions.test.ts` (4/4 PASS — auth/RBAC/anti-IDOR/bulk assign + audit)
    - `src/app/(app)/batches/[id]/triage/__tests__/page-source.test.ts` (3/3 PASS — nol inline event handler / unsafe `.toLowerCase()`)
- **Catatan Browser:** Paket `playwright` belum ada di `package.json`; alur UI live (batch `c796c832` untuk D1/D2/D4/T7 dan batch `6d577c84` ASESI-001 untuk 06C N1–N4) siap diverifikasi pasca-deploy otomatis Vercel.

---

## 3. Rollback & Checkpoint

- **Rollback:** `git revert <commit-hash>` lalu push ke `main`.
- **Checkpoint:** Disarankan membuat salinan di `_backups_` setelah verifikasi live T5–T9 selesai.
