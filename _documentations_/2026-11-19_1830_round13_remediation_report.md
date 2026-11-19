# Round 13 Audit Remediation & Forensic Report

- **Timestamp:** `2026-11-19 18:30 WIB`
- **Base Commit:** `2bba88a` (`fix(round12): audit 06B key activation rejection, distinct disabled grading button, guard terminal job re-execution`)
- **Live Target:** `https://assessor-zeta.vercel.app`
- **Remote Supabase:** `oiplhsmmfuqriaqrxjud` (`20261118000001..20261119000012` synced)
- **Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2 — `audit_log` & 06B activation trust boundary)

---

## 1. Cacat 1 (Menengah) — Uji Validasi / Aktivasi Berkas 06B dari UI + Pencatatan `batch.key_06b.activate.rejected`

### Akar Masalah
1. Di `src/components/batch/batch-key-upload-panel.tsx`, kartu berkas `FR.IA.06B` yang tidak lolos validasi awal (`canActivate === false`, misalnya blanko terenkripsi dari arsip MUK `"FR.IA.06B. LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI.docx"`) hanya menampilkan label statis `"Tidak dapat diaktifkan (blanko / tidak terbaca)"` tanpa tombol aksi apa pun.
2. Di `src/app/(app)/batches/[id]/actions.ts`, `activateBatchMasterKey06bAction` sebelumnya melakukan `return { ok: false, error: textRes.error }` lebih awal ketika `tryResolveCandidate06bText` gagal (mis. `extracted_text = null` pada berkas arsip MUK), sehingga tidak pernah mencapai blok `writeAuditLog({ action: "batch.key_06b.activate.rejected", ... })`.

### Perbaikan
1. **`src/app/(app)/batches/[id]/actions.ts`**:
   - Menyatukan hasil `tryResolveCandidate06bText` dan `validateMasterKey06bContent` menjadi satu jalur penolakan sehingga kegagalan ekstraksi/enkripsi arsip MUK maupun isi blanko kosong keduanya menulis entri `batch.key_06b.activate.rejected` ke `public.audit_log` berisi `fileId`, `fileName`, `source`, `validationStatus`, `substantiveWords`, dan `rejectionReason`.
   - Menambahkan `checkRateLimit(\`key06b:activate:\${user.id}:\${batchId}\`, 20, 60_000)` dan `revalidatePath("/settings/audit")` pada jalur upload, aktivasi, penolakan, dan penonaktifan.
2. **`src/components/batch/batch-key-upload-panel.tsx`**:
   - Menambahkan tombol `"Coba Aktifkan / Uji Validasi"` (`data-testid="try-activate-06b-<fileId>"`) pada kartu berkas `06B` non-aktif agar penolakan dapat diuji langsung dari UI tanpa mengunggah berkas baru.
   - Menampilkan tautan langsung `"Lihat entri penolakan di Log Audit →"` (`/settings/audit`) pada banner penolakan.
3. **`src/lib/audit/job-audit.ts`**:
   - Memindahkan `formatAuditSummary` ke `src/lib/audit/job-audit.ts` dan menambahkan `substantiveWords` serta `rejectionReason` pada `PREFERRED_AUDIT_SUMMARY_KEYS` agar alasan penolakan tampil jelas di kolom Ringkasan `/settings/audit`.

---

## 2. Cacat 2 (Menengah) — Investigasi Forensik Read-Only `job.drive_scan.failed` R3 & Perbaikan Query Audit Log

### Bukti Read-Only dari Database Produksi (`oiplhsmmfuqriaqrxjud`)
Query read-only terhadap `public.audit_log` (`ORDER BY created_at DESC, id DESC`) dan `public.jobs`:

1. **Jumlah total baris `public.audit_log` lintas seluruh tenant:** **`42` baris** (`id` `10..66`):
   - `LSP-K3-ID2` (`b03afb00-9266-467d-823e-44a7830a4077`, tenant demo, `actor_id = e27f3fa3-d2d2-494f-b05c-c97f18446e9f`): **`29` baris** (`id`: `14, 15, 16, 17, 18, 19, 34, 35, 38, 39, 40, 41, 46, 47, 48, 49, 52, 53, 54, 55, 56, 57, 58, 59, 60, 63, 64, 65, 66`).
   - `LSP-VERIFY-E2E` (`dac23f85-6cb8-482f-908a-717cc845703f`, tenant E2E sintetis, `actor_id = b2aee659-4a1c-408c-87e5-b294414fcdca`): **`9` baris** (`id`: `20..29`, termasuk `id = 20` `job.drive_scan.failed`).
   - Tenant pribadi pemilik (`a3b054cf-4b6a-44ed-ad7d-84f69d00b157`, `actor_id = 950f862c-8b9b-4ca0-acc2-c74694f590ba`): **`4` baris** (`id`: `10..13`).
