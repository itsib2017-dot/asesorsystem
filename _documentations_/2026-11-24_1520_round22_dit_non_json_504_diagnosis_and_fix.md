# Diagnosis & Remediasi Putaran 22 (hal. 2): Analisis DIT Gagal — HTTP 504 Non-JSON

- **Tanggal:** 2026-11-24 15:20 +07:00
- **Pemicu:** Brief Developer Putaran 22 (hal. 2) — run DIT Asesi Uji (`f166d221-430a-426e-ac90-b0fae1bfede0`) pada batch simulasi `6d577c84-844e-47ae-a170-47fada8e13e2` pada 24 Nov 2026 ±13:02–13:08 WIB gagal dengan error UI: `Unexpected token 'A', "An error o"... is not valid JSON`.
- **HEAD Sebelum Perbaikan:** `d6429ad`
- **Target Supabase:** `oiplhsmmfuqriaqrxjud` (diinspeksi **strictly read-only**, zero mutasi data/batch, zero retry DIT).

---

## 1. Hasil Investigasi & Bukti Server (Root Cause Terkonfirmasi)

### 1.1 Log Vercel (`vercel logs requests`)
- `2026-11-24T06:02:34.382Z` (`13:02:34 WIB`)
- `requestId`: `vr5f7-1795500154382-39a4f9310c55`
- `route`: `POST /api/v1/dit/[assesseeId]/analyse` (`deploymentId: dpl_4RtrXAxw4jc2ZXfQW1t3LzfsyTWH`)
- `httpStatus`: **`504`** (`FUNCTION_INVOCATION_TIMEOUT`), `pathType: streaming_func`, `edgeNetworkRegion: sfo1`.
- *Catatan observabilitas:* `vercel logs runtime` pada paket Hobby memiliki retensi 1 jam sehingga log stdout/stderr 06:02Z tidak lagi tersedia pada 14:45 WIB, namun rekam jejak transaksi di PostgreSQL (`drive_files`, `jobs`, `audit_log`, `assessor_llm_config`) utuh hingga tingkat milidetik.

### 1.2 Bukti Ekstraktor Layout Baru (`d6429ad`) TIDAK Menggantung
- Di `public.drive_files` untuk asesi `f166d221-430a-426e-ac90-b0fae1bfede0`, seluruh 5 berkas yang sebelumnya belum diekstrak berhasil diekstrak dan disimpan ke DB dalam **~9,7 detik** setelah request masuk (`06:02:34Z`):
  - `06:02:40.196Z`: `4. Form ERP.docx` (`ooxml_docx`, `1.358` char)
  - `06:02:40.245Z`: `2. Form Inspeksi APD.docx` (`ooxml_docx`, `1.365` char)
  - `06:02:40.495Z`: `CV - Aryanto.pdf` (`pdf_text_layer`, `1.361` char)
  - `06:02:41.454Z`: `FR.IA.04A. PENJELASAN PROYEK SINGKAT ATAU KEGIATAN TERSTRUKTUR LAINNYA (2).docx` (`ooxml_docx`, `12.534` char)
  - `06:02:41.654Z`: `Tugas. Presentasi DIT - AK3U.pptx` (`ooxml_pptx`, `5.215` char)
  - `06:02:44.110Z`: `Investigasi Terjebak - Aryanto.docx` (`ooxml_docx`, `3.182` char)
- Benchmark lokal `extractTextFromBuffer` (`d6429ad`) terhadap berkas Drive asli Asesi Uji juga selesai sangat cepat tanpa throw:
  - `04A (.docx)` (`238.863` byte): unduh `2.980 ms`, ekstrak **`506 ms`**, `12.534` char.
  - `CV (.pdf)` (`149.524` byte): unduh `1.789 ms`, ekstrak **`17 ms`**, `1.361` char.
  - `04B (.pptx)` (`7.877.796` byte): unduh `2.777 ms`, ekstrak **`238 ms`**, `5.215` char.
- Badge UI terlihat tetap `"Drive"` karena respons 504 membuat browser melempar `SyntaxError` sebelum `router.refresh()` sempat dipanggil.

### 1.3 Root Cause Sebenarnya (3 Lapis Masalah)
1. **Eksekusi Worker Sinkron di Dalam Request HTTP `POST` (`src/app/api/v1/dit/[assesseeId]/analyse/route.ts`):**
   - Route `POST` memanggil `await enqueueJob(...)` dengan `runImmediately: true`, sehingga permintaan HTTP `POST` ditahan terbuka hingga seluruh proses LLM selesai.
   - Pada `06:02:44.912Z`, job `0b646d0b-3760-44a6-a3ad-05136d4d9115` berhasil masuk DB lalu berstatus `running` pada `06:02:45.949Z` (`audit_log` id `170` & `171`).
