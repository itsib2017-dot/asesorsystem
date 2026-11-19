# Rencana Remediasi Putaran 14 — 2026-11-19 19:28 WIB

Status: **COMPLETED (T0–T7 VERIFIED)**
Basis: HEAD `e7fa16c` · `ground_rules_v5.md` (AUDIT MODE: skema/migrasi DB, RLS storage bucket, unggah berkas `.docx`, dan isolasi manifes lintas-skema/lintas-tenant).
Sumber: Brief untuk Developer — Registry Blanko & Manifes Formulir per Skema (Multi-Skema Nyata) + persetujuan pemilik atas pertanyaan klarifikasi (Playwright, Option A dinamis tanpa hardcoding, dan contoh skema `ICT-PM` tersimpan di demo tenant).

## OODA

### Observe
1. `src/app/(app)/settings/schemes/_components/scheme-registration-form.tsx` hanya menangkap metadata skema; tidak ada editor daftar formulir, unggah blanko `.docx`, atau editor isi pertanyaan (04B, 06A, 09) maupun mode edit skema yang sudah ada.
2. `src/app/(app)/settings/schemes/actions.ts:125-130` menanamkan 5 formulir tetap (`04a, 04b, 06a, 06b, 06c`) ke semua skema dan `actions.ts:116` menyuntikkan konstanta `IA04B_KELOMPOK_PEKERJAAN`.
3. `src/lib/forms/assessee-forms.ts` & `src/components/forms/blanko-chrome.tsx` masih memakai fallback konstanta AK3U (`AK3U_OFFICIAL_UNITS`, `IA04B_KELOMPOK_PEKERJAAN`, logo `/templates/ak3u/*.png`) pada skema non-AK3U.
4. `src/services/export.ts` memanggil `src/templates/ak3u/*.docx` secara literal, mengunci 13 baris tabel AK.02 dan 13 tabel IA.04B, serta tidak mengambil blanko `.docx` dari registry skema.
5. `scheme_form_manifests` tidak memiliki kolom metadata/versi template blanko `.docx`, belum ada bucket storage `scheme-blankos`, dan `src/worker/index.ts` (`drive_scan`) tidak meneruskan `filePatterns` dari manifes skema batch ke `classifyDriveFileName` / `classifyDocumentTextContent`.

### Orient
- **Trust boundaries:**
  - `saveSchemeManifestAction` & `uploadSchemeFormBlankoAction`: autentikasi sesi (`getUser`), otorisasi peran (`resolveAuthorizedLsp(..., ["lsp_admin"])`), validasi Zod, validasi biner `.docx` (magic bytes `PK\x03\x04`, ukuran <= 10 MB, verifikasi isi ZIP berisi `word/document.xml`), hashing SHA-256, dan log audit `scheme.manifest.upsert` / `scheme.blanko.upload`.
  - Storage bucket `scheme-blankos` (`public = false`): RLS pada `storage.objects` membatasi akses baca untuk anggota LSP (`private.auth_is_member`) dan tulis/hapus hanya untuk `lsp_admin` pada prefiks `{lsp_id}/...`.
  - `resolveSchemeTemplateBuffer`: membaca template hanya dari path storage milik skema batch tersebut (atau `builtin://ak3u/` untuk entri seed AK3U), mencegah path traversal atau akses lintas-LSP.
- **Definition of Ready & Done:**
  - DoR terpenuhi setelah konfirmasi pemilik: Playwright untuk UI/UX E2E, Option A template-fill dinamis tanpa hardcoding, dan skema contoh `ICT-PM` ditinggalkan aktif di demo tenant.
  - DoD: `npx tsc --noEmit`, `npx eslint . --ext .ts,.tsx --max-warnings 0`, `npm test`, RLS check, Playwright E2E pass, laporan di `_documentations_/` & `docs/testing/feature-test-report.md`, plus checkpoint `_backups_/`.

### Decide — Tiket Berurutan (Satu Modul Fokus per Tiket)

| # | Tiket | Mode | Berkas Utama | Kriteria Lolos |
|---|---|---|---|---|
| T0 | Dokumentasi rencana & spesifikasi F2/F5 | AUDIT | `_documentations_/2026-11-19_1928_plan-putaran-14-registry-blanko.md`, `docs/specs/round14-scheme-blanko-registry.md` | Rencana & kontrak spec tertulis lengkap |
| T1 | Migrasi DB, bucket `scheme-blankos`, Drizzle schema, & CRUD repository | AUDIT | `supabase/migrations/20261119000013_scheme_blanko_registry.sql`, `src/db/schema.ts`, `src/repositories/schemes.repository.ts` | Kolom versi blanko tersedia, bucket RLS aktif, 6 template AK3U ter-seed, CRUD & `attachSchemeFormBlankoTemplate` preserving existing template metadata |
| T2 | Isolasi AK3U & dukungan pertanyaan/branding per skema di form helpers & UI | AUDIT | `src/lib/forms/assessee-forms.ts`, `src/components/forms/blanko-chrome.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/interview/page.tsx` | Non-AK3U tidak pernah fallback ke unit/soal/logo AK3U; AK3U tetap identik |
| T3 | Editor registry formulir, unggah blanko `.docx` berversi, & editor isi soal di Settings → Skema | AUDIT | `src/app/(app)/settings/schemes/actions.ts`, `src/app/(app)/settings/schemes/_components/scheme-registration-form.tsx`, `src/app/(app)/settings/schemes/page.tsx` | Hapus hardcode 5 form & KP AK3U; UI mendukung buat baru/salin/edit skema, kelola formulir, unggah `.docx`, isi soal 04B/06A/09, & branding |
| T4 | Klasifikasi `drive_scan` & enrichment berbasis manifes `filePatterns` per skema | AUDIT | `src/services/drive.ts`, `src/services/drive-extract.ts`, `src/worker/index.ts` | Batch memakai `filePatterns` skema batch; pola AK3U tetap lolos |
| T5 | Ekspor dinamis DOCX/PDF memakai template blanko dari registry skema | AUDIT | `src/services/export.ts`, `src/app/api/v1/batches/[id]/ak05/export/route.ts`, `src/app/api/v1/batches/[id]/assessees/[assesseeId]/export/route.ts`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/page.tsx` | Ekspor memuat buffer blanko dari registry skema (storage/seed), mengisi baris unit/soal secara dinamis untuk skema kustom, AK3U tidak regresi |
| T6 | Tes unit/integrasi, seed `ICT-PM` demo tenant, & E2E Playwright | AUDIT | `src/repositories/__tests__/schemes.repository.test.ts`, `src/services/__tests__/drive.test.ts`, `src/services/__tests__/official-forms-export.test.ts`, `src/lib/forms/__tests__/scheme-manifest-portability.test.ts`, `e2e/scheme-blanko-registry.spec.ts` | Semua skenario unit & Playwright E2E PASS; `ICT-PM` lengkap di demo tenant |
| T7 | Gate nyata (`tsc`, `eslint`, `vitest`, `playwright`, RLS), update docs, `graphify`, & backup | AUDIT | `docs/`, `_documentations_/`, `graphify-out/`, `_backups_/` | Output nyata tercatat tanpa klaim kosong |

### Larangan yang Dipatuhi
- Tidak mengubah dokumen spesifikasi v1.4 asli, tidak memakai folder Drive data asesi asli, tidak membocorkan kredensial/password, tidak mengubah ambang similarity/name-jury, tidak menghapus data asesi atau mengonfirmasi nama sertifikat asesi, dan tidak memodifikasi/menghapus entri `audit_log`.
