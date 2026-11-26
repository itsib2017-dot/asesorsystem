# Putaran 23 (T1–T4) — Reliabilitas Pemindaian Drive & Pemulihan Job Macet

- **Tanggal:** 2026-11-26 15:12 WIB
- **Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2)
- **Cakupan:** P23-1 (`drive_scan` macet di `running (10%)` & timeout listing Google Drive 12–15 dtk) dan P23-2 (halaman batch tidak menampilkan status stale/error serta tidak ada tombol ulang langsung).
- **Di luar cakupan:** T5–T11 (D1/D2/triage-to-assessee, N1–N4 chunked grading, ekspor template 04A, P2-13) dan keputusan skema Operator K3.

---

## 1. Diagnosis Lingkungan & Root Cause (T1)

1. **Vercel Hobby (`npx vercel env ls` & `npx vercel logs`):**
   - `ENABLE_DIRECT_DB` tidak diatur di Vercel Production, sehingga `hasDatabaseUrl()` bernilai `false` dan seluruh operasi repository memakai jalur `getSupabaseServerClient()` (`cookies()`).
   - Retensi runtime log Vercel Hobby hanya 1 jam (log kejadian 11:19 UTC sudah terhapus retensi saat investigasi 14:34 WIB).
2. **P23-1a — Pemindaian Drive macet di `running (10%)` tanpa pesan error:**
   - `handleDriveScanJob` (`src/worker/index.ts`) sebelumnya tidak memiliki batas waktu eksekusi total maupun pembaruan progres antara 10% dan 100%, serta `enrichFilesByContent` cabang non-persisten (`src/services/drive-extract.ts`) tidak memiliki batas waktu per berkas.
   - `updateJobStatusRecord` (`src/repositories/jobs.repository.ts`) memanggil `await getSupabaseServerClient()` di luar `try/catch`; bila konteks `cookies()` gagal saat `after()` terputus/selesai, eksekusi melempar sebelum mencapai fallback `getSupabaseAdminClient()` terlingkup `created_by`.
   - `src/app/api/v1/jobs/[jobId]/route.ts` dan `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx` belum mengekspor `maxDuration = 300`.
3. **P23-1b — Rescan gagal cepat (~20 dtk) dengan `"The operation was aborted due to timeout"`:**
   - `crawlPublicDriveFolderEmbedded` (`src/services/drive.ts`) menembak hingga `CONCURRENCY = 6` secara paralel ke `embeddedfolderview` dengan `AbortSignal.timeout(12000)` dan nol retry/backoff. Satu subfolder lambat melempar `TimeoutError` yang menggagalkan seluruh `Promise.all` (0 berkas tersimpan).
   - `crawlPublicDriveFolderApi` hanya me-retry HTTP 429/403 (bukan timeout/5xx) dan memindai subfolder secara serial.
4. **P23-2 — Halaman batch tidak menerapkan guard stale:**
   - `BatchDetailPage`, `GET /api/v1/batches/[id]`, dan `GET /api/v1/batches` memanggil `getLatestJobForBatch()` mentah tanpa `reconcileStaleJob()` / `getJobStatus()`.
   - `job-staleness.ts` hanya memeriksa `status === "running"` (>305 dtk), belum memeriksa `status === "pending"` (>60 dtk) apabila callback `after()` tidak pernah dijalankan.
   - `rescanBatchDriveAction` dan `retryJobAction` mengandalkan `userId` closure tanpa memverifikasi ulang `getUser()` + `requireLspRole()` di dalam Server Action.

---

## 2. Perubahan Kode

