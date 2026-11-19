# Rencana Remediasi Putaran 13 — 2026-11-19 18:15 WIB

Status: **COMPLETED — T0–T8 terverifikasi & didorong ke `origin/main` (Playwright digunakan sesuai persetujuan pemilik).**
Basis: HEAD `2bba88a` · ground_rules_v5.md (AUDIT MODE: audit log + aktivasi kunci = trust boundary).
Sumber: brief putaran 13 + laporan kesenjangan v1.4 vs implementasi.

## OODA

### Observe
- Cacat 1: berkas 06B terdeteksi tidak punya kontrol aktivasi per berkas → entri `batch.key_06b.activate.rejected` tak bisa dipicu dari UI.
- Cacat 2: 2 entri `job.drive_scan.failed` R3 tampil (R12) lalu hilang (R13); log 29 entri.
- Observasi R1/R2 belum dijelaskan.
- Gate tes (tsc/eslint/vitest/Playwright/RLS) masih TERTUNDA di `docs/testing/feature-test-report.md` §4.

### Orient (hipotesis dari kode, belum terbukti)
`src/repositories/audit.repository.ts` `listAuditLogsForUser`:
1. `.limit(50)` diterapkan **sebelum** filter JS (L77/L129, lalu L82–87 / L137–142) → jumlah tampil < 50 (29) dan isi bergeser seiring entri baru → entri lama "hilang" dari jendela. Tidak ada pagination.
2. Filter JS membuang baris `lsp_id IS NULL` dengan `actor_id` NULL (event worker/job) → event job tanpa `lsp_id` tidak pernah konsisten tampil.
3. Duplikat R12: kandidat = `executeJob` dijalankan ulang (guard baru di `2bba88a`) → 2 baris nyata, bukan artefak render. **Harus dibuktikan via query read-only**, bukan diasumsikan.

### Decide — tiket (satu perubahan per tiket)

| # | Tiket | Mode | Berkas | Kriteria lolos | Status |
|---|---|---|---|---|---|
| T0 | Investigasi read-only Cacat 2 & observasi R1/R2 | AUDIT | `_documentations_` (laporan) | Penjelasan tertulis + output query. **Tanpa mengubah/menghapus/backfill log.** | **DONE** |
| T1 | Perbaiki repo: filter tenant di SQL (bukan JS), `limit` sesudah filter, pagination berbasis cursor (`created_at,id`) | AUDIT | `audit.repository.ts` + tes Vitest (`drizzle` + `supabase`) | Tepat 1 baris per entri; tak ada entri hilang; tes tenant A tak melihat B | **DONE** |
| T2 | Pastikan event job tidak duplikat & guard terminal `executeJob` teruji | AUDIT | `queue.ts` + `worker.test.ts` | Job gagal baru → tepat 1 `job.drive_scan.failed` (tes) | **DONE** |
| T3 | UI pagination di `/settings/audit` (Server Component) & summary `substantiveWords`/`rejectionReason` | FAST | `settings/audit/page.tsx`, `job-audit.ts` | Seluruh riwayat bisa dijelajah via `beforeId` | **DONE** |
| T4 | `activateBatchMasterKey06bAction`: auth + `requireLspRole` + kepemilikan berkas (IDOR) + Zod + rate limit; tolak blanko/encrypted → `batch.key_06b.activate.rejected` | AUDIT | `batches/[id]/actions.ts` + `actions.test.ts` | Tes: blanko/encrypted → ditolak + entri audit; peran salah → ditolak; fileId tenant lain → generik | **DONE** |
| T5 | Tombol `"Coba Aktifkan / Uji Validasi"` per kartu berkas 06B + tautan ke `/settings/audit` | FAST | `batch-key-upload-panel.tsx` + SSR test | Dari UI/SSR: tombol & pesan penolakan terlihat; tautan ke log tersedia | **DONE** |
| T6 | Jalankan gate nyata: `tsc --noEmit`, `eslint --max-warnings 0`, `npm test`, `npm run build`, RLS | — | `docs/testing/feature-test-report.md` | Output perintah nyata | **DONE** |
| T7 | Verifikasi UI/UX dengan **Playwright** (sesuai pilihan pemilik: lokal `next start` + live `assessor-zeta.vercel.app`, desktop `1440x900` & mobile `390x844`) | — | `_documentations_` + screenshot scratch | 15/15 cek lokal + 15/15 cek live PASS | **DONE** |
| T8 | Update docs: F2/F5 spec, F10 `security-proof.md`, `ADR-0006`, `graphify-out`, laporan remediasi | — | `docs/`, `_documentations_/`, `graphify-out/` | DoD §0.5 terpenuhi | **DONE** |

### Act
Selesai berurutan T0 → T8 dengan checkpoint di `_backups_/2026-11-19_1830_round13_verified`.

## Di luar lingkup (laporan kesenjangan)
12 celah P0/P1 (OCR KTP, MFA, invite-only, peran, kata sandi 12, formulir, dll.) **tidak** disentuh putaran ini — butuh keputusan pemilik; diusulkan jadi putaran terpisah, mulai dari OCR KTP + MFA.

## Larangan dipatuhi
Tidak menulis ulang/menghapus/backfill log; tidak mengunggah kunci; tidak menjalankan grading; tidak mengubah spec v1.4/ambang; tidak konfirmasi nama; hanya folder demo.

## Agent-browser
`agent-browser` = dependensi/CLI baru → butuh persetujuan (§A.2/§C.8). Alternatif: Playwright (sudah di stack).
