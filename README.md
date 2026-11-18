# AsesorKompetensi — Portal Asesmen Kompetensi Multi-LSP / BNSP

Platform web untuk mendampingi Asesor Kompetensi & Lembaga Sertifikasi Profesi (LSP) mengelola batch asesmen, klasifikasi berkas Google Drive, verifikasi nama sertifikat berbasis KTP, analisis ketimpangan DIT (FR.IA.04A / FR.IA.04B), penilaian esai FR.IA.06, deteksi kemiripan antar-asesi, serta ekspor laporan FR.AK.05.

## Arsitektur & Stack Utama

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript (`strict`, `noUncheckedIndexedAccess`) + Tailwind CSS v4
- **Database & Auth**: Supabase Auth (fail-closed `src/proxy.ts` + PKCE callback) + PostgreSQL + Drizzle ORM + Row-Level Security (RLS multi-tenant per LSP)
- **Keamanan & Enkripsi BYOK**: API Key AI & Google Drive dienkripsi per asesor menggunakan AES-256-GCM (`BYOK_ENCRYPTION_SECRET`), RBAC peran LSP (`lsp_admin`, `tuk_admin`, `assessor`), `audit_log` append-only, SSRF allow-list guard, dan sliding-window rate limiter
- **Konfigurasi Dinamis (D21)**: Jumlah soal, aturan keputusan (`VATM` biner `K`/`BK`), pemetaan sufiks formulir, dan ambang batas dibaca dari manifes skema / `app_config` (tidak dikunci permanen di kode)
- **Eksekusi Pekerjaan (Vercel Hobby Compatible)**: `enqueueJob()` menjalankan worker inline/on-demand melalui `runWorkerJob()` (`drive_scan`, `extract_file`, `ocr_ktp`, `dit_analysis`, `written_grading`, `similarity_run`, `ak05_export`) dan endpoint `POST /api/v1/jobs/[jobId]` tanpa membutuhkan Vercel Cron sub-harian
- **Ekspor Dokumen**: FR.AK.05 mendukung PDF & DOCX; dokumen instrumen lain DOCX; matriks data XLSX

## Struktur Direktori Utama

- `src/app/` — App Router (`(auth)` untuk login/daftar/lupa password/callback, `(app)` untuk dashboard, batch, triage, DIT, written, similarity, AK.05, pengaturan)
- `src/repositories/` — Lapisan akses data (Drizzle `withRlsTransaction` + fallback Supabase REST)
- `src/services/` — Logika domain murni (`drive`, `extract`, `name-jury`, `dit`, `grading`, `similarity`, `export`)
- `src/worker/` — Dispatcher & antrean eksekusi job (`runWorkerJob`, `enqueueJob`, `executeJob`)
- `src/ai/` — Adapter Vercel AI SDK (Anthropic, OpenAI-compatible, Gemini) & prompt berversi
- `supabase/migrations/` — Skema SQL & policy RLS multi-LSP
- `_documentations_/` & `docs/` — Dokumentasi teknis, SOP, & laporan verifikasi

## Pengembangan Lokal

1. Salin `.env.example` ke `.env.local` dan lengkapi variabel Supabase serta `BYOK_ENCRYPTION_SECRET` (minimal 32 karakter).
2. Pasang dependensi dan jalankan server pengembangan:

```bash
npm install
npm run dev
```

3. Jalankan pemeriksaan lengkap sebelum commit:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
