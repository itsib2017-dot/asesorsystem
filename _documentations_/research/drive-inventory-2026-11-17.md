# Drive + Sheet Inventory — 17 Nov 2026 (read-only, no sign-in, no downloads)

Source: browser inventory 22:48–22:51 WIB, 17 Nov 2026. No personal names, ID numbers, phones or addresses are recorded here — counts and anonymised naming patterns only. Subfolder counts below top level are sampled estimates, not enumerated totals; exact totals need a programmatic Drive API scan.

## 0. GitHub repo (checked separately)
- `danste-kun/asesorkompetensi` — created 2026-11-17T15:40:14Z, size 0, 0 files, 0 commits, description "List Asesor Kompetensi". EMPTY placeholder / greenfield destination, not source docs.

## 1. Spreadsheet — "6. 12 November 2026 - Informasi Kelengkapan Asesmen"
- URL: https://docs.google.com/spreadsheets/d/1AqNMp-YU4x1R9RHESo45WYGI-BZtYodUK-dPzvpPDbQ/edit?usp=sharing
- Access: anyone with link, view-only, no sign-in required. 2 tabs, no hidden tabs.
- Tab 1 "Persyaratan - AK3U" (gid 1739959540): 23 assessees, rows 4–26. Note rows 28–29: "Update Per 17 November 2026 13.35".
  - Headers rows 1–3 merged/grouped: NO | NAMA ASESI | CEKLIS UPDATE PERSYARATAN: APL 01, APL 02, KTP, IJAZAH, PAS FOTO, CV, SERTIFIKAT PELATIHAN | PORTOFOLIO: Sertifikat BNSP, Surat keterangan Kerja, Laporan Kerja, Uraian Jobdesc | KETERANGAN
  - Checkboxes: KTP, IJAZAH, PAS FOTO, SERTIFIKAT PELATIHAN mostly ticked; APL 01, APL 02, CV mostly unticked. Portfolio Sertifikat BNSP / Laporan Kerja / Uraian Jobdesc blacked out for most rows (not used); only Surat keterangan Kerja occasionally ticked.
  - KETERANGAN free text, mostly "Kurang APL 01 …, APL 02 dan CV" / "Kurang APL dan Dokumen Persyaratan Dasar"; at least one "BELUM MENGIRIM".
- Tab 2 "Kelompok Asesi" (gid 1374407666): assessor assignment / grouping.
  - Columns: NO., HARI, TANGGAL, PUKUL, ASESOR, SKEMA, ASESI. TUK PT. Global Competency Investama.
  - Exactly 2 groups, both Kamis 12 Nov 2026, 09.00 WIB, Skema Ahli K3 Umum, 2 assessors total (one Ketua Tim). Group 1: 11 assessees; Group 2: 12; total 23 — matches Tab 1.
  - Assessees are a single numbered list inside ONE ASESI cell per group (not one row per person) — must split on line breaks and strip numbers. Join tabs on normalised assessee name, not row order.

## 2. Drive — "Pelatihan Ahli K3 Umum Sertifkasi BNSP tahun 2026" [sic]
- URL: https://drive.google.com/drive/folders/1UrsbAjehLDuK3fHk2HItPgziWN8TOchy
- Folder IDs: Materi 1DQ5DihD33iSGnaln0w3pa6GBP8FYo7ei; Tugas DIT 1U-boLPbmw1FSrAFtNUmvAEHqWITEEfaW.
- Top level: 2 folders, 0 loose files. Depth 2 under Materi, 3 under Tugas DIT.
- Materi: 12 files, all modified Nov 9, no subfolders. 11 PDF + 1 PNG. 9 numbered training PDFs ("01 & 02. … Manajemen & Strategi Pengendalian Risiko K3.pdf" through "10. … Mengelola Sistem Dokumentasi K3.pdf"; topics: ERP, Komunikasi K3, Permit To Work, Pengukuran faktor bahaya, Pelayanan kesehatan kerja & P3K, Manajemen APD, Evaluasi Pemenuhan persyaratan dan Prosedur K3), 9.9–53.5 MB each, ~260 MB total; plus Silabus (122 KB), Tata Tertib (206 KB), Cover Materi.png (1.8 MB). Note: 01 and 02 combined in one file, no separate "02".
- Tugas DIT: 21 top-level items, Nov 11–12. 8 subfolders + 13 loose .pptx mixed at same level.
  - Loose .pptx 299 KB–18.8 MB, inconsistent naming: "DIT_[Name].pptx", "DIT [Name].pptx", "TUGAS PRESENTASI DIT [Name].pptx", "TUGAS DIT [Name].pptx", "TUGAS 1 [Name].pptx", "TUGAS [Name].pptx", one "-v2", one with employer name suffix.
  - Subfolders (8), mixed styles: "11. [NAME IN CAPS]", "DIT [Name]" (x3), "[Name]" (x2), "TUGAS DIT [NAME IN CAPS]", "tugas [lowercase name]".
  - Sampled subfolder (1 of 8): 6 files — 5 .docx forms ("1. Form IBPR-HIRADC AK3U.docx", "2. Form ERP.docx", "4. Form Inspeksi P3K.docx", "5. Form_Investigasi_Centrifuge.docx", "Form_Work_Permit_Puskesmas (1).docx", 26–39 KB) + 1 .pptx ("penugasan 1.pptx", 2 MB). Messiness: numbering jumps 1,2,4,5 (no 3), "(1)" duplicate marker, one lowercase filename.
  - Estimated total ~13 loose .pptx + ~6 files x 8 subfolders ≈ 60 files (estimate).

