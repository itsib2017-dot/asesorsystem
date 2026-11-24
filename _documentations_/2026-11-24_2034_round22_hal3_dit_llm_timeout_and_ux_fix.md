# Diagnosis & Remediasi Putaran 22 (hal. 3): Timeout LLM 115s, Kompaksi Payload & UX Job ID

- **Tanggal:** 2026-11-24 20:34 +07:00
- **Pemicu:** Brief Developer Putaran 22 (hal. 3) — re-test DIT pasca `c70e110` pada batch simulasi `6d577c84-844e-47ae-a170-47fada8e13e2` / Asesi Uji (`f166d221-430a-426e-ac90-b0fae1bfede0`) pada 20:06–20:10 WIB gagal pada job `ad17a9fc-3459-430e-a6a8-f7d52832fdce` dengan error utuh `melewati batas waktu 115 detik per percobaan`.
- **HEAD Sebelum Perbaikan:** `c70e110`
- **Target Supabase:** `oiplhsmmfuqriaqrxjud` (diinspeksi **strictly read-only**, nol retry DIT).

---

## 1. Bukti Log Runtime Vercel & DB (`2q2hf-1795525593723-fd668918f656`)

1. **Perbaikan `c70e110` terkonfirmasi bekerja live:**
   - `POST /api/v1/dit/.../analyse` langsung mengembalikan `202 Accepted` dan menjalankan `worker.dispatch.dit_analysis` pada `13:06:42.211Z` (UI tetap responsif, ketiga badge input `"Siap"`, pesan error tampil utuh tanpa terpotong).
2. **Mengapa gagal di `235,6s` (`ad17a9fc-3459-430e-a6a8-f7d52832fdce`):**
   - `13:08:40.111Z`: Attempt 1 diputus tepat di **`115.010 ms`** (`timeoutMs: 115000`).
   - `13:10:35.115Z`: Attempt 2 diputus tepat di **`115.003 ms`** (`timeoutMs: 115000`).
   - Desain statis `2 × 115s` memotong model reasoning (`openai-compatible/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`) di tengah jalan lalu mengulang prompt identik dari nol.
3. **Temuan Baru pada Payload Asesi Uji (`39.465` char total vs `26.992` char di Putaran 18):**
   - `IBR Cleaning Tanki.xlsx` menyumbang **`14.135` dari `25.570` char** presentasi (`IBPR kosong`: `7.628` char penuh pengulangan kolom merge `DEPARTEMEN : | DEPARTEMEN : ...`, titik placeholder `….........`, dan artefak **`[object Object]`** karena `extractTextFromXlsx` memakai `String(v ?? "")` pada sel rich-text/formula ExcelJS).
   - Uji kompaksi lossless lokal pada `IBR Cleaning Tanki.xlsx`: **`14.123 → 8.343` char (-41%)** tanpa menghilangkan isi analisis risiko kandidat.

---

## 2. Solusi yang Diterapkan

1. **Anggaran Waktu Dinamis & No-Retry-on-Timeout ([src/ai/llm.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/ai/llm.ts)):**
   - `DEFAULT_LLM_TOTAL_BUDGET_MS = 240_000` (menyisakan margin 60s di bawah batas 300s Vercel), `DEFAULT_LLM_ATTEMPT_TIMEOUT_MS = 220_000` (hampir 2× batas lama 115s), `MIN_LLM_RETRY_BUDGET_MS = 30_000`.
   - Jika Attempt 1 gagal karena timeout/abort (`isLlmTimeoutError`), eksekusi langsung berhenti tanpa mengulang panggilan lambat yang sama; retry Attempt 2 hanya berjalan untuk error validasi cepat selama sisa anggaran ≥ 30s.

2. **Perbaikan Ekstraktor XLSX & Kompaksi Prompt Lossless ([src/services/extract.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/extract.ts), [src/ai/prompts/dit-gap-analysis.v1.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/ai/prompts/dit-gap-analysis.v1.ts)):**
   - `formatExcelCellValue` mengekstrak `richText`, `{ result }`, `{ text }`, dan `Date` tanpa menghasilkan `[object Object]`, serta menduplikasi sel merge dan baris header berulang.
   - `compactDitPromptSection` membersihkan teks cache DB (`[object Object]`, kolom merge duplikat, sel titik placeholder, baris duplikat berurutan) setelah `redactPii` dan menegakkan batas aman per bagian (`04A: 16.000`, `presentasi/formulir: 24.000`, `CV: 8.000` char).

3. **Job ID Live Saat Berjalan & Pemisahan Pesan Timeout vs Kuota ([src/lib/jobs/wait-for-job.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/lib/jobs/wait-for-job.ts), [src/lib/jobs/format-dit-error.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/lib/jobs/format-dit-error.ts), [dit-analysis-trigger.tsx](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/_components/dit-analysis-trigger.tsx)):**
   - Menampilkan banner status aktif segera setelah HTTP `202` berisi **Job ID lengkap** (`data-testid="dit-active-job-id"`) + progres live (`status · progress%`).
   - `formatDitJobFailureMessage` mengklasifikasikan error menjadi `timeout` (*"bukan masalah kuota"*, sarankan ulangi / ringkas lampiran / model lebih cepat), `quota`, `config`, `input`, atau `unknown` — tidak lagi menyesatkan pengguna bahwa timeout berasal dari kuota.

---

## 3. Verifikasi & Status Gate

- `npx tsc --noEmit`: **PASS (0 error)**.
- `npx eslint . --max-warnings 0`: **PASS (0 warning, 0 error)**.
- `npx vitest run`: **PASS — 45/45 berkas uji, 217/217 kasus lulus** (termasuk `llm.test.ts` 5/5, `extract-and-drive-download.test.ts` 14/14, `dit.test.ts` 4/4, `format-dit-error.test.ts` 5/5, `wait-for-job.test.ts` 2/2).
- `npm run build` (`next build`): **PASS**.
- **Playwright (Chromium `1208`, `next start -p 3199`):** `GET /api/health` (`200`), unauthenticated `POST /api/v1/dit/.../analyse` (`401` JSON), `/login` desktop & mobile (`200`, `0` overflow), `/dit` unauth redirect (`/login?next=...`), `0` console/page error.
