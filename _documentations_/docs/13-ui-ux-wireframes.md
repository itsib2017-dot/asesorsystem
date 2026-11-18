# 13 — UI/UX Wireframes

**Project:** AsesorKompetensi — LSP/BNSP assessor web app (OHSE-first, general certification)
**Version:** v1.4 — 18 November 2026 · **Status:** Draft for review
**Changelog v1.4:** Dashboard restyled to the Dashboard V18 language from the screenshot (D20 — glass-card, StatsCard, dark sidebar, right-hand decisions panel, §3); new frames: Buat Batch short intake (§14, D13), Provider Settings (§15, D18), Scheme Registration — manifest editor (§16, D17); DIT gains the official 04B form section (§7, D14); grading shows the AI VATM recommendation + assessor confirm/override (§8, D16); similarity shows the numeric flag + evidence details (§9, D19); no hard-coded model names in frames (§6, §7 — model comes from Provider Settings). **Changelog v1.3:** KTP card marked as the authority source in Candidate Detail (§6); grading gains the Ringkasan Kesalahan section and no overall % as a pass/fail (§8); plagiarism analysis is a separate qualitative view (§9); §13 signature frame corrected to the v1.2 14-form list (was wrongly listing MAPA.01/02, missing APL.01/APL.02). **Changelog v1.2:** Candidate Detail gains the name-jury review section (§6); new screen 13 — Pengaturan → Profil & Tanda Tangan (§13); AK.05 sign-off modal shows the signature preview + missing-signature blocker (§10); export buttons per screen follow the export rule (§8, §9, §10); screen inventory now 13 screens (see Screen inventory section).
**Changelog v1.1:** new screen 12 — Triage (§12); DIT analysis gains the candidate profile summary block + completeness-gate state (§7); grading gains the model-answer box + encrypted-06B locked state (§8); Similarity Report gains the matrix view (§9); AK.05 rewritten to the real blank-form layout (12 rows, BK footnote, three notes sections, signature block) with true preview + sign-off (§10); screen inventory updated to 12 screens.
**Companion docs:** UI/UX Specification (08), PRD (02). **No Figma file** — each frame below is specified precisely enough to build from (layout, content, states, actions).
**Language:** UI in Bahasa Indonesia. Form codes preserved exactly (`FR.APL.01`, `FR.IA.04A`, `FR.AK.05`). DIT = Daftar Instruksi Terstruktur.
**Conventions for every frame:** ASCII wireframe + "Build notes" (content, actions, states). Desktop layout is the primary frame; mobile notes are given where the layout changes. Sidebar = 240 px (08 §3.3). Page max-width 1,200 px.

## 0. Navigation map

```
Home (public, aggregate-only — post-MVP; MVP lands on Login)
  └─ Login
       └─ Dashboard ──┬─ Batch Detail ──┬─ Drive Ingest Job
       │              │                 ├─ Triage (file & asesi tanpa asesor) — v1.1
       │              │                 ├─ Candidate Detail (completeness + identity + name jury) — v1.2 jury section
       │              │                 ├─ DIT Analysis
       │              │                 ├─ Written-Test Grading
       │              │                 ├─ Similarity Report
       │              │                 └─ AK.05 Review / Export
       │              └─ Buat Batch (modal → Batch Detail)
       └─ Pengaturan (scheme config, form mapping, akun, tanda tangan — v1.2 §13)
            ├─ Pengaturan → Penyedia AI (Provider Settings — v1.4 §15)
            └─ Pengaturan → Skema (scheme registration + manifest editor — v1.4 §16)
```

Primary nav (sidebar, assessor): Dashboard · Batch · Asesi · Penilaian · Kemiripan · Laporan (AK.05) · Pengaturan. A job bell in the top bar shows active jobs with progress on every screen. Breadcrumbs: `Dashboard / [Batch] / [Asesi] / [Layar]`.

## 1. Home (public — post-MVP placeholder in MVP)

MVP has no public home page; an unauthenticated visitor lands on Login (§2). This frame is specified now so the public surface is never built with per-assessee data by accident.

