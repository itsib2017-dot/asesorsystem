# Perbaikan Regresi Parser Surat Tugas & Konfirmasi F4 — Putaran 22 (2026-11-22)

- **Tanggal:** 2026-11-22 21:00 +07:00
- **Pemicu:** Brief Developer Putaran 22 (hal. 1) — uji A/B pada PDF Surat Tugas asli (`3801/ST/LSP-K3N/XI/2026`) menunjukkan regresi penuh pada HEAD `7b0fdd1` (tanggal `null`, nomor surat `null`, TUK `"TUK"`, asesor `null`, peserta terdeteksi `9`).

## 1. Root Cause Terkonfirmasi (Dari PDF Asli)

1. **Ekstraktor PDF Multi-`BT...ET` (`src/services/extract.ts`):**
   - `extractStreamTextWithLayout` sebelumnya me-flush baris baru di setiap operator `ET`. Pada PDF ekspor Word, hampir setiap kata/token dibungkus blok `BT...ET` terpisah (mis. `3` + `801`, `S` + `uhartono`, header/footer muncul lebih dulu di stream daripada judul), sehingga teks terpecah menjadi ~190 baris acak (`Nomor:\n3\n801...`) dan stream binary TrueType font berpotensi terbaca.
   - Diperbaiki dengan:
     - `isLikelyTextContentStream`: menyaring stream binary (`> 2` null byte) dan memastikan stream mengandung operator `Tj`/`TJ`.
     - Tracking koordinat `x`, `y`, `fontSize`, matriks `Tm`/`Td`/`TD`/`T*`, estimasi lebar proporsional (`PDF_CHAR_WIDTH_FACTORS`), lalu pengelompokan baris visual (`|row.y - sp.y| <= max(3.5, 0.35 * fontSize)`), urutan atas-ke-bawah (`y` menurun) dan kiri-ke-kanan (`x` menaik) dengan ambang spasi horizontal `0.14 * fontSize`.

2. **Pemotongan Salah & Pola Parser (`src/services/surat-tugas.ts`, `src/services/drive.ts`):**
   - `PARTICIPANT_HEADER_RE` sebelumnya cocok pada header kolom tabel asesor di Halaman 1 (`Nama Asesi`, indeks 480) dan membuang seluruh teks sesudahnya dari pencarian tanggal/TUK/nomor/asesor, sekaligus menyedot baris tabel asesor & poin kewajiban `1. Menjadi...`–`4. Melaporkan...` sebagai peserta (9 kandidat palsu).
   - Diperbaiki dengan `findParticipantSectionIndex` (memilih kemunculan terakhir `DAFTAR PESERTA` / `PESERTA UJI KOMPETENSI` non-`Lampiran:`, tidak membatasi pencarian tanggal/nomor/TUK pada potongan sebelum peserta), `preprocessSuratTugasText` (menggabungkan token terpecah `P\nukul` -> `Pukul`, `S\nuhartono` -> `Suhartono`, plus normalisasi baris datar `flatText` untuk fallback), pengetatan `cleanTukName` (berhenti di `Nama Ruang :`, menolak `"TUK"` kosong), jangkar `MET.`/`No. Reg.` pada `extractAssessorName` (aman pada format multiline maupun baris datar), dan `extractParticipantsFromSuratTugas` dengan pelacakan nomor urut berurutan (`1 Aryanto -`, `2 Suhartono -`) serta penyaringan kata kerja tugas/footer.

3. **Pengaman Impor Roster UI (`src/app/(app)/batches/[id]/_components/batch-metadata-surat-tugas-panel.tsx`):**
   - `importCandidates` kini default `false` (opt-in eksplisit oleh asesor) dan di-reset ke `false` saat mengganti berkas atau selesai unggah, dengan label konfirmasi manual.

## 2. Verifikasi A/B Pada Dokumen Nyata

Diujikan langsung terhadap PDF Surat Tugas asli via `extractTextFromBuffer` → `parseSuratTugasText` (beserta fixture regresi bentuk terfragmentasi 1.623 karakter dan baris datar 1.623 karakter di `src/services/__tests__/surat-tugas.test.ts`):

| Field | Sebelum (`7b0fdd1`) | Sesudah (Perbaikan) | Status |
|---|---|---|---|
| Tanggal asesmen | `null` | `2026-11-19` | ✅ |
| Nomor surat | `null` | `3801/ST/LSP-K3N/XI/2026` | ✅ |
| Nama TUK | `"TUK"` | `TUK Sewaktu LSP K3 Nasional - PT Mairodi Mandiri Sejahtera` | ✅ |
| Nama asesor | `null` | `Daniel Stefanus` | ✅ |
| Peserta terdeteksi | `9` | `["Aryanto", "Suhartono"]` (tepat `2`) | ✅ |

## 3. Konfirmasi F4 (FR.IA.04B)

- Reset tampilan awal penilaian `FR.IA.04B` ke `Ya: 0 / Tidak: 0 / Belum: 13` adalah **disengaja** sejak commit `2e0659c`.
- Pada `src/lib/forms/assessee-forms.ts` (`buildIa04bPayload`), pencentangan otomatis dari AI `coverageMatrix` / `readiness` dinonaktifkan agar penilaian aspek resmi `FR.IA.04B` murni berasal dari keputusan asesor (`official_04b.items`). Bila baris `dit_analyses` lama belum menyimpan `official_04b.items`, form mandiri `Ia04bAssessmentForm` memang memulai semua aspek pada status `"Belum"` sampai asesor menilai & menyimpan. Re-run analisis AI (`src/worker/index.ts`) mempertahankan `prevOfficial04b` yang sudah disimpan asesor.
