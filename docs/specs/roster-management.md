> **Verifikasi live 2026-11-20:** batch uji `2a3f5107-61fe-48ac-9281-b42ad3c051b0` — tambah asesi manual, impor Sheet, deteksi folder ber-akhiran status, dan audit `batch.roster.add` terverifikasi di Production. DIT 1 asesi masih BLOCKED sesuai larangan Bagian 5 brief (butuh kunci 06B kerja + persetujuan pengiriman data ke LLM).

# F2/F5 — Roster Management (Manual Asesmen Roster from UI)

**Feature:** Manajemen Roster Asesi dari UI (halaman Batch & Triage)
**Date:** 2026-11-19
**Authority:** `ground_rules_v5.md` (§A.4 F2/F5), `brief-developer-roster-asesi-2026-11-19.md`
**Status:** Draft

---

## 1. User & Problem

**User:** Asesor (pemilik batch) yang mengelola batch asesmen di AsesorKompetensi.

**Masalah:** Saat pemindaian Drive menghasilkan 0 asesi (karena folder bernama orang + akhiran status "Kurang Sertifikat Pelatihan" dibuang sebagai folder struktural), batch mati total. Tidak ada satu pun jalan di UI untuk menambah, mengubah, atau menghapus asesi secara manual. Kolom "Tautan Google Sheet Kelompok Asesi" (`kelompokSheetUrl`) disimpan di batch tapi **tidak pernah dibaca** saat pindai — impor roster dari Sheet tidak terpelakai.

**Dampak:** 25 berkas triase tidak bisa dipetakan ke asesi, semua lanjutan (Analisis DIT, pencocokan FR.AK.05, laporan FR.AK.05) disabled.

---

## 2. Scope

### In scope
- Menambah asesi manual dari UI batch/triage (nama asesi).
- Mengubah nama asesi yang salah terdeteksi (edit display name).
- Menghapus asesi yang salah (hanya yang belum terkonfirmasi nama sertifikat dan tidak memiliki berkas/keputusan).
- Mengimpor roster dari Google Sheet Kelompok Asesi (`kelompokSheetUrl`) atau unggah CSV.
- Dropdown "Asesi" di triage terisi dari roster batch ini.
- Setiap perubahan roster tercatat di log audit (`batch.roster.add`, `batch.roster.update`, `batch.roster.delete`, `batch.roster.import`).
- Perbaikan deteksi nama folder: bersihkan sufiks status ("Kurang ...", "Sertifikat ...") sebelum filter struktural; folder ditolak hanya bila SELURUH namanya struktural.
- Tampilkan alasan per berkas mengapa tidak ada kandidat nama terinferensi di triage.
- Diagnosa ekstraksi APL.01: catat apa yang ditemukan ekstraktor per berkas APL.01, tampilkan ringkasan di triage bila nama tidak ditemukan.
- Perbaikan observasi kecil: label hitungan (34 Drive + 1 unggahan), pesan matriks kelengkapan, nama skema/LSP di halaman batch.

### Out of scope
- Mengubah dokumen spesifikasi v1.4 (brief §"Yang TIDAK boleh dilakukan").
- Menggunakan folder Drive asli berisi data asesi untuk pengujian di luar yang diperlukan pemakai.
- Mengubah ambang similarity atau ambang name-jury (D19/OQ-08 masih terbuka).
- Menghapus data asesi atau berkas apa pun.
- Mengonfirmasi nama sertifikat asesi untuk membuka gate ekspor (pekerjaan asesor).
- Menulis ulang, menghapus, atau memalsukan entri log audit.

---

## 3. Acceptance Criteria (observable)

1. Dari UI, asesor bisa menambah **2 asesi manual** ke batch, lalu memetakan 25 berkas belum terpetakan ke asesi tersebut, dan menjalankan Analisis DIT untuk 1 asesi.
2. Pindai ulang folder dengan nama folder orang ber-akhiran status ("… Kurang Sertifikat Pelatihan …") mendeteksi asesinya **tanpa mengubah nama folder**.
3. Impor roster dari Sheet Kelompok Asesi mengisi roster batch.
4. Setiap berkas tanpa kandidat menampilkan alasannya di triage (mis. "folder induk mengandung kata struktural", "APL.01 terbaca tetapi nama tidak ditemukan").
5. Halaman batch menampilkan nama skema/LSP, label hitungan yang benar, dan pesan matriks yang menjelaskan keadaan sebenarnya (pindai selesai, 0 asesi terdeteksi).
6. Semua perubahan roster tercatat di audit log (`batch.roster.*`) dengan actor, action, resource, before/after, timestamp.
7. `npx tsc --noEmit` dan `npx eslint . --max-warnings 0` lolos; unit + E2E tests lolos.

