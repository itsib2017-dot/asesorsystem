# F2 / F5 Spec — Putaran 22 (hal. 2): Eksekusi Asinkron DIT, Penanganan Respons Non-JSON & Guardrail LLM

- **Tanggal:** 2026-11-24
- **Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2)
- **Status:** Implemented & Verified

## 1. Masalah & Pengguna Terdampak
- **Pengguna:** Asesor kompetensi yang menjalankan analisis DIT (`FR.IA.04A` vs Presentasi/Formulir DIT & CV).
- **Masalah:** `POST /api/v1/dit/[assesseeId]/analyse` menjalankan download/ekstraksi Drive dan pemanggilan LLM secara sinkron di dalam request HTTP, sehingga saat model BYOK reasoning dengan `max_tokens = 52100` dan materi besar melewati batas 300 detik Vercel Hobby, platform membalas teks mentah `HTTP 504` (`FUNCTION_INVOCATION_TIMEOUT`). Klien lalu gagal di `res.json()` dan memotong pesan error menjadi `Unexpected token 'A', "An error o"... is not valid JSON`.

## 2. Trust Boundary & Keamanan
- Autentikasi session (`getUser()`) + RBAC (`requireLspRole(assessee.lspId, user.id, ["lsp_admin", "assessor"])`) + rate limit per user (`dit:analyse:${user.id}`).
- Zero pengiriman KTP/NIK ke LLM (tetap melalui `redactPii` + `assertNoPiiLeak` pada prompt DIT).
- Zero eksekusi ulang otomatis tanpa aksi eksplisit asesor.

## 3. Kriteria Penerimaan (Acceptance Criteria)
1. `POST /api/v1/dit/[assesseeId]/analyse` melakukan pemeriksaan RBAC (`403` jika bukan `lsp_admin`/`assessor`) dan validasi kelengkapan metadata DB tanpa download Drive sinkron (`422` jika belum lengkap), lalu langsung mengembalikan `202 Accepted` JSON (`runImmediately: false`) dan menjadwalkan `executeJob` lewat Next.js `after()` dengan `maxDuration = 300`.
2. Worker mengekstrak berkas Drive secara asinkron dengan batas waktu per-berkas `30.000 ms` dan melempar detail error ekstraksi (`UNPROCESSABLE: Bahan DIT belum lengkap setelah ekstraksi ...`) bila dokumen ternyata pindaian gambar kosong.
3. `generateStructured` membatasi `maxOutputTokens <= 16_384`, `maxRetries: 0`, dan `timeout: 115_000 ms` per percobaan agar 2 percobaan tetap selesai di bawah batas 300 detik dan memunculkan pesan timeout yang jelas bila model lambat.
4. `STALE_RUNNING_MS` disetel ke `305_000 ms` agar job yang terhenti oleh batas 300s platform langsung berstatus `failed` saat di-poll di `310s`.
5. Klien UI (`readApiResponse`) membaca `res.text()` sebelum `JSON.parse` dan menampilkan pesan non-JSON platform (HTTP 502/504) maupun error worker secara utuh tanpa pemotongan.

## 4. Daftar Tiket (F5)
1. `readApiResponse` + pembaruan trigger UI (`dit-analysis-trigger`, `create-batch-panel`, `similarity-run-trigger`, `extract-file-trigger`, `wait-for-job`, `job-status-poller`).
2. `POST /api/v1/dit/[assesseeId]/analyse` asinkron (`after()` + `maxDuration = 300` + `requireLspRole`) + timeout ekstraksi worker.
3. Guardrail LLM (`MAX_STRUCTURED_OUTPUT_TOKENS = 16_384`, `timeout = 115_000 ms`, `maxRetries = 0`) + `STALE_RUNNING_MS = 305_000`.
4. Uji Vitest unit/integrasi + verifikasi build & Playwright lokal.
5. Dokumentasi berstempel waktu + pencatatan spec/gap log/laporan uji.