2. **Panggilan LLM Tanpa Batas Waktu & Batas Token Terstruktur Terlalu Besar (`src/ai/llm.ts`):**
   - Konfigurasi BYOK aktif di `assessor_llm_config`: `openai-compatible` / `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` dengan `max_tokens = 52100`.
   - Payload presentasi `p04b_len = 25.570` char (~2,3× lebih besar dibanding run Putaran 18 yang `11.193` char / `67s`).
   - `generateText` dipanggil tanpa `timeout`, tanpa `maxRetries: 0` (sehingga retry internal SDK AI menumpuk di atas loop 2-attempt `generateStructured`), dan dengan `maxOutputTokens: 52100` pada model reasoning. Durasi melampaui **300 detik** → Vercel memutus fungsi dengan HTTP `504`, meninggalkan job `0b646d0b…` yatim dalam `status = "running"` dan `dit_analyses` kosong.
3. **Pemotongan Error Non-JSON di Klien (`dit-analysis-trigger.tsx` & komponen trigger lain):**
   - Klien langsung memanggil `await res.json()` tanpa membaca `await res.text()` terlebih dahulu. Saat Vercel mengembalikan teks mentah `"An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT..."`, parser JSON V8 melempar `Unexpected token 'A', "An error o"... is not valid JSON` yang memotong pesan asli platform.
   - Selain itu, `waitForJob` membatasi error job hingga `.slice(0, 400)` dan tidak melakukan `router.refresh()` saat error parsing terjadi.

---

## 2. Perubahan yang Diterapkan

1. **Client Safe Response Reader & Error Utuh ([src/lib/http/read-api-response.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/lib/http/read-api-response.ts)):**
   - Membaca `res.text()` terlebih dahulu, melakukan `JSON.parse`, dan bila respons non-JSON (502/504 teks atau HTML), membersihkan tag/script HTML tanpa memotong karakter awal sehingga pesan platform (`HTTP 504 ... FUNCTION_INVOCATION_TIMEOUT ...`) tampil utuh.
   - Diterapkan di `dit-analysis-trigger.tsx` (menghapus `.slice(0, 400)`, menambah `router.refresh()`, menambah `whitespace-pre-wrap break-words`), `create-batch-panel.tsx`, `similarity-run-trigger.tsx`, `extract-file-trigger.tsx`, `wait-for-job.ts` (default timeout `310_000 ms`), dan `job-status-poller.tsx`.

2. **Dekoupling Ekstraksi & Eksekusi DIT dari `POST` Sinkron ([src/app/api/v1/dit/[assesseeId]/analyse/route.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/api/v1/dit/%5BassesseeId%5D/analyse/route.ts)):**
   - Menambahkan `export const maxDuration = 300;` dan validasi RBAC `requireLspRole(assessee.lspId, user.id, ["lsp_admin", "assessor"])`.
   - Mengganti download sinkron di `POST` dengan gerbang kelengkapan berbasis metadata DB (< 100 ms), melakukan `enqueueJob({ ..., runImmediately: false })`, lalu menjadwalkan `executeJob(...)` di `after()` (`next/server`), sehingga `POST` selalu kembali `202 Accepted` JSON valid dalam < 1 detik.
   - Menambahkan guard timeout ekstraksi berkas per-file `30_000 ms` di `src/services/drive-extract.ts` dan pelaporan detail error ekstraksi (`UNPROCESSABLE: Bahan DIT belum lengkap setelah ekstraksi (...)`) di `src/worker/index.ts`.

3. **Guardrail Timeout & Cap Token Terstruktur LLM ([src/ai/llm.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/ai/llm.ts) & [src/worker/job-staleness.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/worker/job-staleness.ts)):**
   - Membatasi `maxOutputTokens` terstruktur maksimal `MAX_STRUCTURED_OUTPUT_TOKENS = 16_384` (disetujui pemilik dari `52100`), menetapkan `maxRetries: 0` di SDK AI agar tidak menggandakan loop 2-attempt, serta memberi `timeout: 115_000 ms` per percobaan dengan pesan timeout berbahasa Indonesia yang jelas.
   - Menyelaraskan `STALE_RUNNING_MS` dari `360_000` menjadi `305_000` ms agar job yatim pasca batas 300s Vercel segera ditandai `failed`.

---

## 3. Verifikasi & Status Gate

- `npx tsc --noEmit`: **PASS (0 error)**.
- `npx eslint . --max-warnings 0`: **PASS (0 error, 0 warning)**.
- `npx vitest run`: **PASS — 44/44 berkas uji, 208/208 kasus lulus** (termasuk `read-api-response.test.ts`, `route.test.ts` async `after()` + RBAC 403, `llm.test.ts` cap `16384` & timeout `115s`, dan `worker.test.ts` error ekstraksi + `STALE_RUNNING_MS`).
- `npm run build` (`next build`): **PASS** (Next.js 16.4.6 Turbopack, semua rute terkompilasi).
- **Playwright (Chromium `1208` terhadap `next start -p 3199`):**
  - `GET /api/health`: `200` JSON `ok: true`.
  - `POST /api/v1/dit/f166d221-430a-426e-ac90-b0fae1bfede0/analyse` (unauthenticated): `401` JSON `UNAUTHORIZED`.
  - `/login` desktop (`1440×900`) & mobile (`390×844`): `200`, `overflow = false`, `0` console error, `0` page error.
  - `/batches/6d577c84-.../assessees/f166d221-.../dit` (unauthenticated): fail-closed redirect ke `/login?next=...`.
- **Nol retry DIT dijalankan** pada lingkungan produksi selama seluruh proses perbaikan.