```
┌──────────────────────────────────────────────────────────────┐
│ AsesorKompetensi                                   [Masuk]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Sistem pendukung asesor sertifikasi kompetensi             │
│   (OHSE / Ahli K3 Umum dan skema lainnya)                    │
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│   │ Batch aktif │  │ Asesi       │  │ Rata-rata   │           │
│   │      3      │  │    68       │  │ kelengkapan │           │
│   │             │  │             │  │    91%      │           │
│   └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                              │
│   Data di halaman ini hanya agregat. Data per asesi hanya    │
│   dapat dilihat oleh asesor yang ditugaskan setelah masuk.   │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** aggregates only — counts and percentages, never names, house/ID numbers, statuses, or documents. If no aggregate is publishable yet, show the intro text only.

## 2. Login

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│              AsesorKompetensi                                │
│     Sistem pendukung asesor — LSP / BNSP                     │
│                                                              │
│   ┌────────────────────────────────────────────┐             │
│   │ Email                                      │             │
│   │ [ asesor@lsp-contoh.id                  ]  │             │
│   │ Kata sandi                                 │             │
│   │ [ •••••••••••                           ]  │             │
│   │                                            │             │
│   │ [ Masuk ]                                  │             │
│   │ Lupa kata sandi?                           │             │
│   └────────────────────────────────────────────┘             │
│                                                              │
│   Akses hanya untuk asesor dan admin LSP/TUK yang            │
│   ditugaskan. Data asesi dilindungi UU PDP 27/2022.          │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** Supabase Auth email + password (OTP/magic-link P1). Error state: "Email atau kata sandi salah." — no hint which one. No demo credentials printed on the page, no role switcher, no "masuk sebagai" shortcut. After login → Dashboard. Session: Supabase SSR; logout in the user menu on every authenticated screen.

## 3. Dashboard

```
┌────┬────────────────────────────────────────────┬──────────────┐
│ ▓▓ │ Dashboard                  [🔔 2 pekerjaan]│ Perlu        │
│ ▓▓ │ Halo, [Nama Asesor]                       │ keputusan    │
│ ▓▓ │                                           │ Anda         │
│ ▓▓ │ ┌──────────────┐ ┌──────────────┐ ┌──────┐│ ⚠ 4 nama    │
│ ▓▓ │ │ Kelengkapan  │ │ Nama         │ │ Ke-  ││   belum     │
│ ▓▓ │ │   82%  ↗     │ │ dikonfirmasi │ │ putu-││   dikonfirm.│
│ ▓▓ │ │              │ │   19/23  ↗   │ │ san  ││ ⚠ 3 penilai-│
│ ▓▓ │ └──────────────┘ └──────────────┘ │ 14   ││   an menunggu│
│ ▓▓ │ ┌──────────────┐ ┌──────────────┐ │ /23↗││ ⚠ 2 pasangan│
│ ▓▓ │ │ Kemiripan    │ │ AK.05        │ └──────┘│   kemiripan │
│ ▓▓ │ │   2 perlu    │ │   Draf       │         │   perlu     │
│ ▓▓ │ │   ditinjau ↗ │ │   1 batch    │         │   ditinjau  │
│ ▓▓ │ └──────────────┘ └──────────────┘         │             │
│ ▓▓ │                                           │ Total: 9    │
│ ▓▓ │ Batch saya                    [Semua|Perlu│ keputusan   │
│ ▓▓ │ ┌───────────────────────────────────────┐ │ menunggu   │
│ ▓▓ │ │ 12 Nov 2026 — Ahli K3 Umum            │ │             │
│ ▓▓ │ │ TUK PT. Global Competency Investama   │ └──────────────┘
│ ▓▓ │ │ 23 asesi · 2 asesor · 82% [Buka →]    │               │
│ ▓▓ │ └───────────────────────────────────────┘               │
│ ▓▓ │ [+ Buat Batch]                                          │
└────┴─────────────────────────────────────────────────────────┘
```

**Build notes — Dashboard V18 design language (v1.4, D20, grounded in the screenshot Moza sent 2026-11-18 01:25):** modern & minimal, white-and-blue theme, premium, responsive. Concrete elements: **glassmorphism cards** (`glass-card p-6 rounded-2xl`) in a 3-column grid; **hover lift** on cards (`whileHover={{ y: -5 }}`, framer-motion — respects `prefers-reduced-motion`); **gradient accents** (one accent per card); **dark icon sidebar** (near-black vertical icon rail on the left — icons only, labels on hover; destinations keep their order and names); **right-hand panel column** ("Perlu keputusan Anda" with counts and a total — the reference's "Collections" panel, adapted); **StatsCard** — title (small, semibold), value (large, bold), change indicator with a lucide arrow (`ArrowUpRight`, emerald for positive). Stats shown are completeness %, names confirmed, decisions recorded, similarity flags to review — each a big value with a change arrow. Filter tabs sit top-right of the grid (Semua / Perlu keputusan / Selesai). The layout is an adaptation for an assessor dashboard — not a copy of the reference's bookmarks board. "Perlu keputusan Anda" is sorted first and is the only thing above the fold that matters; batch cards follow. Each batch card shows scheme, TUK, date, assessee + assessor counts, completeness bar. Empty state: "Belum ada batch. Buat batch pertama Anda." + [Buat Batch]. Loading: skeleton cards.

## 4. Batch Detail

```
┌──────────┬───────────────────────────────────────────────────┐
│ < Dashboard / Batch 12 Nov 2026                             │
│ Ahli K3 Umum — TUK PT. Global Competency Investama           │
│ Kamis, 12 Nov 2026, 09.00 WIB · 23 asesi · 2 asesor         │
│ [Pindai Drive] [Impor Sheet] [Pengaturan Batch]              │
│                                                               │
│ Ringkasan kelengkapan                                         │
│ APL.01 ████████░░ 19/23   APL.02 ██████░░░░ 14/23            │
│ KTP ████████████ 23/23    Ijazah ███████████░ 21/23          │
│ CV ██████░░░░░░ 13/23     Sertifikat Pelatihan ██ 22/23      │
│                                                               │
│ Asesi — urut: perlu keputusan dulu                            │
│ ┌──────┬────┬────┬────┬────┬───┬────┬──────────┬──────────┐   │
│ │ Nama │APL │APL │KTP │Ija │CV │Ser │ Identitas│ Keputusan│   │
│ │      │ 01 │ 02 │    │zah │   │tif │          │          │   │
│ ├──────┼────┼────┼────┼────┼───┼────┼──────────┼──────────┤   │
│ │ [A]  │ ⚠  │ —  │ ✓  │ ✓  │ — │ ✓  │ ⚠ Beda   │ —        │   │
│ │ [B]  │ ✓  │ ✓  │ ✓  │ ✓  │ ✓ │ ✓  │ ✓        │ K        │   │
│ └──────┴────┴────┴────┴────┴───┴────┴──────────┴──────────┘   │
│ [25 per halaman]              [< 1 2 >]                       │
│                                                               │
│ Dokumen tak terpetakan (unmatched): 6 file — [Tinjau]         │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** the completeness matrix mirrors the real "Kelompok Asesi" sheet columns (APL.01, APL.02, KTP, Ijazah, Pas Foto, CV, Sertifikat Pelatihan, Portofolio). Cell values: ✓ lengkap, — belum ada, ⚠ bermasalah (e.g. unsigned scan, poor photo) with a tooltip. Row click → Candidate Detail (§6). "Pindai Drive" opens the ingest modal (paste folder URL → §5). Mobile: table becomes card list, name sticky. **Buat Batch (v1.4, D13):** the [+ Buat Batch] action opens the short intake (§14) — pick the registered scheme, paste the Drive link(s), supply the Kelompok Asesi — never a re-upload of the scheme or its scheme-level forms.

## 5. Drive Ingest Job

```
┌──────────────────────────────────────────────────────────────┐
│ < Batch 12 Nov 2026 / Pindai Drive                           │
│ Sumber: Persyaratan Pelatihan AK3 Umum BNSP                  │
│ https://drive.google.com/drive/folders/1e3X…                 │
│                                                               │
│ Status: Berjalan — 127 / 214 file          [Batalkan]        │
│ ████████████████████░░░░░░░░░░░░░░░░  59%                     │
│ Selesai 124 · Gagal 3 · Tak terpetakan 6 · Berjalan 3         │
│ Mulai 09.41 · Berjalan 04:12                                 │
│                                                               │
│ Anda bisa meninggalkan halaman ini — pekerjaan               │
│ berlanjut di latar belakang.                                  │
│                                                               │
│ File gagal (3)                                                │
│ • …/KTP Image — Akses ditolak (403, tidak publik) [Coba Lagi]│
│ • …/Form (1).docx — Gagal mengekstrak teks    [Coba Lagi]    │
│ • …/Ijazah.pdf — Ukuran melebihi batas        [Coba Lagi]    │
│                                    [Coba Lagi Semua]          │
│                                                               │
│ File tak terpetakan (6) — [Tinjau & Petakan]                  │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** determinate progress when the total is known; elapsed time always shown. Partial success is shown as partial success. Failed files list reason + per-item retry. If the worker restarts, the screen shows "Dilanjutkan dari titik terakhir — 124 file tidak diunduh ulang." Completed state: summary + [Lihat Hasil] → Batch Detail. Never a spinner-only screen.

## 6. Candidate Detail — completeness + identity

```
┌──────────────────────────────────────────────────────────────┐
│ < Batch / [Nama Asesi]                    [K/BK: —]           │
│ Kelompok 1 · Asesor: [Nama Asesor]                           │
│                                                               │
│ Kelengkapan dokumen                                           │
│ ✓ APL.01 — FR.APL.01…docx — 09 Nov  [Lihat]                  │
│ — APL.02 — belum ada                        [Minta]           │
│ ✓ KTP — KTP Image — OCR yakin 92%          [Lihat]           │
│ ⚠ Pas Foto — berkacamata, pantulan cahaya   [Lihat]           │
│                                                               │
│ Periksa identitas — nama di sertifikat                        │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│ │ KTP (otoritas)│ APL.01       │ Surat Tugas  │ Ijazah      │ │
│ │ [Nama KTP]   │ [Nama APL]   │ [Nama ST]    │ [Nama Ijz]   │ │
│ │ yakin 92%    │              │              │              │ │
│ └──────────────┴──────────────┴──────────────┴──────────────┘ │
│ KTP adalah sumber otoritas (v1.3, D6) — nama di sertifikat =  │
│ nama di KTP, kata per kata.                                   │
│                                                               │
│ ── Putusan juri nama (AI — rekomendasi, bukan keputusan) ──   │
│ Putusan: ● Beda — diusulkan   (Model [dari Pengaturan       │
│   Penyedia] · Prompt name-jury v1 · 12 Nov 2026, 09.55)      │
│ Alasan (Bahasa Indonesia): Gelar "S.K.M." tertulis di         │
│   depan nama pada APL.01 tetapi di belakang nama pada KTP;    │
│   ejaan nama sama pada keempat sumber.                         │
│ Bukti: KTP "…[Nama KTP]…" · APL.01 "…[Nama APL]…" ·           │
│   Surat Tugas "…[Nama ST]…" · Ijazah "…[Nama Ijz]…"           │
│                                                               │
│ Nama tercetak di sertifikat (usulan juri):                    │
│ [ Nama lengkap sesuai usulan juri        ]                    │
│ [ Konfirmasi Nama Ini ] [ Ubah / Ketik Sendiri ]              │
│ [ Tandai Perlu Manusia ]                                      │
│                                                               │
│ Riwayat: 09.55 Juri memberi putusan · 09.52 OCR KTP selesai   │
│   (yakin 92%) · 09.10 OCR KTP dimulai                         │
└──────────────────────────────────────────────────────────────┘
```

**Build notes — name jury (v1.2, D10, decided 17 Nov 2026 23:45):** the jury review lives **as a section of Candidate Detail (§6), not a separate screen** — the assessor reviews identity and the jury verdict in one place, next to the KTP image pane. The jury compares four sources (KTP via local OCR — marked as the authority source, v1.3 D6 — APL.01, surat tugas, ijazah); the KTP image is view-only (private bucket, signed URL, audit-logged) and is never sent to any LLM. Verdicts: `Cocok` (green — all sources agree), `Beda — diusulkan` (amber — proposed name shown, composed only of name tokens present in the sources), `Perlu manusia` (amber — no proposed name is shown anywhere, only the reasoning and the four sources). The proposed name is always the KTP spelling (v1.3, D6 decided): The KTP (government ID) is the authority: the certificate name is the KTP name, verbatim. Surat tugas, APL.01, and ijazah are compared against the KTP, and any discrepancy resolves to the KTP spelling — surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean". If the KTP itself cannot be read (low OCR confidence), the jury proposes nothing (`Perlu manusia`). The proposed name becomes the certificate name ONLY when the assessor taps [Konfirmasi Nama Ini]; [Ubah / Ketik Sendiri] is an override (assessor types the name, audit-logged with the verdict it replaced + a reason); [Tandai Perlu Manusia] keeps the name unconfirmed with a reason. Until confirmation or override, the name stays "belum dikonfirmasi" and AK.05 stays blocked. OCR states: running ("Membaca KTP…"), done with confidence badge, low confidence (amber "Hasil OCR kurang yakin — periksa" → jury proposes nothing). If the KTP image is missing, the section shows "KTP belum ada" and no jury verdict exists. NIK is never displayed on this screen and never sent to any AI feature (QA IDN-15, SEC-07). Mobile: the four name cards stack vertically; the jury card follows them.

## 7. DIT Analysis

```
┌──────────────────────────────────────────────────────────────┐
│ < Asesi / Analisis DIT — FR.IA.04A                           │
│ DIT — Daftar Instruksi Terstruktur                            │
│ Sumber: Tugas DIT [Nama].pptx · Transkrip presentasi          │
│ Rekomendasi AI — perlu konfirmasi asesor                      │
│ Model [dari Pengaturan Penyedia] · Prompt dit-gap-analysis  │
│                                                               │
│ Ringkasan profil kandidat                                     │
│ Pendidikan: [ringkasan] · Pengalaman kerja: [ringkasan]       │
│ Tingkat peran: [Manajerial / Lulusan Baru / Transisi /        │
│   Operator] · Wilayah: [daerah] · Sektor: [industri]          │
│ (Sumber: CV / profil — hanya-baca; periksa sebelum percaya    │
│  pada personalisasi soal)                                     │
│                                                               │
│ Matriks cakupan FR.IA.04A                                     │
│ ┌────┬──────────────────┬──────────────┬──────────────────┐   │
│ │ No │ Titik Fokus      │ Status       │ Bukti (kutipan)  │   │
│ │ 1  │ [Fokus 1]        │ ✅ Terpenuhi │ "…kutipan…"       │   │
│ │ 2  │ [Fokus 2]        │ ⚠ Sebagian   │ "…kutipan…"       │   │
│ │ 3  │ [Fokus 3]        │ ❌ Belum     │ —                │   │
│ └────┴──────────────────┴──────────────┴──────────────────┘   │
│ Ringkasan: 8 dari 11 terpenuhi | 2 sebagian | 1 belum        │
│                                                               │
│ Pertanyaan pengisi celah                                      │
│ [Kelompok Pekerjaan — Nama]                                   │
│ • [CMS] Pertanyaan …?        • [TS] Pertanyaan …?            │
│                                                               │
│ Bank soal — 13 soal (disesuaikan presentasi)                  │
│ 1. [Soal skenario …]                      [TS]                │
│ 2. [Soal skenario …]                      [TMS]               │
│ … 13. [Soal …]                                                │
│                                                               │
│ Estimasi kesiapan: 76% · Kekuatan: … · Celah kritis: …        │
│ Rekomendasi: Belum Kompeten (rekomendasi AI)                  │
│ [Setuju] [Ubah] [Minta Tinjauan Ulang]                        │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** every matrix row quotes evidence; rows without evidence say so. **Official FR.IA.04B (v1.4, D14 — OQ-02 answered):** the form lives on its own section of this screen and shows its **built-in questions per Kelompok Pekerjaan** (4 KP, 13 built-in questions for AK3U — one per unit, from the active scheme's manifest), each with its Kesesuaian (unit/elemen/KUK) column and a Ya / Tidak control, with the DIT deck (presentation) shown as the evidence beside the questions; the recommendation row offers only Kompeten / Belum Kompeten. The 13-question bank is labelled as the user's bank, visually and textually separate from the official form — never merged with it. The bank's count comes from the active scheme's manifest (13 for AK3U, never hard-coded — v1.4, D17/D21). Count is asserted (exactly the configured number, default 13) — a bank with the wrong count shows an error state, not a partial list. The profile summary block (v1.1) is the RCTFA prompt's "Candidate Profile Summary" rendered read-only, so the assessor can verify the personalisation inputs (role level, region, sector) before trusting the questions. **Completeness gate (v1.1):** when any required input is missing, this whole screen is replaced by the gate panel — "Analisis ditunda — bahan belum lengkap" + a checklist of the missing inputs (FR.IA.04A / transkrip presentasi / profil kandidat), one action per missing item, and a disabled "Jalankan Analisis" button naming the blocker. No partial matrix or partial bank is ever shown. The readiness block stores readiness % + strengths + critical gaps + follow-up actions; the readiness *recommendation* is a note field ("Rekomendasi kesiapan (catatan, bukan keputusan)") — it never sets a K/BK decision.

## 8. Written-Test Grading (FR.IA.06)

```
┌──────────────────────────────────────────────────────────────┐
│ < Asesi / Penilaian Tertulis — FR.IA.06                       │
│ Kunci: FR.IA.06B (MUK 2023) · Jawaban: FR.IA.06C             │
│ Pemetaan bentuk: 06A soal / 06B kunci / 06C jawaban          │
│                                                               │
│ Soal 1 — [Pertanyaan esai, ringkas]                           │
│ ┌─ Kunci (06B) ─────────────┬─ Jawaban asesi (06C) ────────┐ │
│ │ [Poin-poin kunci …]       │ [Jawaban asesi …]            │ │
│ └───────────────────────────┴──────────────────────────────┘ │
│ Penilaian AI: Sebagian Benar — Rekomendasi AI                 │
│ Penjelasan (Bahasa Indonesia): …                              │
│ [▸ Jawaban model — hanya untuk asesor]  (tertutup; klik       │
│   untuk membuka — tidak pernah tampil di ekspor untuk asesi)  │
│ [✓ Benar] [◐ Sebagian Benar] [✗ Salah]   [Konfirmasi]        │
│                                                               │
│ Soal 2 … (pola yang sama)                                     │
│                                                               │
│ Ringkasan: Benar 2 · Sebagian 2 · Salah 1 · Belum dikonfirm. 1│
│ Ringkasan Kesalahan: Soal 3, 5 — jawaban masih kurang tepat   │
│ (tidak ada persentase keseluruhan sebagai penentu lulus)      │
│ [Konfirmasi Semua]                                            │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** master span and student span are always side by side; the assessor confirms per item (one tap) or confirms all. The deterministic exact-match path is indicated ("Cocok persis — tanpa AI") where it applied, and MC items are graded deterministically by option-letter match with no LLM call (QA GRD-13). Overriding an AI verdict requires no extra form, but the override is audit-logged. Identity: the assessee's exact name is in the header on every question — grading screens never show two assessees at once. **Model answers (v1.1):** the collapsed "Jawaban model" box holds the expected answer for that question, for the assessor to judge against; it is labelled assessor-only, invisible to `tuk_viewer`/`auditor` roles, and excluded from any candidate-facing export. **Encrypted key (v1.1):** when the 06B key file is encrypted, the screen shows the locked state — "Kunci jawaban (FR.IA.06B) terproteksi kata sandi" + [Masukkan Kata Sandi] — and all grading controls stay disabled until the key is unlocked for that run (doc 08 §4 v1.1; QA GRD-19). The password is never shown, logged, or stored. **v1.3 grading shape (D7):** each question shows its verdict (Benar / Sebagian Benar / Salah) + a Bahasa Indonesia explanation; the screen's summary is the per-student error list (Ringkasan Kesalahan — the question numbers answered wrong), never an overall percentage as a pass/fail. **v1.4 (D16 — OQ-04 ANSWERED, replaces the v1.3 default):** the AI judges VATM sufficiency per unit and recommends K/BK per unit ("Kompeten" when the evidence meets VATM, "Belum Kompeten" otherwise — scheme §9.3.3–9.3.4, no numeric pass mark); the assessor confirms or overrides the recommendation per unit, and the AK.02 record reflects the confirmed value. **Export (v1.2, D8):** the grading-report export on this screen is **[Ekspor DOCX] only** — there is no PDF button for a non-AK.05 document; a PDF request is rejected with `format_not_allowed` (QA EXP-06).

## 9. Similarity Report

```
┌──────────────────────────────────────────────────────────────┐
│ < Batch / Laporan Kemiripan              [DIT] [Tertulis]     │
│ Kemiripan adalah TANDA untuk ditinjau asesor,                 │
│ bukan bukti plagiarisme dan bukan keputusan gagal.            │
│                                                               │
│ Matriks kemiripan — [DIT]                                     │
│        [A]  [B]  [C]  [D]  …                                  │
│   [A]   —   .87  .12  .34                                     │
│   [B]  .87   —   .09  .41                                     │
│   [C]  .12  .09   —   .05                                     │
│   [D]  .34  .41  .05   —                                      │
│ (Klik sel → kartu pasangan. Sel di atas ambang ditandai;      │
│  skor adalah TANDA, bukan vonis.)                             │
│                                                               │
│ Pasangan dengan kemiripan tertinggi                           │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [Nama A]  ↔  [Nama B]        TF-IDF 0.87 · N-gram 0.81    │ │
│ │ Soal 2: frasa bersama "…[disorot]…"                       │ │
│ │ Soal 4: kesalahan unik yang sama: [kutipan]                │ │
│ │ Penilaian Anda: (•) Kebetulan  ( ) Perlu Ditinjau          │ │
│ │               ( ) Indikasi Menyalin — tetap TANDA saja     │ │
│ │ [Simpan Penilaian]                                         │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [Nama C] ↔ [Nama D]  TF-IDF 0.34 · … (di bawah ambang)    │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ Ambang penanda: TF-IDF ≥ 0.60 (dapat diubah di Pengaturan)    │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** pairs sorted by score; shared spans highlighted in both texts; shared unique errors called out. Verdict wording never says "plagiarisme terbukti". Short-answer overlaps are shown in a separate "Jawaban pendek" section so they are not mistaken for a copying signal. **Matrix view (v1.1):** the assessee × assessee grid sits above the pair cards, one grid per scope toggle (DIT / Tertulis). Cell = combined score (number + shade); the diagonal is empty; clicking a cell opens that pair's card below. For 23 assessees the grid is 23 × 23 (253 pairs); for larger batches it paginates by assessee group. The matrix is a navigation aid into the pair cards, not a second verdict surface — the assessor's per-pair verdict is recorded on the card only. **Combined report (v1.1):** a [Unduh Laporan Gabungan (Markdown)] action on this screen downloads the single combined report (grading tables + this similarity section, Bahasa Indonesia) — the same document MCP T14 serves. **v1.2 export rule (D8):** the combined report keeps its Markdown format — it is a data report, not a generated FR document. The similarity report itself, as a generated document, is exported as DOCX only (QA EXP-06). **v1.3 (D7):** the plagiarism analysis on this screen is a separate qualitative view — per-student status Bersih / Waspada + reasoning, never a numeric plagiarism verdict — and it is separate from the grading tables; no overall % is used as a pass/fail anywhere on this screen. **v1.4 (D19):** each pair card also shows its **numeric flag** (the per-scope numeric threshold comparison) **with the evidence details** (spans, shared unique errors) — the numbers are the flag, the qualitative status is the human-facing summary. Threshold values are config and UNCONFIRMED (calibration) — no number is asserted in the frame copy. The threshold line in the frame ("Ambang penanda: TF-IDF ≥ 0.60") is an illustrative placeholder from v1.0, not a decided value.

## 10. AK.05 Review / Export

```
┌──────────────────────────────────────────────────────────────┐
│ < Batch / Laporan Asesmen — FR.AK.05                         │
│ Per asesor, per batch · Rekomendasi kepada TUK/LSP            │
│ Asesor: [Nama, No. Reg MET…] · 12 Nov 2026                   │
│                                                               │
│ ⚠ Terkunci: 2 nama belum dikonfirmasi — [Lihat]              │
│                                                               │
│ ── Pratinjau persis ekspor (v1.1) ────────────────────────   │
│ FR.AK.05. | LAPORAN ASESMEN                                   │
│ Skema Sertifikasi: AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM │
│ Nomor: SKM/2037/00013/2/2021/1 · TUK: Sewaktu/Tempat Kerja/  │
│ Mandiri* · Nama Asesor: … · Tanggal: …                       │
│ ┌────┬──────────────┬───────────────┬─────────────────────┐  │
│ │ No │ Nama Asesi   │ Rekomendasi   │ Keterangan**        │  │
│ │    │              │ K    │ BK     │                     │  │
│ │ 1  │ [Nama]       │ ✓    │        │ Kompetensi cukup    │  │
│ │ 2  │ [Nama]       │      │ ✓      │ Perlu asesmen ulang │  │
│ │ … (baris 3–12 sesuai blanko; baris kosong tetap tampil)   │  │
│ └────┴──────────────┴───────────────┴─────────────────────┘  │
│ **Tuliskan Kode dan Judul Unit Kompetensi yang dinyatakan BK │
│ Aspek Negatif dan Positif dalam asesmen: […]                  │
│ Pencatatan penolakan hasil asesmen: […]                       │
│ Saran perbaikan (Asesor/personil terkait): […]                │
│ Catatan: … | Asesor: Nama … · No. Reg … · Tanda tangan &     │
│ tanggal …                                                     │
│ ─────────────────────────────────────────────────────────   │
│                                                               │
│ Catatan keseluruhan:                                          │
│ [Asesi sangat kooperatif …                               ]    │
│                                                               │
│ Tahap: Draf → [Ekspor PDF] [Ekspor DOCX]                      │
│ Setelah ekspor: [Tandai Diserahkan ke TUK/LSP]                │
│ (Dikembalikan TUK/LSP? → Draf baru v2, versi lama tersimpan)  │
│                                                               │
│ AK.05 adalah rekomendasi asesor, bukan keputusan sertifikasi. │
│ Keputusan sertifikasi dibuat oleh pleno LSP; pengajuan ke     │
│ BNSP dilakukan setelahnya.                                    │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** the preview renders the exact blank-form layout from `research/form-blanks-extracted.md` (header rows, 12 numbered rows with K/BK columns, the BK footnote, three notes sections, signature block) filled with the draft data — preview and export must agree byte-for-byte in content (QA EXP-01). Rows are only the assessees **this assessor actually assessed**, never the whole batch. Export is blocked with a named blocker until names are confirmed and decisions recorded. After export, the handoff stage is explicit (`Draf → Diserahkan ke TUK/LSP → Pleno → Pengajuan ke BNSP`); the UI never calls AK.05 a certificate. **Sign-off (v1.1):** "Tandai Diserahkan" opens a confirmation modal listing the row count, the K/BK split, and the blockers checked; submission hands the recommendation to TUK/LSP. A returned report (TUK/LSP return with a reason) re-opens as a new draft version; the submitted version stays read-only (QA EXP-05). **v1.2 — signature in the sign-off modal (D11):** the modal shows a thumbnail preview of the signature image that will be stamped (assessor name + No. Reg beneath it) so the assessor sees exactly what will be applied before confirming. If the assessor has no active signature, the modal shows the blocker "Tanda tangan belum diunggah" + [Unggah Tanda Tangan] (→ Pengaturan → Profil, §13) and the "Tandai Diserahkan" button stays disabled — AK.05 submit is blocked with no active signature (QA SIG-03). The preview's signature block renders the same image; a draft preview shows an empty signature space, never a placeholder. **v1.2 — export rule (D8):** AK.05 is the only document with [Ekspor PDF] [Ekspor DOCX] buttons; both formats are byte-valid against the blank (QA EXP-01).

## 11. Responsive notes (all screens)

- **768–1023 px:** sidebar collapses to icons; DIT/grading two-column evidence layouts stack to one column; tables scroll horizontally with the name column sticky.
- **< 768 px:** bottom nav (Dashboard · Batch · Tugas · Pengaturan); K/BK toggle and primary buttons full-width; ingest progress becomes a sticky bottom sheet; the three-column identity check stacks vertically.
- **Print:** AK.05 and grading reports print black-on-white without nav, with page breaks between assessees.

## Screen inventory (for build tracking)

| # | Screen | Route (proposed) | Phase |
|---|---|---|---|
| 1 | Home (public, post-MVP) | `/` | P1 |
| 2 | Login | `/login` | 0 |
| 3 | Dashboard | `/dashboard` | 0–1 |
| 4 | Batch Detail | `/batches/[id]` | 1 |
| 5 | Drive Ingest Job | `/batches/[id]/ingest/[jobId]` | 1 |
| 6 | Candidate Detail | `/batches/[id]/assessees/[assesseeId]` | 2 |
| 7 | DIT Analysis | `/batches/[id]/assessees/[assesseeId]/dit` | 3 |
| 8 | Written-Test Grading | `/batches/[id]/assessees/[assesseeId]/written` | 4 |
| 9 | Similarity Report | `/batches/[id]/similarity` | 4 |
| 10 | AK.05 Review / Export | `/batches/[id]/ak05` | 5 |
| 11 | Pengaturan (scheme, form mapping, akun, tanda tangan) | `/settings` | 0–2 |
| 12 | Triage — file & asesi tanpa asesor (v1.1) | `/batches/[id]/triage` | 1 |
| 13 | Pengaturan → Profil & Tanda Tangan (v1.2) | `/settings/profile#tanda-tangan` | 0 |
| 14 | Provider Settings — Penyedia AI (v1.4) | `/settings/provider` | 0 |
| 15 | Scheme Registration — manifest editor (v1.4) | `/settings/schemes` | 0 |

## 12. Triage — file & asesi tanpa asesor (v1.1)

```
┌──────────────────────────────────────────────────────────────┐
│ < Batch 12 Nov 2026 / Triage                                 │
│ Satu folder bersama, 2 asesor — petakan sebelum analisis.     │
│                                                               │
│ File tanpa asesi / asesor (14)              [Tetapkan Massal] │
│ ┌──────────────────────┬───────────────┬──────────┬────────┐  │
│ │ File                 │ Saran asesi   │ Keyakinan│ Aksi   │  │
│ │ …/DIT LUMIKA/…pptx   │ [Asesi X]     │ 92%      │ [✓][✕] │  │
│ │ …/KTP Image          │ — (generik)   │ —        │ [Pilih │  │
│ │ …/Form (1).docx      │ [Asesi Y]     │ 61%      │ [✓][✕] │  │
│ └──────────────────────┴───────────────┴──────────┴────────┘  │
│                                                               │
│ Asesi tanpa asesor (3)                                        │
│ ┌──────────────┬──────────────────┬────────────────────────┐  │
│ │ Asesi        │ Saran asesor     │ Alasan                 │  │
│ │ [Asesi P]    │ [Asesor 1]       │ Kelompok 1 di sheet    │  │
│ │ [Asesi Q]    │ —                │ Tidak ada di sheet     │  │
│ └──────────────┴──────────────────┴────────────────────────┘  │
│                                                               │
│ [✓] = terima saran · [✕] = tolak · [Pilih] = pilih manual     │
│ [Tandai tidak diperlukan + alasan] untuk file yang bukan      │
│ bukti (mis. materi pelatihan).                                │
│                                                               │
│ Selesai: 0 belum dipetakan → [Lanjut ke Kelengkapan]          │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** this is the screen that splits one flat shared folder across assessors (doc 09 M1.6 v1.1; MCP T17/T18). Suggestions come from filename→person extraction + the "Kelompok Asesi" sheet join where a sheet exists; generic filenames ("KTP Image", "Foto Image") get no suggestion and must be picked manually. Low-confidence suggestions (< the configured floor) are shown but never auto-applied. Assign controls are visible only to `ketua_tim` / `lsp_admin`; an assessor sees only items routed to them. Every decision (accept / pick / reject / "not needed" + reason) is audit-logged. The screen blocks nothing else by force — but DIT analysis for an assessee with unassigned files shows the gate panel until triage is done (doc 08 §4 v1.1). Mobile: rows become cards, one action per card.

## 14. Buat Batch — short per-batch intake (v1.4, D13)

```
┌──────────────────────────────────────────────────────────────┐
│ Buat Batch                                    [✕]            │
│                                                               │
│ Skema                                                         │
│ [ Ahli K3 Umum — SKM/2037/00013/2/2021/1        ▾ ]          │
│ (Skema + formulir tingkat skema sudah terdaftar —            │
│  tidak perlu diunggah ulang. Belum ada skema?                │
│  → Daftarkan Skema di Pengaturan, §16.)                       │
│                                                               │
│ Tautan Drive (1–2 folder)                                     │
│ [ https://drive.google.com/drive/folders/…        ]          │
│ [+ Tambah folder]  (data peserta dan/atau tugas DIT /         │
│  portofolio)                                                  │
│                                                               │
│ Kelompok Asesi                                                │
│ (•) Tautan Drive  ( ) File .xlsx                              │
│ [ https://docs.google.com/spreadsheets/… / Pilih file ]       │
│                                                               │
│ [Buat Batch]                                    [Batal]       │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** three inputs only — scheme (picked from the registered schemes), Drive link(s), Kelompok Asesi (Drive link or .xlsx). The scheme-level forms (06A, 06B) are already registered with the scheme and are never re-uploaded here; filled 04A/04B/09 copies arrive inside the Drive folder and are ingested (§5). Direct upload of a filled form is the fallback only, reached from the Triage screen, never from this modal. Validation: no scheme selected → the [Buat Batch] button stays disabled with the blocker named; a Drive link that is not a folder URL → inline error naming the expected format. On success → Batch Detail (§4) with the ingest job starting.

## 15. Pengaturan → Penyedia AI — Provider Settings (v1.4, D18)

```
┌──────────────────────────────────────────────────────────────┐
│ < Pengaturan / Penyedia AI                                    │
│ Semua nilai disimpan lokal di peramban Anda. Kunci dikirim   │
│ ke server per permintaan dan tidak pernah dicatat.            │
│                                                               │
│ Penyedia                                                      │
│ [ Anthropic (Claude) ]  [ OpenAI-compatible ]  [ Gemini ]     │
│                                                               │
│ API Key                                                       │
│ [ ••••••••••••••••••••••••                       👁 ]          │
│                                                               │
│ Base URL (gateway opsional)                                   │
│ [ https://…                                       ]          │
│                                                               │
│ ANTHROPIC_AUTH_TOKEN (dipakai saat memanggil gateway)         │
│ [ token bearer / passthrough gateway           👁 ]          │
│                                                               │
│ Model                                    [ Saran… ▾ ]         │
│ [ deepseek-v4.1-flash                         ]               │
│                                                               │
│ Temperature        Max token        Thinking budget (0 = off) │
│ [ 0.9          ]   [ 51200      ]   [ 0                  ]   │
│                                                               │
│ ⓘ Google Drive API key (opsional) — diperlukan untuk membaca  │
│   folder Drive publik. Buat di Google Cloud Console dengan    │
│   Drive API aktif; batasi dengan HTTP referrer atau IP bila   │
│   memungkinkan. Tanpa OAuth — hanya folder publik.            │
│ Google Drive API key (opsional)                               │
│ [ ••••••••••••••••••••••••                       👁 ]          │
│                                                               │
│ [💾 Simpan]   [⚡ Uji Koneksi]                                │
│                                                               │
│ Terakhir diuji: Terhubung · [model] · 12 Nov 2026, 09.55      │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** modelled on Moza's Test Grader Provider Settings screenshot (the fields above are that screen's fields; the values shown are placeholders, never real keys). Provider selector: Anthropic (Claude) / OpenAI-compatible / Gemini — plus OpenRouter / OmniRouter / 9Router / Nvidia NIM and others via the OpenAI-compatible path (base URL + model). Keys are masked, stored locally in the browser, sent per request, never logged, never committed, never echoed back — not even by [Uji Koneksi], whose result says only "Terhubung" or "Gagal — [alasan]" (wrong key, unreachable gateway, unknown model). Changing provider or model never re-grades past runs — past runs keep the provider + model recorded on them. Grading/jury calls use temperature 0 (deterministic) regardless of the Temperature field — that field is the user's default for other calls (Moza's Test Grader uses 0.9 as its own default; that is his app's setting, not the grading default). No provider is claimed to be free — free tiers are usable; check the provider's own pricing before a live batch. The Google Drive API key is optional and is the same key the ingest path uses (doc 11 §4) — it is not a provider key and it never reaches an LLM.

## 16. Pengaturan → Skema — scheme registration, manifest editor (v1.4, D17)

```
┌──────────────────────────────────────────────────────────────┐
│ < Pengaturan / Skema                       [+ Daftarkan Skema]│
│                                                               │
│ Skema terdaftar                                               │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Ahli K3 Umum — SKM/2037/00013/2/2021/1 · 13 unit · aktif  │ │
│ │ [Lihat Manifest] [Ubah]                                   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ Manifest skema — Ahli K3 Umum (AK3U)                          │
│                                                               │
│ Dokumen skema                                                 │
│ [ Skema Sertifikasi Okupasi AHLI K3 UMUM 2021 — LSP HSE      │
│   INDONESIA, 2022-12-01 · research/skema-ak3u-2021.txt ]     │
│                                                               │
│ Daftar file (manifest)                                        │
│ ┌────────────┬──────────────────────┬──────────┬───────────┐  │
│ │ Formulir   │ Nama / sufiks        │ Wajib?   │ Instrumen │  │
│ │ FR.IA.04A  │ 04A = penjelasan DIT │ Ya       │ DIT       │  │
│ │ FR.IA.04B  │ 04B = penilaian DIT  │ Ya       │ Presentasi│  │
│ │ FR.IA.06A  │ 06A = soal           │ Ya       │ Tertulis  │  │
│ │ FR.IA.06B  │ 06B = kunci          │ Ya       │ Tertulis  │  │
│ │ FR.IA.09   │ 09 = wawancara       │ P1       │ Wawancara │  │
│ └────────────┴──────────────────────┴──────────┴───────────┘  │
│                                                               │
│ Jumlah soal                                                   │
│ 04B bawaan: [13] · 06A esai: [13] · Bank soal: [13]           │
│ (per skema — jangan pernah hard-code 13; 13 hanya nilai       │
│  manifest AK3U)                                               │
│                                                               │
│ Aturan keputusan / penilaian                                  │
│ [ VATM — bukti memenuhi VATM → Kompeten (skema §9.3.3–9.3.4) ]│
│ (merujuk dokumen skema di atas; skema lain merujuk dokumen    │
│  skemanya sendiri — tidak pernah hard-code global)            │
│                                                               │
│ Prasyarat masuk                                               │
│ [ SLTA + 3 thn · D3/D4/S1 + 2 thn · S2/S3 + 1 thn ·          │
│   pelatihan berbasis kompetensi ]                             │
│                                                               │
│ Persyaratan pendaftaran (daftar bukti)                        │
│ [ KTP · Ijazah min SLTA · Surat pengalaman / sertifikat       │
│   pelatihan · CV · 4 pas foto 3×4 latar merah ]               │
│                                                               │
│ [Simpan Manifest]                                             │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** the manifest editor is how a scheme is registered (v1.4, D17 + D21): file set (forms, names/suffixes, required vs optional, instruments), question counts (04B built-in count, 06A essay count, question-bank default count), decision/assessment rules reference (which scheme document states the rule), prerequisites (entry education/experience combinations), and registration requirements (evidence list). **AK3U's values are AK3U's only** — the fields above show the AK3U manifest because AK3U is the registered example; registering another scheme starts with empty fields (or an explicit template the admin picks), never pre-filled with AK3U's values. No other scheme's values are invented — Petugas K3's file set, question counts, prerequisites, and requirements are UNKNOWN. Only `lsp_admin` / `super_admin` can create or edit a scheme manifest; a manifest change creates a new version — batches already running keep the manifest version they started with. The scheme document reference links to the extracted text in `research/` (for AK3U: `research/skema-ak3u-2021-extracted.md` + `research/skema-ak3u-2021.txt`).

## 13. Pengaturan → Profil & Tanda Tangan (v1.2, D11)

```
┌──────────────────────────────────────────────────────────────┐
│ < Pengaturan / Profil & Tanda Tangan                          │
│ Asesor: [Nama, No. Reg MET…] · LSP …                         │
│                                                               │
│ Tanda tangan aktif                                            │
│ ┌──────────────────────┐                                      │
│ │  [pratinjau gambar   │  Versi 2 · Diunggah 12 Nov 2026     │
│ │   tanda tangan]      │  [Ganti Tanda Tangan]                │
│ └──────────────────────┘                                      │
│                                                               │
│ Unggah baru / gambar baru                                     │
│ [Pilih File — PNG / JPG]  atau  [Gambar di Kanvas]            │
│ (Pratinjau langsung; file tidak valid ditolak dengan pesan)   │
│                                                               │
│ Riwayat versi (hanya-baca)                                    │
│ • Versi 1 · Diunggah 03 Mar 2026 · Dipakai di 2 dokumen      │
│   [Lihat]                                                     │
│                                                               │
│ Dokumen yang memakai tanda tangan ini: AK.05, AK.01, AK.02,   │
│ AK.06, AK.07, FR.IA.04A, FR.IA.04B, FR.IA.07, FR.IA.08,       │
│ FR.IA.09, FR.IA.10, FR.APL.01, FR.APL.02, Berita Acara —      │
│ diterapkan saat penandatanganan / finalisasi, tidak pernah    │
│ pada draf. Versi lama tetap pada dokumen lama.                │
└──────────────────────────────────────────────────────────────┘
```

**Build notes:** this is the signature-upload screen/section (doc 08 §3.4 `SignatureUpload` v1.2, doc 14 §14 v1.2). Upload accepts a scan/photo (PNG or JPG) or a canvas-drawn signature; both are validated (type + configured size limit) in the browser and again on the server. The active version + upload date + preview are shown; previous versions are read-only history with a per-version document count. Replacing creates a new version — past documents keep the signature they were signed with (QA SIG-05). The section also states which documents the signature applies to (verified against `research/form-blanks-extracted.md`): AK.05, AK.01, AK.02, AK.06, AK.07, FR.IA.04A, FR.IA.04B, FR.IA.07, FR.IA.08, FR.IA.09, FR.IA.10, FR.APL.01, FR.APL.02, Berita Acara. FR.AK.03 (no signature block in its blank), FR.AK.04 (assessee's signature only), FR.MAPA.02 (no signature block), and FR.VA (no signature block) are not listed; FR.MAPA.01's confirmation table is UNCONFIRMED (OQ-17) — assessee signatures are wet signatures on scanned originals and are out of scope. The section also shows the assessor's APL.01 §3.1 recommendation and APL.02 review fields (filled in-app, D11). The signature image is served by short-expiry signed URL only, never through MCP (doc 07 G13), and every upload / replacement / application is audit-logged. Mobile: the preview and the upload controls stack vertically; the canvas is full-width.