---

## 4. Trust Boundary

| Who | Can touch | Data touched | Sensitivity |
|-----|-----------|--------------|-------------|
| Batch owner (assessor, creator via `batch_assessors`) | C/U/D assessees in own batch | `assessees.display_name`, `assessees.apl01_name`, audit log | PII (nama asesi) — internal, tidak KTP/NIK |
| `lsp_admin` / `tuk_admin` | C/U/D all assessees in LSP | same as above | PII |
| Other assessors (not in batch) | none | — | — |
| Unauthenticated | none | — | — |

**Authorization enforced at:** repository layer (authority), Server Action (early reject), UI (hide/disable only). Never UI-only.

---

## 5. Data Model

No new table required. Uses existing `public.assessees` (id, lsp_id, batch_id, display_name, pseudonym, version, certificate_name_confirmed, status, completeness_status, created_at, updated_at) and existing `public.audit_log` (append-only).

Optimistic locking: `assessees.version` integer; every update includes the version read at; stale version → conflict rejection.

Protection rules:
- Cannot delete an assessee with `certificate_name_confirmed` set.
- Cannot delete an assessee that has linked `drive_files`, `decisions`, `dit_analyses`, `written_gradings`, `interview_assessments`, or `assessee_decision_overrides`.
- Cannot change a confirmed certificate name via roster edit (that flows through name jury + assessor confirmation).

---

## 6. Error States

| Situation | User-safe message | Server log |
|-----------|-------------------|------------|
| Batch not found / no access | "Batch tidak ditemukan atau akses ditolak." | correlation ID, actor, batchId |
| Unauthorized role | "Akses ditolak: hanya Asesor/Admin LSP yang dapat mengelola roster." | correlation ID, actor, required role |
| Duplicate name | "Asesi dengan nama tersebut sudah ada di batch ini." | candidate name, existing assessee id |
| Delete protected assessee | "Asesi tidak dapat dihapus karena sudah memiliki berkas/keputusan atau nama sertifikat sudah dikonfirmasi." | assesseeId, protection reason |
| Sheet URL invalid / fetch fails | "Tidak dapat membaca Google Sheet. Periksa tautan dan izin berbagi ('Anyone with the link')." | URL, HTTP status, error |
| CSV parse yields no names | "Sheet tidak berisi daftar nama asesi yang valid." | parsed row count |
| Name inference fails per file | Alasan spesifik per berkas (lihat triage column "Alasan") | fileId, drivePath, reason |

---

## 7. Tickets (F5 — dependency order)

| ID | Ticket | Exit proof |
|----|--------|------------|
| R-01 | F2/F5 spec + F4/F9/F10/F11 doc updates | Files exist; reviewed |
| R-02 | Server actions: addAssessee, updateAssessee, deleteAssessee, importRosterFromSheet | Zod + RBAC + audit; unit tests PASS |
| R-03 | Fix `cleanCandidateLabel` + `isNonCandidateFolder` + `inferCandidateFromDrivePath` for status-suffix folders | Unit tests: status-suffix folder yields candidate name; PASS |
| R-04 | APL.01 extraction diagnosis + expanded patterns + per-file "why no candidate" reason | Unit tests: APL.01 name extracted or reason logged; PASS |
| R-05 | Connect `kelompokSheetUrl` to scan (CSV fetch + parse + upsert + audit) | Unit + integration test; PASS |
| R-06 | UI: batch page scheme/LSP name, count label, matrix message | E2E + visual; PASS |
| R-07 | UI: triage page "Tambah Asesi", edit/delete, "why no candidate" column, import button | E2E: add 2 assessees + map 25 files + run DIT; PASS |
| R-08 | Gates: tsc, eslint, unit, RLS, E2E; feature-test-report.md | All PASS; report written |
| R-09 | Reflector + Security pass (AUDIT MODE); no unresolved P0/P1 | Sign-off |

---

## 8. Test Data

- Batch `c61cf7c5-dd98-418b-85b7-9690caf1bdb2` (Batch 19 November 2026, TUK Mairodi Mandiri Sejahtera, AK3U v1) — owner account, not demo tenant.
- Drive folder: "17. 19 November 2026" — 34 berkas, 2 subfolder bernama orang + akhiran "Kurang Sertifikat Pelatihan", 2 APL.01, 0 Surat Tugas.
- Test must use a **copy/demo folder**, not the original owner folder with real asesi PII (per brief constraint).
- 2 new assessee names added manually via UI for mapping 25 unmapped files.
