# Laporan Perbaikan Putaran 5 Audit & Penyelarasan Blanko Resmi FR.AK.05

- **Tanggal:** 2026-11-18 19:55 WIB
- **Aplikasi Live:** `https://assessor-zeta.vercel.app`
- **Repository:** `https://github.com/itsib2017-dot/asesorsystem`
- **Cakupan:** Resolusi menyeluruh seluruh temuan **Brief Putaran 5** (`Cacat 1 P0`, `Cacat 2 P0`, `Cacat 3 Tinggi`, dan `Checklist P1`), pembukaan hambatan build Vercel/CI (`cdfea9e`), serta penyelarasan persis tampilan & ekspor **FR.AK.05-2024** dengan dokumen blanko resmi (`Sewaktu`, `#92D050`, header logo, footer `#4472C4`/`#A8D08D`, format tanggal Indonesia).

---

## 1. Akar Penyebab Kegagalan Build Vercel (`844eb21`–`80a482b`)

Seluruh 8 commit perbaikan sebelumnya (`844eb21` sampai `80a482b`) gagal di tahap `Typecheck` GitHub Actions & Vercel build (sehingga situs live sebelumnya masih tertahan di commit `a0b9214`):
1. `src/components/dashboard/stats-card.tsx` masih mengimpor `framer-motion` yang sudah dihapus dari `package.json`.
2. `src/app/layout.tsx` menggunakan `LayoutProps<"/">` yang bergantung pada `.next/types/` sebelum `next typegen` / `next build` berjalan di environment CI/Vercel bersih.

**Perbaikan (`cdfea9e`):**
- Mengganti `motion.div` di `src/components/dashboard/stats-card.tsx` menjadi elemen `div` murni dengan kelas transisi Tailwind CSS.
- Mengganti signature prop `RootLayout` menjadi `{ children: React.ReactNode }`.
- Memulihkan ketat gerbang **Otoritas KTP (D6)** di `src/app/(app)/batches/[id]/ak05/page.tsx` dan `src/app/api/v1/batches/[id]/ak05/export/route.ts` sehingga semua asesi tanpa `certificateNameConfirmed` tetap mengunci ekspor sampai dikonfirmasi asesor.
- **Status Deploy:** Ketiga commit terbaru (`cdfea9e`, `1906f13`, `0047511`) lulus penuh CI GitHub Actions dan berstatus **Ready / Production** di Vercel. Baris `Error` lama di riwayat Vercel adalah snapshot build historis dari commit `844eb21`–`80a482b` dan aman untuk diabaikan.

---

## 2. Rincian Perbaikan Cacat & Checklist P1

### Cacat 1 (P0) — Observabilitas Job & API `/api/v1/jobs`
- `GET /api/v1/jobs?batchId=<id>` dan `GET /api/v1/batches/[id]` kini merespons JSON `200 OK` (bukan HTML 404).
- Halaman detail batch (`/batches/[id]`) secara permanen menampilkan kartu **Status Pemindaian Drive (Ingest Job)**, UUID penuh `ingestJobId`, status/progres/pesan error worker, ringkasan hasil pindai, tombol **Pindai Ulang Drive**, dan tautan langsung ke `/batches/[id]/ingest/[jobId]`.
- Rute ingest dengan `jobId` tidak dikenal menampilkan pesan spesifik **"Job tidak ditemukan"** (bukan 404 root generik).

### Cacat 2 (P0) & Penyamaan Blanko Resmi FR.AK.05
- **Penyelarasan persis dengan dokumen resmi (`FR.AK.05-2024`):**
  - **TUK:** Secara default memilih **`Sewaktu`** (bukan `Mandiri`), sel di formulir/ekspor hanya menampilkan `Sewaktu/Tempat Kerja/Mandiri*` dengan coretan pada opsi tidak dipilih, tanpa menyisipkan teks tambahan `(...)` di luar format blanko resmi.
  - **Tanggal & Judul Skema:** Menggunakan format tanggal Indonesia (`DD Bulan YYYY`, mis. `18 November 2026` melalui `src/lib/ak05/format.ts`) dan judul/nomor skema resmi (`AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM`, `SKM/2037/00013/2/2021/1`).
  - **Tata Letak PDF & Pratinjau WYSIWYG (`src/services/export.ts`, `src/components/ak05/ak05-preview.tsx`):**
    - Logo resmi BNSP & LSP K3 Nasional dari `word/media/image1.png` dan `image2.png` di bagian header Halaman 1 & Halaman 2.
    - Judul `FR.AK.05. LAPORAN ASESMEN` tanpa bingkai kotak tabel.
    - Header Tabel 2 (`No. | Nama Asesi | Rekomendasi (K / BK) | Keterangan**`) dan kolom kiri Tabel 3 menggunakan warna `#92D050` persis seperti dokumen asli.
    - `*Coret yang tidak perlu` ditempatkan tepat di bawah Tabel 1; `**Tuliskan Kode...` dan Tabel 3 ditempatkan pada Halaman 1 (ketika jumlah asesi `<= 12`).
    - Tabel 4 (`Catatan :` | `Asesor :` | `Nama` | `No. Reg` | `Tanda tangan & tanggal`) dengan tanda tangan tersemat di Halaman 2.
    - Footer garis biru `#4472C4`, judul skema kiri, `FR.AK.05-2024`, dan kotak nomor halaman hijau `#A8D08D`.
