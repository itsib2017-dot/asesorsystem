# ADR-0005: P1 Kesenjangan — Formulir, Wawancara, Antrean, PDF

- Status: **Proposed** (butuh konfirmasi pemilik untuk keputusan produk)
- Date: 2026-11-20
- Authority: `ground_rules_v5.md` §C.10; brief developer gabungan 2026-11-19 Bagian 4 P1

## Context

Empat cacat P1 masih terbuka di brief: (7) formulir hilang + Berita Acara + ekspor XLSX log audit, (8) prompt AI wawancara + 04B + FR.IA.07, (9) antrean pg-boss, (10) PDF AK.05 dari konversi DOCX terisi. Beberapa di antaranya adalah keputusan produk, bukan murni teknis; tidak boleh diasumsikan diam-diam (Non-Negotiable #2).

## Decision

1. **Ekspor XLSX log audit (Cacat 7, bagian teknis):** DILAKSANAKAN. Route `GET /api/v1/audit/export` memakai `generateTabularXlsx`, dibatasi 2000 baris, RBAC `lsp_admin`, dan mencatat `audit.export.xlsx`. Tombol tersedia di halaman log audit.
2. **Formulir hilang (Cacat 7, bagian produk):** **DIUSULKAN (b)** — MAPA.01/02, FR.VA, FR.IA.07/08/10 direkam sebagai blanko/file lampiran pada registry formulir per skema, bukan formulir sistem terpisah di v1. AK.01/03/04/06/07 dan Berita Acara diusulkan tetap sebagai entri registry + blanko upload, dengan draf Berita Acara dan tahap handoff menyusul setelah konfirmasi pemilik. Status: **belum final**.
3. **Wawancara (Cacat 8):** DILAKSANAKAN. Prompt RCTFA pemilik diadaptasi menjadi `src/ai/prompts/interview-rctfa.v1.ts` yang **scheme-agnostic & tenant-agnostic**: nama LSP, kode/nama skema, unit kompetensi, jumlah pertanyaan, dan rujukan hukum semuanya diambil dari manifes skema aktif + konteks tenant saat runtime. Tidak ada hardcode AK3U/K3. Tombol "Hasilkan Pertanyaan (AI)" di halaman FR.IA.09 mengisi daftar pertanyaan; audit `interview.ia09.generate`. 04B tetap preview+ekspor; FR.IA.07 direkam sebagai blanko.
4. **Antrean (Cacat 9):** **DIUSULKAN menerima eksekusi inline** untuk skala batch demo, dengan batas eksplisit: maksimal ~50 berkas per batch, satu job `drive_scan` per batch, dan bila job gagal di tengah jalan pengguna harus menjalankan "Pindai Ulang Drive" (tidak ada retry otomatis / dead-letter). pg-boss tidak ditambahkan di Phase 1. Status: **belum final**.
5. **PDF AK.05 (Cacat 10):** DILAKSANAKAN. `generateAk05Pdf` kini membuat DOCX terisi lewat `generateAk05Docx`, lalu mengonversinya ke PDF (`src/lib/ak05/docx-to-pdf.ts`). Satu sumber layout: templat DOCX skema aktif. Tanda tangan dari `word/media/signature.png` ikut disematkan. Implementasi konverter sengaja minimal (paragraf + tabel + image), bukan render presisi pixel-perfect Word.

## Alternatives considered

- pg-boss + job per berkas: sesuai FR-02/ADR-0004, tetapi menambah infrastruktur dan tidak ada trigger terukur pada skala demo saat ini (§C.5/§F11).
- Prompt AI wawancara: membutuhkan prompt sistem resmi pemilik; membuat prompt sendiri berisiko mengubah methodology asesmen.
- Formulir sistem penuh untuk semua form: biaya besar dan bertentangan dengan pola "direkam saja" yang sudah dipakai untuk MAPA.01/02 (D14).

## Consequences

- Ekspor XLSX langsung tersedia dan diverifikasi secara live.
- Kebutuhan konfirmasi pemilin menjadi blocker untuk penyelesaian Cacat 7–10 secara penuh; tidak ada asumsi diam-diam.
- Jika antrean inline diterima, batas 50 berkas harus ditampilkan di UI atau dokumentasi operasional (tindak lanjut).
