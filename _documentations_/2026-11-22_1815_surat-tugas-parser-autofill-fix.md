# Perbaikan Parser Surat Tugas & Auto-Apply Metadata (2026-11-22)

- **Tanggal:** 2026-11-22 18:15 +07:00
- **Pemicu:** Catatan pengujian panel Metadata Batch & Surat Tugas (nama asesor tidak terekstrak, nomor surat berspasi berlebih, TUK menyertakan ruang/lantai, output parser tidak langsung mengisi form/metadata, serta deteksi jumlah peserta & diff roster).

## Root Causes & Perbaikan

1. **Ekstraksi Teks PDF Acak / Kehilangan Baris (`src/services/extract.ts`):**
   - `extractTextFromPdfBasic` sebelumnya menjalankan regex `Tj` dan `TJ` terpisah secara global dan menggabungkan semuanya dengan spasi tunggal, mengacaukan urutan baca dan menghilangkan pemisah baris daftar peserta/label.
   - Diperbaiki dengan pemindai operator berurutan (`BT`/`ET`, `Td`/`TD`, `T*`, `Tm`, `Tj`, `TJ`) yang menjaga pemisah baris dan jarak spasi kerning.

2. **Parser Surat Tugas (`src/services/surat-tugas.ts`, `src/services/drive.ts`):**
   - **Asesor:** Ditambah pola blok penugasan (`Menugaskan kepada` -> `Nama`), label multi-baris, jangkar `MET` / `No. Reg`, serta isolasi area sebelum `DAFTAR PESERTA` agar nama peserta tidak tertangkap sebagai asesor.
   - **Nomor Surat:** `normalizeLetterNumber` merapatkan spasi berlebih sekitar `/`, `-`, `.`, angka terpisah, dan huruf kode kapital (mis. `045 / ST - X I / 20 26` -> `045/ST-XI/2026`).
   - **Nama TUK:** `cleanTukName` memangkas label lanjutan dan informasi ruang/lantai (tanda kurung maupun koma/dash seperti `(Ruang Meeting B)` / `, Ruang Aula Lantai 3`).
   - **Tanggal & Rentang:** Mendukung rentang tanggal Indonesia (`18 - 19 November 2026`, `5 s.d. 6 Desember 2026`).
   - **Peserta & Diff Roster:** `extractParticipantsFromSuratTugas` + `drive.ts` mendukung daftar peserta sebaris (`1. A 2. B`), baris bernomor terpisah (`1.\nNama`), serta tabel berkolom. Ditambah helper `diffSuratTugasCandidates` untuk memisahkan peserta sudah ada vs peserta baru.

3. **Auto-Apply Metadata & Pratinjau UI (`drive-extract.ts`, `batches/[id]/actions.ts`, `batch-metadata-surat-tugas-panel.tsx`):**
   - `enrichFilesByContent` kini mengekstrak `surat_tugas` meskipun confidence nama file sudah `>= 0.85` sehingga pemindaian Drive mengisi tanggal/TUK kosong secara otomatis.
   - `parseSuratTugasPreviewAction` mengembalikan `rosterSummary` (`detected`, `alreadyInRoster`, `toAdd`).
   - `uploadBatchSuratTugasAction` menerapkan tanggal & TUK ke `updateBatchMetadata` saat opsi diterapkan dicentang tanpa membutuhkan sunting manual ulang, serta mengembalikan `appliedMetadata` dan `rosterSummary`.
   - `BatchMetadataSuratTugasPanel` menyinkronkan state dari props `batch` via `useEffect`, langsung mengisi input tanggal/TUK pada form saat pratinjau/simpan berhasil, menampilkan breakdown peserta yang sudah ada vs baru, dan menyediakan tombol simpan utama di panel pratinjau.