- **Gerbang D6 di Demo Audit R4:** Ekspor pada `Demo Audit R4` sengaja tetap terkunci karena ke-26 asesi masih `pending` (belum ada konfirmasi nama sertifikat berbasis KTP). Untuk membuka ekspor pada R4, asesor harus membuka tiap asesi &rarr; **Name Jury & Verifikasi KTP** &rarr; **Konfirmasi Nama Sertifikat**.
- **Verifikasi Ekspor Live pada Tenant Uji Terkonfirmasi (`LSP-VERIFY-E2E`):** Jalur unduhan `GET /api/v1/batches/60400be5-38b5-4d3e-b1f9-5ce12caca2ed/ak05/export?format=pdf` dan `?format=docx` berhasil diverifikasi live dengan tanda tangan tersemat dan struktur 5 tabel blanko.

### Cacat 3 (Tinggi) — Kelengkapan & Tautan Log Audit (`1906f13` & Migrasi `000007`)
- **Visibilitas Log Historis:** Menambahkan migrasi `supabase/migrations/20261118000007_audit_null_lsp_actor_scope.sql` sehingga Admin LSP juga dapat melihat entri historis `provider_settings.update` dan `signature.upload` (yang sebelumnya memiliki `lsp_id IS NULL`) secara ketat berdasarkan keanggotaan LSP aktor tersebut, tanpa melonggarkan sifat append-only tabel `audit_log`.
- **Kolom Aktor, Ringkasan & Tautan Batch:** `src/repositories/audit.repository.ts` dan `src/app/(app)/settings/audit/page.tsx` kini menampilkan nama aktor + potongan UUID, ringkasan `after_summary`, dan menjadikan `Resource ID` bertipe `batches` sebagai tautan klik langsung ke `/batches/<uuid>`.
- **Catatan Entri Historis R3/R4:** Entri backfill R3 & R4 tercatat pada `2026-11-18T08:55:17 UTC` (`15:55:17 WIB`) dengan `resource_id` batch R3 yang benar (`a3b77bbe-7543-48b7-99e1-25e286689999`), sedangkan pembuatan batch baru (`POST /api/v1/batches`) kini langsung menulis `batch.create` real-time pada detik pembuatan (terverifikasi pada batch uji `96e25281-36e1-44cf-a5f8-5dc28e715519` dengan timestamp `2026-11-18T12:25:44Z`).

### Checklist P1 (`0047511`)
1. **Klasifikasi Berkas (`src/services/drive.ts`):** Evaluasi berbasis batas kata ketat (`\bnik\b`, `\bktpp?\b`, `/Materi/` terlebih dahulu) mencegah nama folder induk `"Pelatihan"` atau kata `"Komunikasi"` salah mengklasifikasikan PDF Materi sebagai `ktp`, `09`, atau `sertifikat_pelatihan`. Di Batch R4 (`315` berkas), `146` berkas diperbarui sehingga ke-12 berkas di `Materi/` menjadi `materi_pelatihan`.
2. **Halaman Kemiripan (`similarity/page.tsx`, `/api/v1/batches/[id]/similarity/export`):** Menampilkan nilai ambang numerik dinamis (`Exact >= 0.90`, `Near >= 0.75`, `Parsial >= 0.50`), header skema resmi (bukan `tukName`), serta tombol **Ekspor Laporan Gabungan (.docx)** sesuai Rule D8 (menolak `format=pdf` dengan HTTP 422).
3. **Kesiapan Dashboard Aktual (`dashboard/page.tsx`, `batches.repository.ts`):** Menghitung kesiapan aktual berdasarkan status `drive_scan` = `done` dan keberadaan asesi/berkas (`1 siap · 1 belum siap` pada `LSP-K3-ID2`).
4. **Penemuan & Unggah Kunci 06B (`BatchKeyUploadPanel`, `src/lib/written/master-key.ts`, `provider-settings-form.tsx`):** Menambahkan panel unggah `FR.IA.06B` langsung di `/batches/[id]` serta kotak informasi & tautan jelas dari `/settings/provider` ke `/batches`.