2. **Urutan `BIGSERIAL` `id` di sekitar waktu dugaan (`2026-11-18T08:20:57.246117+00:00`) rapat tanpa celah sama sekali:**

| `id` | `created_at` (UTC) | `action` | `resource` | `resource_id` |
|---|---|---|---|---|
| `14` | `2026-11-18 06:02:37.149472+00` | `onboarding.bootstrap_lsp` | `lsps` | `b03afb00-...` |
| `15` | `2026-11-18 06:15:16.921297+00` | `scheme.manifest.upsert` | `schemes` | `cb75c1cc-...` |
| `16` | `2026-11-18 07:24:30.527749+00` | `provider_settings.update` | `assessor_llm_config` | `NULL` |
| `17` | `2026-11-18 07:25:26.526284+00` | `signature.upload` | `signatures` | `d4ed227b-...` |
| `18` | `2026-11-18 08:55:17.442473+00` | `batch.create` | `batches` | `a3b77bbe-...` (`Demo Audit R3`) |
| `19` | `2026-11-18 08:55:17.737048+00` | `batch.create` | `batches` | `f98e5671-...` (`Demo Audit R4`) |

   - `public.audit_log` dilindungi trigger PostgreSQL `audit_no_update` (`BEFORE UPDATE OR DELETE`) dan `audit_no_truncate` (`BEFORE TRUNCATE`) sejak migrasi `20261118000001_foundation.sql`.
   - Karena `id` `14 -> 15 -> 16 -> 17 -> 18 -> 19` berurutan tanpa lompatan, **tidak pernah ada baris yang disisipkan atau dihapus** di antara `07:25:26` dan `08:55:17` UTC pada 18 November 2026. (Lompatan `id` pada eksekusi sesudahnya seperti `30..33`, `36..37`, `42..45`, `50..51`, `61..62` berasal dari `tests/rls-multi-lsp.test.sql` baris 102 yang menguji `INSERT` dalam transaksi `BEGIN ... ROLLBACK`.)
3. **Alasan tidak adanya `job.drive_scan.failed` milik R3 di `public.audit_log`:**
   - Di `public.jobs`, job pindai `Demo Audit R3` (`id = 82988849-c68b-4447-9f8b-07ec816784be`) berjalan pada `2026-11-18 06:16:26.146582+00` dan gagal pada `2026-11-18 06:16:32.493+00` (`attempts = 1`, error `DRIVE_API_KEY_MISSING`), **18 jam sebelum** commit `ea2efde` (`fix(round7): remediate job audit...`, `2026-11-19 00:15 UTC`) menambahkan `recordJobAuditEvent` ke `src/worker/queue.ts`. Job `82988849` tidak pernah dijalankan ulang sesudah Round 7 sehingga tidak pernah memiliki baris di `audit_log`.
   - Satu-satunya baris `job.drive_scan.failed` di seluruh database adalah `id = 20` (`2026-11-18 12:25:43.232372+00`, job `d254b5e4-e618-450f-b987-31b68089bb5a`) milik tenant sintetis `LSP-VERIFY-E2E` (`dac23f85-6cb8-482f-908a-717cc845703f`), yang bukan tenant `LSP-K3-ID2`.
   - Sesuai larangan brief audit, **tidak ada baris `audit_log` yang dihapus, diubah, atau di-backfill.**

### Perbaikan Repository & UI Log Audit
1. **`src/repositories/audit.repository.ts`**:
   - Memindahkan filter `lsp_id IS NULL` berbasis anggota LSP langsung ke SQL (`drizzle` + `supabase`) sehingga slot `.limit(...)` tidak terpakai oleh baris `lsp_id IS NULL` milik tenant lain.
   - Menambahkan pengurutan deterministik `created_at DESC, id DESC`, dukungan cursor pagination `beforeId` (`id < beforeId`), dan deduplikasi defensif per `id`.
