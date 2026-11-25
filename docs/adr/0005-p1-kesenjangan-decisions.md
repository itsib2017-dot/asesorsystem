# ADR-0005: P1 Kesenjangan — Formulir, Wawancara, Antrean, PDF

- Status: **Accepted / Amended** (keputusan disetujui pada sesi 2026-11-22; diamendemen 2026-11-25 untuk usulan otomatis 04B & 06C)
- Date: 2026-11-20 (Amended: 2026-11-22, 2026-11-25)
- Authority: `ground_rules_v5.md` §C.10; brief developer gabungan 2026-11-19 + pembaruan 2026-11-22 + koreksi pemilik 2026-11-25

## Context

Empat cacat P1 terbuka di brief: (7) formulir hilang + Berita Acara + ekspor XLSX log audit, (8) prompt AI wawancara + 04B + FR.IA.07, (9) antrean pg-boss, (10) PDF AK.05 dari konversi DOCX terisi.

## Decision

1. **Ekspor XLSX log audit (Cacat 7, bagian teknis):** DILAKSANAKAN (`9cfbc05`). Route `GET /api/v1/audit/export` memakai `generateTabularXlsx`, dibatasi 2000 baris, RBAC `lsp_admin`, dan mencatat `audit.export.xlsx`. Tombol tersedia di halaman log audit.
2. **Formulir hilang (Cacat 7, opsi b — DITERIMA & DILAKSANAKAN):** MAPA.01, MAPA.02, FR.VA, FR.IA.07, FR.IA.08, FR.IA.10, FR.AK.03, FR.AK.04, FR.AK.06, FR.AK.07, dan Berita Acara didaftarkan sebagai entri opsional (`required: false`) pada registry `scheme_form_manifests` melalui migrasi forward-only `20261122000015_refine_ak3u_manifest_and_adr0005_forms.sql` agar dapat diunggah per skema tanpa memblokir batch existing.
3. **Wawancara, 04B & 06C (Cacat 8 — DITERIMA & DIAMENDEMEN 2026-11-25):** Fitur AI wawancara (FR.IA.09) dan analisis DIT tetap aktif dengan penyelarasan penuh pada prompt RCTFA Moza (`dit-gap-analysis.v1.ts` & `interview-rctfa.v1.ts` `v1.1.0`: adaptasi peran & wilayah non-metro/metro, berakar materi kandidat, 5 dimensi `TS/TMS/CMS/JRES/TrS`, aturan tunda, biner K/BK) serta scrubbing PII nama/NIK sebelum dikirim ke LLM. Sesuai **koreksi pemilik 2026-11-25** (mencabut catatan F4 bahwa auto-check 04B dimatikan), formulir mandiri **FR.IA.04B** dan **FR.IA.06C** **terisi otomatis dengan usulan AI** saat belum ada keputusan asesor tersimpan (`Terpenuhi`/`Benar` → `Ya`, `Belum Dibahas`/`Salah` → `Tidak`, `Sebagian` → `Belum` agar asesor menilai bukti parsial, serta usulan biner `K`/`BK`) lengkap dengan badge visual pembeda (*Usulan AI* vs *Dikoreksi/Ditetapkan Asesor*). Pratinjau blanko resmi dan ekspor `.docx` (`buildIa04bPayload`, `buildIa06cPayload`) tetap netral sampai asesor memeriksa/mengoreksi dan menekan **Simpan**; keputusan tersimpan tidak pernah tertimpa oleh eksekusi ulang AI. FR.IA.07 tetap opsional sebagai blanko.
4. **Antrean (Cacat 9 — DITERIMA UNTUK FASE 1):** Eksekusi inline dipertahankan dengan pemberitahuan kapasitas eksplisit (**optimal ≤ 50 berkas per pemindaian inline**, peringatan saat `files.length > 50`) di formulir pembuatan batch dan kartu status ingest detail batch, serta alur "Pindai Ulang Drive" bila job terhenti.
5. **PDF AK.05 (Cacat 10 — DITERIMA & DITINGKATKAN):** `generateAk05Pdf` tetap menjadikan templat DOCX terisi sebagai satu sumber layout dan ditingkatkan di `src/lib/ak05/docx-to-pdf.ts` agar merender struktur tabel OOXML berbatas (`<w:tbl>`, `gridSpan`, shading header), checkbox vektor (`☑`/`☐`, bebas artefak `?`), tanda tangan tanpa tumpang tindih, dan paginasi A4 otomatis multi-halaman.

## Alternatives considered

- pg-boss + job per berkas: sesuai FR-02/ADR-0004, tetap menjadi jalur eskalasi fase berikutnya bila volume batch melampaui batas pemindaian inline 50 berkas secara rutin.
- Pembuatan formulir sistem terpisah untuk seluruh 11 dokumen tambahan: bertentangan dengan pola registry blanko (D14) dan berisiko menunda operasionalisasi alur inti.

## Consequences

- Cacat 7b, 8, 9, dan 10 berstatus selesai/accepted pada migrasi `20261122000015` dan rilisan kode 2026-11-22.
- Batas operasional 50 berkas terlihat langsung di UI sehingga asesor dapat memecah folder besar bila diperlukan.
- Migrasi forward-only `20261122000014` & `20261122000015` diterapkan ke Supabase remote (`oiplhsmmfuqriaqrxjud`) tanpa menyentuh data batch pemilik.
