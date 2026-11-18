# Brief Putaran 4 Remediation Report (Checkpoints 6–8)

- **Tanggal:** 2026-11-18 16:50 WIB
- **Repo:** `https://github.com/itsib2017-dot/asesorsystem`
- **Target Aplikasi:** `https://assessor-zeta.vercel.app`
- **Cakupan:** Penyelesaian menyeluruh **Cacat 1 (P0)**, **Cacat 2 (P0)**, dan **Checklist P1** dari *Brief untuk Developer — Temuan Putaran 4 Audit AsesorKompetensi*, beserta pembaruan Graphify.

---

## Ringkasan Eksekusi

| Checkpoint | Cakupan | Status | Commit |
| :--- | :--- | :--- | :--- |
| **Checkpoint 6** | **Cacat 1 (P0):** Toleransi subfolder 404 di crawler Drive, `audit_log` event job (`executeJob` & `rescan`), metadata job di `GET /api/v1/batches`, rute baru `GET /api/v1/batches/[id]` & `GET /api/v1/jobs`, `revalidatePath` di `POST /api/v1/batches`, kartu ringkasan pindai permanen (termasuk kasus 0 berkas), dan pesan khusus `"Job tidak ditemukan"` di halaman ingest | Selesai & Pushed | `e7b1edd` |
| **Checkpoint 7** | **Cacat 2 (P0):** Blanko resmi AK3U `FR.AK.05. LAPORAN ASESMEN.docx` di-bundle di `src/templates/ak3u/` + `next.config.ts` (`outputFileTracingIncludes`), template-fill OOXML bedah-XML via `JSZip` menjaga 5 tabel/header/footer/style asli + sisip gambar tanda tangan `rIdSig1`, dan PDF renderer 2 halaman A4 5-tabel identik blanko (dengan logo header BNSP, coretan TUK, checkbox vektor, shading hijau `#92D050`, dan tanda tangan PNG/JPG) | Selesai & Pushed | `ea637a4` |
| **Checkpoint 8** | **Checklist P1 & Graphify:** Feedback uji koneksi inline langsung di bawah tombol `"Test connection"`, form unggah berkas kunci `06B` (.docx/.txt) & koreksi tertulis di `/written`, indikator kesiapan aktual batch pada Dashboard, pembaruan Graphify + ekspor Obsidian, dokumentasi ini, serta build/test penuh | Selesai | Langkah saat ini |

---

## Rincian Teknis Perubahan

### 1. Cacat 1 (P0) — Observabilitas Job Pindai Drive & Audit Trail
1. **Resiliensi Crawler (`src/services/drive.ts`):** Subfolder bersarang (`depth > 0`) yang mengembalikan HTTP error (mis. shortcut rusak/404) dilewati dengan log peringatan tanpa menggagalkan keseluruhan pemindaian batch.
2. **Audit Log Event Job (`src/worker/queue.ts`, `src/app/(app)/batches/[id]/page.tsx`):** `executeJob` menulis `job.<type>.completed` / `job.<type>.failed` ke `audit_log` dengan `actor_id` dan metadata hasil/error; `rescanBatchDriveAction` menulis `job.drive_scan.rescan`.
3. **API Batch & Jobs:**
   - `GET /api/v1/batches` menyertakan `ingestJobId`, `ingestStatus`, dan `latestJob` pada tiap record.
   - `POST /api/v1/batches` melakukan `revalidatePath("/batches")` dan `revalidatePath("/dashboard")`.
   - `GET /api/v1/batches/[id]` mengembalikan detail batch, `latestJob`, `assesseeCount`, dan `fileCount`.
   - `GET /api/v1/jobs` mendukung daftar job per user dan filter `?batchId=...`.
4. **UI Observabilitas & 404 Spesifik (`src/app/(app)/batches/[id]/page.tsx`, `ingest/[jobId]/page.tsx`):**
   - Halaman detail batch selalu menampilkan kartu **Status Pemindaian Drive (Ingest Job)** berisi UUID job penuh, status & progres `%`, ringkasan (`N asesi terdeteksi · M berkas terpindai · K perlu triase`, termasuk jika 0 berkas), pesan error jika gagal, tombol **Pindai Ulang Drive**, dan tautan **Lihat Detail Job Ingest & Log**.
   - Halaman ingest menampilkan **Job tidak ditemukan** (bukan `not-found.tsx` generik) jika batch valid namun `jobId` tidak ada atau tidak cocok dengan batch.

### 2. Cacat 2 (P0) — Template-Fill Blanko Resmi `FR.AK.05` & PDF 2-Halaman A4
1. **Aset Blanko Resmi (`src/templates/ak3u/FR.AK.05.LAPORAN_ASESMEN.docx`):** Diunduh utuh dari folder Google Drive SKEMA AK3U (`609.114` byte) dan diikutsertakan di Vercel bundle lewat `outputFileTracingIncludes` pada `next.config.ts`.
2. **DOCX Template-Fill (`src/services/export.ts` — `generateAk05Docx`):**
   - Memuat blanko resmi lewat `JSZip` tanpa mengubah struktur 5 `<w:tbl>`, `header1.xml`, `footer1.xml`, `footnotes.xml`, atau `styles.xml`.
   - Menjaga judul + nomor skema resmi (`SKM/2037/00013/2/2021/1`), menerapkan `<w:strike/>` pada tipe TUK yang tidak dipilih + menambahkan nama TUK, mengisi tabel 12 asesi (atau mengkloning baris #12 bila >12 asesi), mengisi tabel catatan (Tabel 3), serta menyisipkan `word/media/signature.{png|jpg}` dan relasi `rIdSig1` ke sel tanda tangan pada Tabel 4.
3. **PDF Layout 2-Halaman A4 5-Tabel (`generateAk05Pdf`):**
   - Merender 2 halaman A4 (`pdf-lib`) dengan gambar header resmi (`word/media/image1.png` & `image2.png`), Tabel 0–4 berbingkai, garis coretan TUK, checkbox vektor K/BK (aman dari error encoding WinAnsi), footnote resmi, shading `#92D050` di Tabel 3, serta gambar tanda tangan PNG/JPG tersemat di Tabel 4.

### 3. Checklist P1
1. **Feedback Inline Tombol "Test connection" (`provider-settings-form.tsx`):** Status `"Menguji..."`, sukses, atau error ditampilkan langsung di bawah tombol aksi selain di bagian atas form.
2. **Unggah & Input Kunci 06B (`written/actions.ts`, `written/_components/written-key-form.tsx`, `written/page.tsx`):** Asesor dapat mengunggah file `FR.IA.06B.docx` / `.txt` (tersimpan pada slot `06b` batch) atau mengisi teks kunci `06B` & jawaban `06C` dan langsung menjalankan `written_grading`.
3. **Status Kesiapan Dashboard Aktual (`dashboard/page.tsx`):** Kartu **Batch Aktif** menghitung batch yang benar-benar sudah selesai dipindai (`drive_scan` berstatus `done`) dan menampilkan badge `Pindai selesai` / `Pindai gagal` / `Menunggu pindai` pada setiap kartu batch.
