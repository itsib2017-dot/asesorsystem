# F2 / F5 — Putaran 23: Reliabilitas Pemindaian Drive & Pemulihan Job Macet (T1–T4)

- **Tanggal:** 2026-11-26
- **Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2)
- **Lingkup:** P23-1 (pemindaian Drive macet di `running (10%)` pada `after()`, serta timeout listing Drive 12–15 dtk tanpa retry) & P23-2 (halaman batch tidak merekonsiliasi job stale dan tidak menyediakan tombol pulih langsung).
- **Di luar lingkup:** T5–T11 (D1/D2/triage-to-assessee, kualitas chunk 06C N1–N4, ekspor template 04A) dan keputusan skema Operator K3.

---

## 1. Masalah & Root Cause (T1)

1. **Lingkungan Vercel Hobby (`npx vercel env ls`):**
   - `ENABLE_DIRECT_DB` tidak aktif di Production, sehingga seluruh pemanggilan repository menggunakan `getSupabaseServerClient()` (`cookies()`) dengan fallback service-role terlingkup `created_by = userId`.
   - Runtime log retention pada Vercel Hobby hanya 1 jam.
2. **P23-1a — Job macet di `running (10%)` tanpa pesan gagal:**
   - `handleDriveScanJob` tidak memiliki batas waktu eksekusi total maupun pembaruan progres bertahap antara 10% dan 100%, serta `enrichFilesByContent` (cabang `persistUpdates: false`) tidak memiliki timeout per berkas.
   - `updateJobStatusRecord` memanggil `await getSupabaseServerClient()` di luar `try/catch`; bila konteks `cookies()` gagal saat `after()` selesai/abort, eksekusi melempar sebelum mencapai fallback `getSupabaseAdminClient()` terlingkup `created_by`.
   - `GET/POST /api/v1/jobs/[jobId]` dan `/batches/[id]/ingest/[jobId]` belum mengekspor `maxDuration = 300`.
3. **P23-1b — Rescan gagal cepat (~20 dtk) dengan `"The operation was aborted due to timeout"`:**
   - `crawlPublicDriveFolderEmbedded` menembak hingga `CONCURRENCY = 6` secara paralel ke `embeddedfolderview` dengan timeout ketat 12 dtk dan 0 retry/backoff. Satu subfolder lambat melempar `TimeoutError` dan membatalkan seluruh `Promise.all` (0 berkas tersimpan).
   - `crawlPublicDriveFolderApi` hanya me-retry 429/403 (bukan timeout/5xx) dan memindai subfolder secara serial.
4. **P23-2 — Halaman batch tidak menerapkan guard stale:**
   - `BatchDetailPage`, `GET /api/v1/batches/[id]`, dan `GET /api/v1/batches` membaca `getLatestJobForBatch()` mentah tanpa `reconcileStaleJob()` / `getJobStatus()`.
   - `isStaleRunningJob` belum mencakup job yang macet di `pending` (>60 dtk) bila callback `after()` tidak pernah mulai.
   - `rescanBatchDriveAction` dan `retryJobAction` sebelumnya mengandalkan `userId` dari closure tanpa memverifikasi ulang `getUser()` + `requireLspRole()` di dalam Server Action.

---

## 2. Trust Boundary & Acceptance Criteria

- **Siapa yang berhak memanggil:** Pengguna terautentikasi dengan peran LSP `lsp_admin`, `tuk_admin`, atau `assessor` pada `lsp_id` milik batch (`requireLspRole`), serta terikat kepemilikan `created_by = userId` pada fallback admin `jobs`.
- **Kriteria penerimaan (teramati):**
  1. Worker `executeJob` memaksakan batas waktu eksekusi (`WORKER_MAX_EXECUTION_MS = 240_000`) melalui `AbortController` dan menulis status `failed` + audit log `job.*.failed` apabila batas waktu terlewati.
  2. `updateJobStatusRecord` tetap jatuh ke fallback admin terlingkup `created_by` meskipun `cookies()` di `after()` gagal.
  3. `crawlPublicDriveFolder` melakukan retry dengan exponential backoff pada `TimeoutError` / HTTP 429 / 5xx, mengisolasi kegagalan subfolder parsial saat sibling berhasil, dan melempar `DRIVE_CRAWL_TIMEOUT` deskriptif bila root atau seluruh subfolder gagal.
  4. Halaman batch, `GET /api/v1/batches/[id]`, dan `GET /api/v1/batches` merekonsiliasi job `pending` (>60 dtk) maupun `running` (>305 dtk) menjadi `failed` dengan alasan jelas dan tombol **Pindai Ulang Drive** langsung di kotak error.

---

## 3. Daftar Tiket (F5)

| Tiket | Deskripsi | Status |
|---|---|---|
| **T1** | Audit environment Vercel, retention log Hobby, dan root-cause jalur scan/queue | Selesai |
| **T2** | Hardening `updateJobStatusRecord`, batas waktu global `executeJob` (240 dtk), `markJobFailedSafely`, dan `isStalePendingJob` | Selesai |
| **T3** | Retry + backoff listing Drive (`fetchDriveWithRetry`), isolasi subfolder parsial, batas waktu per ZIP/berkas, & progres bertahap | Selesai |
| **T4** | Rekonsiliasi stale di halaman batch & API `/batches`, verifikasi ulang RBAC pada `rescanBatchDriveAction` & `retryJobAction`, `maxDuration = 300`, & tombol pemulihan | Selesai |