## 3. Drive — "Persyaratan Pelatihan AK3 umum BNSP"
- URL: https://drive.google.com/drive/folders/1e3XkvyAHZeQ3KdTs46IrqVTGrDeOLQHR
- Top level: 23 subfolders, 0 loose files — matching 23 assessees. Numbered "1. [Name]" to "21. [Name]" (some with degree/title suffixes S.K.M / S.Kep / Amd.Kep), plus 2 unnumbered all-caps folders at end. Most modified Nov 5; two Nov 9; three Nov 11. Depth 2 (root > participant folder > files).
- Sampled folders (2 of 23): folder "1." 7 files; folder "21." 8 files. Estimated total ~160–185 files (estimate).
- Doc types seen (patterns only): APL.01/APL.02 as .docx ("FR.APL.01. PERMOHONAN SERTIFIKASI KOMPETENSI … .docx", "FR.APL.02. ASESMEN MANDIRI-… .docx"; other folder "ApL01. …", "ApL.02. … (1).docx"); CV as .docx ("DAFTAR RIWAYAT HIDUP [name].docx") in one, .pdf ("CV [name].pdf") in the other; ijazah .pdf ("8. Ijazah S1.pdf", "ijazah [Name].pdf", up to 3.7 MB); KTP as image (".jpg.jpeg" double extension; generic "KTP Image" no extension); pas foto as image ("IMG-20261107-WA0005.jpg" WhatsApp-style; generic "Foto Image"); training certificate .pdf ("Sertifikat-[Name]-2.pdf"); employment letter .pdf ("Surat Keterangan Kerja - [Name].pdf"); "5. SK PNS.pdf" in first sample.
- No surat tugas, no FR forms other than APL.01/APL.02, no portfolio items (Laporan Kerja / Uraian Jobdesc) seen in the 2 sampled folders — sample finding only, not proof of absence in other 21 folders.
- Messiness: inconsistent APL naming/capitalisation; "(1)" and "-2" duplicate markers; double extension ".jpg.jpeg"; generic unlabelled images ("Foto Image", "KTP Image"); WhatsApp camera filename; numbered prefixes ("5.", "8.") implying a checklist numbering whose other numbers are absent. Completeness varies per folder (first sample had no Sertifikat Pelatihan / Surat Keterangan Kerja; second had both).

## 4. Programmatic-scan implications (for the docs)
- Sheet: Sheets API or per-sheet CSV export (`.../export?format=csv&gid=<gid>`, works viewer-only). Handle merged multi-row headers (rows 1–3), grouped columns, checkbox TRUE/FALSE in export, blacked-out portfolio cells, free-text KETERANGAN, and the single-cell newline list in Kelompok Asesi.
- Drive: Drive API `files.list`, `q="'<folderId>' in parents and trashed=false"`, fields id,name,mimeType,size,modifiedTime,parents, pageSize=100 + pageToken. Web UI lazy-loads — do not trust a single UI page. Plain API key suffices for link-shared public folders for metadata; do not assume download permission from listing permission — check per file. Recurse folder-by-folder (depth ≤3 here), record full path (filenames collide across participant folders). Deduplicate by file ID, not name.
- Normalisation before matching: case, spaces vs underscores vs hyphens, "APL" vs "ApL" vs "FR.APL.01", duplicate markers "(1)" / "-2" / "-v2", double extensions, generic names carrying no doc-type info, combined "01 & 02" material file. Classify by folder + filename keywords + mimeType + (only where needed) content sniffing — never extension alone.
- Privacy: material contains KTP, diploma, CV, employment docs. Scan should store metadata only (file ID, path, pattern, mimeType, size, modifiedTime, content hash for duplicates) and must not copy contents, names, ID numbers, phones or addresses into reports/logs.