| Berkas | Perubahan |
|---|---|
| `src/repositories/jobs.repository.ts` | Membungkus `getSupabaseServerClient()` + update REST pada `updateJobStatusRecord` dengan `try/catch` agar kegagalan `cookies()` di `after()` selalu jatuh ke fallback `getSupabaseAdminClient()` terlingkup `created_by = params.userId`. |
| `src/worker/job-staleness.ts` | Menambah `STALE_PENDING_MS = 60_000`, `isStalePendingJob()`, dan `getStaleJobReason()` (mempertahankan `STALE_RUNNING_MS = 305_000`). |
| `src/worker/queue.ts` | Menambah `WORKER_MAX_EXECUTION_MS = 240_000` dengan `AbortController` + `Promise.race`, `onProgress` heartbeat (`1..99`), `markJobFailedSafely()`, `reconcileStaleJob()`, dan `getLatestJobStatusForBatch()`. |
| `src/services/drive.ts` | Menambah `fetchDriveWithRetry()` (timeout 20 dtk/permintaan, 3 percobaan dengan backoff eksponensial, linked `AbortController`), menurunkan `EMBEDDED_CRAWL_CONCURRENCY` dari `6` → `2`, isolasi subfolder gagal parsial (`onWarning`), pesan error `DRIVE_CRAWL_TIMEOUT` deskriptif, dan logging terstruktur saat fallback API (`apiKey` tidak pernah dicatat). |
| `src/services/drive-extract.ts` | Menambah `signal`, `deadlineAtMs`, dan `fileTimeoutMs = 20_000` (`runWithTimeout`) di `enrichFilesByContent` cabang non-persisten. |
| `src/worker/index.ts` | Menambah `signal` & `onProgress` di `WorkerJobInput`, timeout 30 dtk per arsip ZIP + deadline guard di `expandZipArchivesForScan`, serta milestone progres (`15, 40, 55, 75, 90`) & `crawlWarnings` di `handleDriveScanJob`. |
| `src/app/api/v1/batches/[id]/route.ts`, `src/app/api/v1/batches/route.ts`, `src/app/api/v1/jobs/[jobId]/route.ts` | Rekonsiliasi job `drive_scan` stale di GET detail & GET list batch, `markJobFailedSafely` di `after()` POST batch, serta `export const maxDuration = 300;` di route job. |
| `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/ingest/[jobId]/page.tsx`, `src/components/batch/job-status-poller.tsx` | Menggunakan `getLatestJobStatusForBatch()`, memverifikasi ulang `getUser()` + `requireLspRole()` di dalam `rescanBatchDriveAction` & `retryJobAction`, memindahkan `retryJobAction` ke `after()` dengan `markJobFailedSafely`, menambah tombol **Pindai Ulang Drive** langsung di kotak alert gagal, serta menyalurkan `error` ke `JobStatusPoller`. |
| `vitest.config.ts` | Menambah `testTimeout: 15_000` agar import modul rute berat (`ak05/export`) tidak timeout saat eksekusi paralel di Windows. |
| Tes baru/diperbarui | `job-staleness.test.ts`, `worker.test.ts`, `jobs-repository.test.ts`, `drive.test.ts`, dan `src/app/api/v1/batches/[id]/__tests__/route.test.ts`. |

---

## 3. Verifikasi & Bukti Keamanan (F10)

- **Static & Test Gates (setelah edit terakhir):**
  - `npm run typecheck` (`tsc --noEmit`): **0 error**.
  - `npx eslint . --max-warnings 0`: **0 error, 0 warning**.
  - `npm run test` (`vitest run`): **60/60 test file lulus, 303/303 tes lulus**.
- **Catatan UI Browser:** Paket npm `playwright` tidak terpasang di `package.json` maupun global npm pada lingkungan lokal (hanya cache biner `$LOCALAPPDATA\ms-playwright`); UI/UX alert gagal + tombol pemulihan diverifikasi melalui kontrak JSX/komponen serta `JobStatusPoller` + rute `/api/v1/batches/[id]` (`route.test.ts`), dan siap diverifikasi live pasca-deploy Git push pada batch `2050a077` / `ca4c040d`.
- **RBAC & Trust Boundary:**
  - `rescanBatchDriveAction` & `retryJobAction` kini memanggil ulang `getUser()`, `getBatchById(currentUser.id, batchId)`, dan `requireLspRole(freshBatch.lspId, currentUser.id, ["lsp_admin", "tuk_admin", "assessor"])`.
  - Fallback service role `updateJobStatusRecord` tetap terikat `.eq("id", params.jobId).eq("created_by", params.userId)`.

---

## 4. Rollback & Checkpoint

- **Rollback:** `git revert <commit-hash>` atau kembalikan ke `8b06319` (`git push` akan mendeploy ulang otomatis di Vercel).
- **Checkpoint disarankan:** Setelah deploy T1–T4 terverifikasi live pada scan batch `2050a077`, buat salinan proyek stabil di folder `_backups_`.
