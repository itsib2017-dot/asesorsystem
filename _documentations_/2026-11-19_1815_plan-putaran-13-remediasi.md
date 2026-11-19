# Rencana Remediasi Putaran 13 — 2026-11-19 18:15 WIB

Status: **DRAFT — menunggu persetujuan pemilik. Belum ada kode yang diubah.**
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

| # | Tiket | Mode | Berkas | Kriteria lolos |
|---|---|---|---|---|
| T0 | Investigasi read-only Cacat 2: `SELECT id, action, lsp_id, actor_id, resource_id, created_at FROM audit_log WHERE action='job.drive_scan.failed'` + hitung total per tenant; telusur asal R1/R2 (`batches.created_at, created_by, lsp_id`) | AUDIT | `_documentations_` (laporan) | Penjelasan tertulis + output query. **Tanpa mengubah/menghapus/backfill log.** |
| T1 | Perbaiki repo: filter tenant di SQL (bukan JS), `limit` sesudah filter, pagination berbasis cursor (`created_at,id`) | AUDIT | `audit.repository.ts` + tes Vitest | Tepat 1 baris per entri; tak ada entri hilang; tes tenant A tak melihat B |
| T2 | Pastikan event job ditulis dengan `lsp_id` batch (bila T0 membuktikan NULL) | AUDIT | worker/queue (penulis audit job) | Job gagal baru → tepat 1 `job.drive_scan.failed` dengan `lsp_id` (tes) |
| T3 | UI pagination di `/settings/audit` (Server Component, "Muat lebih lama") | FAST | halaman audit | Seluruh riwayat bisa dijelajah |
| T4 | Server Action `tryActivateDetectedKey06bAction(batchId, fileId)`: auth + `requireLspRole` + kepemilikan berkas (IDOR) + Zod + rate limit; jalankan `validateMasterKey06bContent` pada berkas yang sudah ada; tolak → `batch.key_06b.activate.rejected` | AUDIT | `batches/[id]/actions.ts` + tes | Tes: blanko → ditolak + entri audit; peran salah → ditolak; fileId tenant lain → generik |
| T5 | Tombol "Uji & Aktifkan" per kartu berkas 06B (Client island kecil, justifikasi `use client`) + pesan penolakan berisi ringkasan validasi + tautan ke `/settings/audit` | FAST | komponen kartu berkas | Dari UI: pesan penolakan terlihat; entri muncul di log |
| T6 | Jalankan gate nyata: `tsc --noEmit`, `eslint --max-warnings 0`, `npm test`, RLS, Playwright; laporkan output asli | — | `docs/testing/feature-test-report.md` | Output perintah, bukan klaim |
| T7 | Verifikasi UI/UX dengan **vercel-labs/agent-browser** (lokal + preview): alur T5, log T3, viewport 390px | — | `_documentations_` + screenshot | Bukti tangkapan layar |
| T8 | Update docs: F2 spec, F10 `security-proof.md`, ADR (bila pagination/cursor), `graphify update`, decision log | — | `docs/` | DoD §0.5 |

### Act
Hanya setelah persetujuan. Urutan: T0 → (T1,T2) → T3 → T4 → T5 → T6 → T7 → T8. Checkpoint `_backups_` setelah T3 dan T5.

## Di luar lingkup (laporan kesenjangan)
12 celah P0/P1 (OCR KTP, MFA, invite-only, peran, kata sandi 12, formulir, dll.) **tidak** disentuh putaran ini — butuh keputusan pemilik; diusulkan jadi putaran terpisah, mulai dari OCR KTP + MFA.

## Larangan dipatuhi
Tidak menulis ulang/menghapus/backfill log; tidak mengunggah kunci; tidak menjalankan grading; tidak mengubah spec v1.4/ambang; tidak konfirmasi nama; hanya folder demo.

## Agent-browser
`agent-browser` = dependensi/CLI baru → butuh persetujuan (§A.2/§C.8). Alternatif: Playwright (sudah di stack).