2. **`src/app/(app)/settings/audit/page.tsx`**:
   - Menambah default limit `100` (clamp `10..200`), badge jumlah entri (`Menampilkan N entri`), serta navigasi pagination berbasis cursor (`← Kembali ke Entri Terbaru` dan `Muat Entri Lebih Lama →`).
3. **`src/worker/__tests__/worker.test.ts`**:
   - Menambah uji regresi eksplisit yang membuktikan pemanggilan ulang `executeJob` pada job `drive_scan` terminal (`status: "failed"`) tanpa `triggerAction: "retry"` bersifat no-op dan menghasilkan tepat `1` entri `job.drive_scan.failed`.

---

## 3. Observasi — Daftar Batch di `public.batches` (Penjelasan R1/R2)

Query read-only `SELECT id, name, lsp_id, status, created_by, created_at FROM public.batches` menunjukkan **hanya ada 4 batch di seluruh database**:

| `id` | `name` | Tenant (`lsp_code`) | `status` | `created_at` (UTC) | Badge Dashboard |
|---|---|---|---|---|---|
| `f98e5671-fbcb-42cb-a724-9f69d24f780b` | `Demo Audit R4` | `LSP-K3-ID2` | `draft` | `2026-11-18 07:46:17.59297+00` | `Siap (23 asesi · 344 berkas)` |
| `a3b77bbe-7543-48b7-99e1-25e286689999` | `Demo Audit R3` | `LSP-K3-ID2` | `draft` | `2026-11-18 06:16:24.464344+00` | `Pindai gagal (0 berkas)` |
| `96e25281-36e1-44cf-a5f8-5dc28e715519` | `Uji Live Audit Putaran 5` | `LSP-VERIFY-E2E` | `draft` | `2026-11-18 12:25:39.329057+00` | — |
| `60400be5-38b5-4d3e-b1f9-5ce12caca2ed` | `Batch Uji Ekspor Sintetis Terkonfirmasi` | `LSP-VERIFY-E2E` | `in_assessment` | `2026-11-18 12:24:10.164134+00` | — |

Tidak ada batch bernama `R1` atau `R2` di database; kedua kartu pada dashboard `LSP-K3-ID2` dengan label `"Siap (23 asesi · 344 berkas)"` dan `"Pindai gagal (0 berkas)"` adalah `Demo Audit R4` dan `Demo Audit R3`.

---

## 4. Hasil Verifikasi Gate Nyata (Semua Dijalankan Setelah Perubahan Kode Terakhir)

| Gate | Perintah | Hasil Nyata |
|---|---|---|
| TypeScript Strict | `npx tsc --noEmit` | **PASS** (exit 0, 0 error) |
| ESLint Zero Warnings | `npx eslint . --max-warnings 0` | **PASS** (exit 0, 0 error, 0 warning) |
| Vitest Suite | `npm test` | **PASS** (`28/28` file, `118/118` test, durasi 26.16s) |
| Production Build | `npm run build` | **PASS** (`Compiled successfully in 29.8s`, TypeScript 9.1s, 36 routes + Proxy) |
| Remote Multi-LSP RLS | `npx supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql` | **PASS** (`40/40 PASS`, `0 FAIL`) |
| Playwright Headless UI & Viewport | `verify_ui_playwright.py` (`next start -p 3199`) | **PASS** (`15/15` cek di `1440x900` & `390x844`: `/api/health` 200, 0 overflow horizontal, 0 console/page/5xx error, fail-closed auth redirect `/dashboard`, `/batches/...`, `/settings/audit`) |

---

## 5. Ukuran Codebase (`src/**/*.{ts,tsx}`)

- **Total `src/` (`*.ts`, `*.tsx` termasuk tes):** `166` berkas / **`31.258` baris** (sebelumnya `164` berkas / `30.565` baris di Round 11).
- **Non-test `src/` (`*.ts`, `*.tsx` tanpa `__tests__`, `*.test.*`, `*.spec.*`):** `138` berkas / **`26.613` baris** (sebelumnya `138` berkas / `26.404` baris di Round 11).
