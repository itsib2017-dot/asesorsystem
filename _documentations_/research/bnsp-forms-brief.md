# BNSP / LSP Competency Assessment — Forms Research Brief

**Date:** 17 November 2026
**Purpose:** Ground-truth for the AsesorKompetensi system design (PRD etc.). Not a PRD.
**Method:** Web search + page reads. Primary anchor: BNSP's official MUK 2023 socialisation deck (SE Ketua BNSP No. 1/BNSP/I/2024, Jakarta, 7 Feb 2024), plus BNSP assessor training modules (MAPA / MA / MKVA), LSP procedure pages, and one live specimen form (FR.IA.04B). Secondary sources (LSP blogs, `bnsp.net`) are marked as such — `bnsp.net` is **not** bnsp.go.id.
**Rule applied:** nothing invented. Where sources conflict or are silent, it is labelled UNCONFIRMED.

---

## 0. Corrections to the brief as given — read first

These matter because the system must not hard-code the wrong labels.

| # | As stated in the task / prompts | What the sources actually say | Consequence |
|---|---|---|---|
| 1 | DIT = "Daftar Instruksi Tertulis" | **DIT = Daftar Instruksi Terstruktur** (FR.IA.04A). Stated verbatim in the BNSP MUK 2023 deck and on the FR.IA.04B specimen ("FR IA 04A. DIT. Daftar Instruksi Terstruktur"). | Use "Terstruktur" everywhere in UI, docs, and file names. |
| 2 | FR.IA.04B = "13 soal tertulis" (user's `prompt_wawancara_k3.md`, Task 3) | Officially **FR.IA.04B = Penilaian Proyek Singkat atau Kegiatan Terstruktur** — the assessor scores the asesi's *presentation* of the structured activity: per-question Ya/Tdk, "Asesi telah memenuhi/belum memenuhi pencapaian seluruh kriteria unjuk kerja", recommendation **Kompeten / Belum Kompeten**, signatures of asesi + asesor (with No. Reg). It is **not** a written test. Written tests are FR.IA.05 (pilihan ganda) and FR.IA.06 (esai). | The user's prompt repurposes the 04B label for its own 13-question bank. The system must keep the **official 04B** and the **user's 13-question bank** as two different artefacts, or the generated 04B will not match the LSP's blank form. Moza to confirm which the LSP actually expects. |
| 3 | FR.IA.04B bank "berdasarkan isi presentasi, BUKAN jawaban ideal/standar" | Consistent with official 04B in one respect: questions are developed by the assessor *after* the presentation, from the presentation document/results, and must cover the 5 dimensions of competency. But official 04B has **no fixed count of 13** — the specimen shows open rows (1, 2, …). "Exactly 13" is the user's prompt convention, not a BNSP rule. | Make question count configurable per scheme/LSP, default 13 only for Moza's OHSE flow. |
| 4 | Recommendation "Kompeten / Belum Kompeten / Kompeten Bersyarat" (user prompt, Task 4) | Official decision is binary: **K (Kompeten) or BK (Belum Kompeten)** — on FR.AK.02, FR.IA.04B, FR.AK.05, and in every module. No "Kompeten Bersyarat" outcome was found in BNSP sources. | Do not offer "Kompeten Bersyarat" as a decision value; if Moza wants it, it must be a *recommendation note / follow-up status*, not the decision. |
| 5 | "FR.IA.06B = master key, FR.IA.06C = participant answer" | Correct **under MUK 2023 numbering**: 06A = soal esai, **06B = lembar kunci jawaban esai, 06C = lembar jawaban esai**. BUT other LSP documents swap the suffixes (e.g. SILSP admin guide lists 06A = kunci, 06B = lembar jawaban; some Buku Kerja label 05A as kunci). Same for 05A/05B/05C. | **Suffix meaning is version-dependent.** The system must store a per-scheme/per-LSP form-version mapping, never hard-code "06B = key". |
| 6 | FR.IA.09 = "the experience-based route" | FR.IA.09 is only one form in that route: **Pertanyaan Wawancara** (interview questions following up FR.IA.08). The route itself is *Verifikasi Portofolio* and uses IA.08 + IA.09 + IA.10 (+ IA.11 review produk). | Model the route as a method, not a single form. |

---

## 1. Form catalogue — what each form is, who fills it, when, what it contains

### 1.1 Registration / application (before assessment)

| Form | Official name | Who fills | When | Typical contents (verified) |
|---|---|---|---|---|
| **FR.APL.01** | Formulir Permohonan Sertifikasi Kompetensi | Asesi (candidate) | Registration, before any assessment | Personal data, education, scheme applied for, certification purpose, checklist of attached administrative documents (KTP, ijazah, CV, pas foto, training certificates, etc.), signature. LSP guidance: "data ini jadi dasar sertifikat Anda" — i.e. the certificate is printed from this data. |
| **FR.APL.02** | Asesmen Mandiri (self-assessment) | Asesi | Registration / pre-assessment | Per unit kompetensi, per elemen/KUK: self-declared **K / BK**, plus the supporting evidence for each K claim (certificate, portfolio, work letter, etc.). A K claim without evidence is the most common cause of back-and-forth. Verified by the assessor in pra-asesmen; ticking K everywhere does **not** entitle the asesi to proceed. |

### 1.2 Planning (MAPA — Merencanakan Aktivitas dan Proses Asesmen)

| Form | Official name | Who fills | When | Contents |
|---|---|---|---|---|
| **FR.MAPA.01** | Merencanakan Aktivitas dan Proses Asesmen | Asesor (sometimes with LSP) | Planning, before assessment day | Scheme, kelompok pekerjaan (job groups), units, approach per group, methods + instruments chosen, resources, schedule; approved/signed by LSP (e.g. Manager Sertifikasi). |
| **FR.MAPA.02** | Peta Instrumen Asesmen Hasil Pendekatan Asesmen dan Perencanaan Asesmen | Asesor | Planning | Map of which instrument (IA.01–IA.11) covers which unit/KUK, per kelompok pekerjaan. Made per kelompok pekerjaan. |
| **Peta Kelompok Pekerjaan** | (supporting form, not FR-numbered) | Asesor | Planning | Groups units whose outputs correlate into one integrated assessment job group. Basis for MAPA-01 and all IA forms. |

### 1.3 Assessment instruments (FR.IA) — during evidence collection

| Form | Official name | Method | Contents / notes |
|---|---|---|---|
| **FR.IA.01** | Ceklis Observasi Aktivitas Praktik | Observasi langsung | KUK copied verbatim from the standard (not rewritten as "me-" predicative sentences), Ya/Tdk per KUK, per kelompok pekerjaan. |
| **FR.IA.02** | Tugas Praktik Demonstrasi (TPD) | Observasi langsung | Demonstration task scenario, written with STAR narrative approach; materials, tools, SOP referenced. |
| **FR.IA.03** | Pertanyaan Mendukung Observasi | Observasi langsung | Follow-up questions tied to the demonstration, with a more detailed assessor guide. |
| **FR.IA.04A** | **DIT — Daftar Instruksi Terstruktur** | Kegiatan terstruktur | See §2. Scenario / case study with data-information, scope of discussion, instructions to the asesi, and focus points for the presentation. Prepared by the assessor (from the MUK), *given to* the asesi, who then produces a paper/work and presents it. |
| **FR.IA.04B** | Penilaian Proyek Singkat atau Kegiatan Terstruktur | Kegiatan terstruktur | See §2 and the specimen. Assessor-filled *after* the presentation. Fields: scheme no., TUK (Sewaktu/Tempat Kerja/Mandiri), judul kegiatan terstruktur, asesor, asesi, tanggal; per-row: lingkup penyajian, kesesuaian dengan standar (unit/elemen/KUK), daftar pertanyaan, tanggapan asesi, Ya/Tdk; closing: "Asesi telah memenuhi/belum memenuhi pencapaian seluruh kriteria unjuk kerja", recommendation K/BK, signatures + assessor No. Reg (MET). Plus a Penyusun/Validator block. |
| **FR.IA.05A / 05B / 05C** | Pertanyaan Tertulis Pilihan Ganda / Lembar Kunci Jawaban / Lembar Jawaban (DPT) | Tes tulis | 05A: numbered MC questions (a–d; may also be benar/salah or matching). 05B: key table (No. → Jawaban, typically 10 items in specimens). 05C: asesi answer sheet with per-item K/BK recommendation. **Suffix mapping varies by LSP — see §0.5.** |
| **FR.IA.06A / 06B / 06C** | Pertanyaan Tertulis Esai / Lembar Kunci Jawaban / Lembar Jawaban (DPT) | Tes tulis | 06A: "Jawab semua pertanyaan di bawah ini" (essay prompts: uraikan, jelaskan, mengapa, bagaimana, bandingkan, simpulkan). 06B: key — expected answer points per question. 06C: asesi's written answers, assessed per item K/BK. **Key rule on the form itself: "Pelatih/Asesor harus menggunakan kebijaksanaan (professional judgement) saat menentukan apakah jawaban yang diberikan oleh Asesi dapat diterima atau tidak."** I.e. essay marking is *not* mechanical string-matching; the key is a guide, the assessor judges acceptability. This is a hard constraint on any auto-scoring design: AI scoring can only *recommend* per item; the assessor decides. |
| **FR.IA.07** | Daftar Pertanyaan Lisan (DPL) | Tes lisan / tanya jawab | Oral questions, used as additional evidence (T). |
| **FR.IA.08** | Ceklis Verifikasi Portofolio (CVP) | Verifikasi portofolio | List of portfolio evidence per unit/KUK, judged against VATM (see §5); column for "substansi yang akan diklarifikasi dengan wawancara" — the feed into IA.09. |
| **FR.IA.09** | Pertanyaan Wawancara (PW) | Verifikasi portofolio (interview) | Interview questions copied/traced from IA.08 + aspects critical + 5 dimensions of competency; per portfolio evidence item. Filled by the assessor during the interview; records the asesi's answers and whether each item is VATM. |
| **FR.IA.10** | Verifikasi Pihak Ketiga (VPK) | Verifikasi portofolio | Third-party confirmation (e.g. supervisor/employer) of the portfolio evidence. |
| **FR.IA.11** | Ceklis Review Produk | Review produk | New form in MUK 2023. Checklist for reviewing a work product as evidence. |

### 1.4 Assessor administration (FR.AK) — before / during / after

| Form | Official name | Who fills | When | Contents |
|---|---|---|---|---|
| **FR.AK.01** | Persetujuan Asesmen dan Kerahasiaan | Asesor + asesi (both sign) | Pra-asesmen / start of assessment | Asesi confirms they were briefed on the plan/process; asesor declares confidentiality — will not disclose assessment work to anyone except authorised parties. |
| **FR.AK.02** | Formulir Rekaman Asesmen Kompetensi | Asesor | Decision stage, per asesi | The per-asesi decision record: unit-by-unit K/BK, evidence summary, recommendation. This is the *decision* document; AK.05 is the *report* of many AK.02s. |
| **FR.AK.03** | Umpan Balik dan Catatan Asesmen | Asesi (+ asesor) | After decision, at closing | Asesi's feedback on the assessment process; also used to record feedback given *to* the asesi (gaps, suggestions). |
| **FR.AK.04** | Formulir Banding Asesmen | Asesi (if disputing) | After decision | Appeal against an unfair decision / procedural deviation. Must be *shown/explained* to the asesi during pra-asesmen (assessors are instructed to show the form, not just mention it). Decided by LSP's banding committee, not the original assessor. |
| **FR.AK.05** | **Laporan Asesmen** | Asesor | After all asesi in the batch are decided; submitted to TUK/LSP | See §3.3. Aggregate report: scheme, TUK type, asesor name + No. Reg (MET), date, table of asesi with K/BK recommendation + notes, overall notes (e.g. "Asesi sangat kooperatif", "Tidak ada penolakan hasil asesmen"). |
| **FR.AK.06** | Meninjau Proses Asesmen | Asesor | After AK.05 | Review of the assessment process itself (what went well / improvements). |
| **FR.AK.07** | Ceklis Penyesuaian yang Wajar dan Beralasan | Asesor (+ asesi) | Pra-asesmen | Reasonable adjustments (disability, language, environment, etc.) — whether any planned method/instrument needs adjusting, and what adjustment applies. |

Other pre-assessment artefacts (not FR-numbered): **Surat Tugas / Surat Penugasan / Surat Perintah Tugas** from the LSP director — see §3.1.

---

## 2. The two routes — training-product vs experience-based

### 2.1 How BNSP frames the choice

MUK 2023 defines **5 asesi characteristics** and maps each to a method + instruments:

| Asesi characteristic | Evidence type | Method | Instruments |
|---|---|---|---|
| 1. Peserta pelatihan, tertelusur dengan standar | Bukti kompetensi kerja dari hasil pelatihan (L = langsung) | Observasi langsung | IA.01, IA.02, IA.03 (+ IA.05/06/07 as additional evidence T) |
| 2. Peserta pelatihan, belum tertelusur / **belum memiliki bukti kinerja** | Bukti kinerja: belum ada (L) + bukti tambahan (T) | **Kegiatan terstruktur** | **IA.04A + IA.04B** (+ IA.05/06/07) |
| 3. Pekerja berpengalaman, tertelusur dengan standar | (direct evidence available) | Observasi langsung | IA.01–03 |
| 4. Pekerja berpengalaman, **belum tertelusur** dengan standar | Bukti tidak langsung (TL) — portfolio of work experience | **Verifikasi portofolio** | IA.08, IA.09, IA.10, IA.11 |
| 5. Belajar mandiri | (mixed) | Per MAPA | Per MAPA |

So the user's two routes are real, but the official split is finer: it is about **traceability of evidence to the standard + whether the asesi already has performance evidence**, not simply "training vs experience". A training graduate whose training is traceable to the SKKNI may go the observation route; an experienced worker with traceable evidence may also be observed. The system should capture the MAPA "potensi asesi" classification per asesi, not assume route from a single flag.

### 2.2 DIT (FR.IA.04A) — what it actually is

- **Full name:** Daftar Instruksi Terstruktur (Structured Instruction List).
- **Purpose:** a structured activity for certification schemes at **KKNI Level 4 and above**, where the work is dominantly "skill thinking" (kerja otak) and therefore cannot be observed directly as a physical demonstration. Examples in MUK 2023: simulation / role play, short project explanation, case study.
- **Contents (assessor prepares, before the assessment):** scenario / case-study narrative written with the **STAR** approach — **S**ituation (situasi/kondisi), **T**ask (tugas yang harus dilakukan), **A**ction (aksi dalam rangka mencapai tugas), **R**esult (hasil yang didapat); plus data/information, scope of discussion, and instructions to the asesi. It is traced to the kelompok pekerjaan in the peta kelompok pekerjaan and to critical aspects.
- **Asesi's job:** work on the scenario, produce a paper / work product, and **present** it.
- **Assessment:** FR.IA.04B, during/after the presentation, plus follow-up questions (DPT/DPL) if needed. The assessor copies the "fokus presentasi" from 04A into the "lingkup penyajian" column of 04B, and may add pointer questions per scope.
- **What DIT is not:** it is not a take-home essay the asesi writes alone and submits for marking; the presentation + elaboration (tanya jawab) is an assessed part. Any plagiarism comparison of DIT papers is therefore *supporting* evidence for the assessor, not a substitute for the presentation judgement — and a similarity flag must never auto-fail an asesi.

### 2.3 Portfolio route (FR.IA.08 → 09 → 10)

- **FR.IA.08:** desk evaluation — assessor checks each portfolio document against the standard and the VATM rules, marks which are sufficient, and notes what needs clarification by interview.
- **FR.IA.09:** the interview itself — questions traced to IA.08 and critical aspects, covering the 5 dimensions of competency (see §2.4). This is the form the user's interview prompt targets.
- **FR.IA.10:** third-party verification of the same evidence.
- **FR.IA.11:** product review, where a work product is the evidence.
- Typical portfolio evidence (MUK 2023): surat tugas + job description, summary reports of work performed, other relevant records, reference/recommendation letters, work videos/photos, logbooks/log sheets, report sheets, life-experience records.
- Note the user's interview prompt (`prompt_wawancara_k3.md`) is built for the **04A route** (coverage matrix of 04A focus points + presentation transcript), not the 09 route. For the 09 route the input is IA.08 gaps, not a presentation. The system needs two different prompt pipelines.

### 2.4 The 5 dimensions of competency (used in IA.04B, IA.09, and the user's prompt)

As used in the user's prompt (labels TS / TMS / CMS / JRES / TrS) and in BNSP modules:

| Label | Dimension | Question focus |
|---|---|---|
| TS | Task Skills — keterampilan tugas | Can the person perform the specific task? |
| TMS | Task Management Skills — pengelolaan tugas | Can they manage several tasks at once / prioritise? |
| CMS | Contingency Management Skills — menangani keadaan darurat | Can they handle unexpected problems / emergencies? |
| JRES | Job/Role Environment Skills — lingkungan kerja | Do they fit the work culture, rules, location, permits? |
| TrS | Transfer Skills — transfer pengetahuan | Can they apply it to another context/field? |

VERIFIED as the standard 5-dimension set in BNSP assessor material; the exact Indonesian wording of the labels varies slightly between modules, so keep the codes (TS/TMS/CMS/JRES/TrS) as the stable key.

---

## 3. End-to-end assessor workflow

### 3.1 Before assessment day

1. **Asesi registers at LSP/TUK:** fills APL.01 + APL.02, attaches KTP, ijazah, CV, pas foto, training certificates, portfolio (SK kerja, laporan kerja, uraian jobdesc, prior BNSP certificate if any). *Live evidence:* the user's "Kelompok Asesi" sheet (12 Nov 2026 batch, 23 asesi) tracks exactly these columns — APL 01, APL 02, KTP, IJAZAH, PAS FOTO, CV, SERTIFIKAT PELATIHAN, PORTOFOLIO (Sertifikat BNSP / Surat Keterangan Kerja / Laporan Kerja / Uraian Jobdesc) — with a KETERANGAN column of gaps. Most common gaps in that batch: APL 02, CV, and SK Kerja missing. Several APLs were sent as unsigned Word files instead of signed scans.
2. **LSP verifies completeness** (admin) and the assessor verifies APL.02 in pra-asesmen.
3. **LSP issues Surat Tugas / Surat Penugasan / Surat Perintah Tugas** (signed by Ketua/Direktur LSP) naming the assessor(s) — full name **with titles/degrees**, No. Reg (MET.xxxxxxxxxx), registration/BNSP number, scheme, TUK, venue, dates, number of asesi, and the duty (MAPA / melaksanakan asesmen / MKVA — sometimes separate letters per duty). One letter can name several assessors; one assessor can appear on several letters. Real examples verified: LSP Pertanian (No. 30/LSP-P/02/2023), LSP Pariwisata Jana Dharma Indonesia (No. 1877/LSPP-JDI/TGS.22/XI/2023), LSP-DATA (No. 200/ST.UJK.LSP-DATA/VI/2024 — requires a written report to the director max 3–5 working days after the assessment). Legal basis cited on the letters: PP 10/2018, Pedoman BNSP 201 (Peraturan BNSP 1/BNSP/III/2014), Peraturan BNSP 09/BNSP.301/XI/2013 (Pedoman Pelaksanaan Asesmen Kompetensi), 13/BNSP.218/XII/2013 (asesor lisensi).
4. **Assessor plans (MAPA):** peta kelompok pekerjaan → MAPA.01 → MAPA.02 → prepare instruments (IA.04A scenario, IA.05/06 question sets + keys, IA.08 checklist, IA.09 interview questions). Plan approved by LSP (Manager Sertifikasi).
5. **Pra-asesmen / konsultasi pra-asesmen:** assessor meets asesi, explains the plan (MAPA.01), methods, TUK safety rules, rights (banding via AK.04 — form shown), reasonable adjustments (AK.07), and both sign **AK.01** (persetujuan + kerahasiaan).

### 3.2 Assessment day (pengumpulan bukti)

- **Briefing + AK.01 signing → evidence collection per MAPA:**
  - Observation route: IA.01/02/03 (+ IA.05/06/07 as additional evidence).
  - Structured-activity route: asesi presents DIT work → assessor scores IA.04B live, asks follow-up questions (written/oral as planned).
  - Portfolio route: desk evaluation IA.08 → interview IA.09 → third-party IA.10.
  - Written test: asesi answers IA.05C (MC) and/or IA.06C (essay); assessor marks against IA.05B / IA.06B.
- **Evidence quality rules (VATM)** applied to every piece of evidence: **V**alid (relevant to the element/KUK), **A**sli (authentic — the asesi's own work), **T**erkini (current), **M**emadai (sufficient). Assessment principles: **VRFF** — Valid, Reliabel, Fleksibel, Fair (adil).
- **Decision (AK.02):** per asesi, per unit, K or BK, based on whether all KUK are met. Assessor records the decision, gives feedback, asesi gives feedback (AK.03).

### 3.3 After assessment — FR.AK.05 and what happens next

- **FR.AK.05 — Laporan Asesmen** (verified specimen: Scribd "AK 5", Tukang Bangunan Gedung Level 1, 26 Mei 2023, asesor Waras Budi Hartawan, ST, No. Reg MET 000.004807 2020):
  - Header: scheme title + number, TUK type (Sewaktu / Tempat Kerja / Mandiri — tick one), assessor name, date.
  - Body: table — No. | Nama Asesi | Rekomendasi (K / BK) | Keterangan (e.g. "Kompetensi Asesi cukup").
  - Footer/notes: e.g. "Asesi sangat kooperatif selama proses asesmen berlangsung", "Tidak ada penolakan hasil asesmen", assessor name / No. Reg / signature / date.
  - **It is a per-assessor, per-batch report** (one AK.05 per asesor per scheme/date/TUK in the specimen; where several assessors share a batch, each submits their own, and the LSP consolidates).
  - Submitted to **TUK / LSP** (with supporting documents), per the MA module: "Lengkapi FR.AK.05 laporan asesmen … Serahkan FR.AK.05 dan dok pendukung kepada pihak TUK/LSP", then **FR.AK.06** (meninjau proses asesmen).
- **What AK.05 is not:** it is a *recommendation* (rekomendasi asesor), not the certification decision. The **Komite Teknis / Rapat Pleno LSP** verifies all berkas and makes the independent certification decision; only then is the competent asesi's data submitted to BNSP's system for blanko sertifikat printing (with Garuda logo and national registration number). The system must therefore model: `AK.05 rekomendasi` → `pleno / keputusan sertifikasi` → `pengajuan ke BNSP` as separate stages, and must not present AK.05 as "sertifikat terbit".
- **Other closing outputs:** Berita Acara Asesmen (BAA) — signed by assessor, asesi, and TUK representative, recording chronology, evidence summary, special notes, and the initial K/BK recommendation. (Described in secondary sources; the exact BAA template is LSP-specific — UNCONFIRMED as a BNSP-standard form.)
- **Re-assessment / appeal:** BK on any unit → asesi may take **asesmen ulang** on only the BK units (secondary sources say typically within 1–3 months by agreement — UNCONFIRMED as a BNSP-wide rule; treat as LSP-configurable). Appeal via AK.04 to the LSP banding committee.

---

## 4. AK3 Umum / Ahli K3 Umum

### 4.1 Scheme and standard — VERIFIED

- **Standard:** SKKNI Bidang K3, Jabatan Kerja Personil Keselamatan dan Kesehatan Kerja — **Keputusan Menteri Ketenagakerjaan No. 38 Tahun 2019**. (Multiple independent LSP/training sources agree; one provider page cites it as "SKKNI Nomor 38 Tahun 2019".)
- **13 units** (codes M.71KKK01.001.1 – 013.1):

| No. | Kode unit | Judul unit |
|---|---|---|
| 1 | M.71KKK01.001.1 | Merancang Strategi Pengendalian Risiko K3 di Tempat Kerja |
| 2 | M.71KKK01.002.1 | Merancang Sistem Tanggap Darurat |
| 3 | M.71KKK01.003.1 | Melakukan Komunikasi K3 |
| 4 | M.71KKK01.004.1 | Mengawasi Pelaksanaan Izin Kerja |
| 5 | M.71KKK01.005.1 | Melakukan Pengukuran Faktor Bahaya di Tempat Kerja |
| 6 | M.71KKK01.006.1 | Mengelola Pertolongan Pertama pada Kecelakaan Kerja (P3K) di Tempat Kerja |
| 7 | M.71KKK01.007.1 | Mengelola Tindakan Tanggap Darurat |
| 8 | M.71KKK01.008.1 | Mengelola Alat Pelindung Diri (APD) di Tempat Kerja |
| 9 | M.71KKK01.009.1 | Menerapkan Program Pelayanan Kesehatan Kerja |
| 10 | M.71KKK01.010.1 | Mengelola Sistem Dokumentasi K3 |
| 11 | M.71KKK01.011.1 | Menerapkan Manajemen Risiko K3 |
| 12 | M.71KKK01.012.1 | Mengevaluasi Pemenuhan Persyaratan dan Prosedur K3 |
| 13 | M.71KKK01.013.1 | Melakukan Investigasi Kecelakaan Kerja |

- **Note on an older variant:** one provider (Midiatama, Batch 75) lists a *different, shorter* 9-unit set mixing M.71KKK00.001.1/002.1 codes — that appears to be an older or different scheme packaging. The 13-unit Kepmenaker 38/2019 set is the one corroborated by 4+ independent sources. **The system must not hard-code the unit list: the active packaging is whatever the LSP's current scheme document says.** Moza to confirm the scheme number and KKNI level with the LSP.
- **KKNI level for AK3 Umum: UNCONFIRMED from the sources read.** The scheme is described as Level 4+ work ("skill thinking") in the MUK deck's general rule for kegiatan terstruktur, which is consistent with using DIT for AK3U, but no source in this research states the scheme's KKNI level outright. Do not assert a level.
- **BNSP certificate ≠ Kemnaker appointment:** a BNSP Ahli K3 Umum competency certificate does **not** automatically replace the Kemnaker SK Penunjukan Ahli K3 (a separate Kemnaker process). Training providers state this explicitly; the system must not imply otherwise in any certificate wording.

### 4.2 What a written-test master key looks like (FR.IA.06B)

- **06A (soal):** essay prompts per unit, "Jawab semua pertanyaan di bawah ini".
- **06B (kunci):** per question, the expected answer points / acceptable content. It is a *guide for professional judgement*, not a verbatim string to match — the form instructs the assessor to use judgement on whether an answer is acceptable.
- **06C (lembar jawaban):** the asesi's written answers, with per-item K/BK recommendation by the assessor and signatures.
- **Pass mark / scoring rubric for AK3U written test: NOT FOUND.** No source in this research states a numeric pass threshold, a per-item weighting, or how many questions per unit the AK3U MUK uses. The user's prompts also do not state one. **This is a must-confirm item:** the threshold and rubric live in the LSP's scheme/MUK document, not in BNSP's generic forms.
- **05B (MC key)** is a simple No. → letter table (specimens show 10 items); 05C is the asesi answer sheet with per-item K/BK.

### 4.3 The user's two prompts — what they actually assume

- `prompt_wawancara_k3.md` (RCTFA): assumes per-candidate inputs = FR.IA.04A + presentation transcript/recording + profile (CV, portfolio, education, work history); outputs a coverage matrix (Terpenuhi/Sebagian/Belum Dibahas per focus point), gap-filling questions labelled by the 5 dimensions, a **13-question** bank "based on the presentation, NOT the ideal answer", and a readiness estimate (% + Kompeten/Belum Kompeten/"Kompeten Bersyarat"). Legal references cited: UU 1/1970, UU 13/2003, PP 50/2012 (SMK3), UU 32/2009, plus sectoral regulations. **Currency of those regulations was not re-verified in this research** — e.g. UU 13/2003 has been amended (UU 6/2023 / Perppu Cipta Kerja) and PP 50/2012 remains the SMK3 reference; the system should not hard-code a statute list without a per-scheme legal-reference table that Moza/LSP maintains.
- `prompt_test_tulis.md`: compares FR.IA.06B (master) vs several FR.IA.06C (asesi answers), per-asesi verdict correct / partially correct / incorrect with explanation in Bahasa Indonesia, side-by-side master vs student answer, plus a cross-asesi similarity scan (shared phrasing, identical errors, plagiarism judgement: coincidental vs indicative of copying), never mixing up identities, full report in Bahasa Indonesia in Markdown. **This prompt's 06B/06C mapping matches MUK 2023 numbering (§0.5).**

---

## 5. Plagiarism / cheating, identity verification, record retention

### 5.1 Plagiarism / cheating — what is official, what is not

**VERIFIED (official BNSP material):**
- **VATM — "A = Asli":** evidence must be the asesi's own authentic work, "bukan jiplakan atau karya orang lain", evidenced by signature or supervisor verification. A copied DIT paper or copied essay answer fails the **Asli** rule — the correct system behaviour is to flag it as a VATM failure for the assessor to judge, not to auto-score it zero.
- **Assessor's duty:** collect quality evidence; if evidence is not VATM, follow up (additional evidence / interview) — the MA module's flow is "BELUM MEMADAI → pengumpulan bukti berkualitas" via FR.AK.03 feedback, not instant disqualification.
- **Remote assessment (AJJ/SJJ) rules** (LSP Gizi tata tertib, citing BNSP guidance): asesi is prohibited from using unauthorised help from another party or leaving the session without permission; the assessor **may stop the assessment** if any form of cheating occurs; 360° camera checks are used. This is LSP-level implementation of BNSP remote-assessment rules.

**UNCONFIRMED / NOT FOUND (do not design as if they were rules):**
- No BNSP-wide numeric similarity threshold (e.g. "X% = plagiarism"), no mandated similarity tool, and no standard sanction tariff for copy-paste between asesi were found in official sources. Any threshold in the system must be presented as an **assessor-configurable flag** ("similarity score + shared-error evidence for the assessor"), with the decision remaining the assessor's.
- No BNSP rule was found that identical DIT answers automatically invalidate a whole batch. The system must keep per-asesi decisions independent and auditable.

### 5.2 Identity — name on the certificate must match the ID

**VERIFIED:**
- APL.01 is the source of the certificate data ("data ini jadi dasar sertifikat Anda"); KTP is the mandatory identity document in the APL.01 checklist.
- LSP guidance warns explicitly: "Data tidak konsisten — nama di formulir berbeda dengan KTP; sertifikat akan mengikuti data yang salah." Certificate verification guidance likewise says the holder's name must match the identity document used.
- The BNSP certificate database is searchable by name as on the ID card or by registration/certificate number; a name mismatch breaks verification.

**UNCONFIRMED / needs Moza + LSP to confirm:**
- No official BNSP clause was found in this research stating the *exact* canonicalisation rule (e.g. "exactly as on KTP including titles, degrees, clan/family names, and spelling"). Whether titles (S.K.M., M.K.M., drg., Ns., A.Md.Kep., etc.) go on the certificate, and how they are ordered, is **LSP/scheme practice**. The user's live sheet shows asesi names *with* titles (e.g. "Susilo Heni S. S.K.M", "drg. Dewi Nofinawati", "Ns. Niwan .S.Kep") — so the system needs a **canonical-name workflow**: KTP name (OCR/manual) vs surat-tugas name vs APL.01 name, with a human-confirmed "nama tercetak di sertifikat" field and a mismatch report. It must not auto-merge or auto-correct names.
- Also unconfirmed: whether the LSP in question uses the KTP name or the ijazah name as canonical when they differ. Ask the LSP.

### 5.3 Record retention — conflicting figures, no single verified rule

| Claim | Source | Strength |
|---|---|---|
| Remote-assessment video recordings must be stored on the LSP archive server **min. 3 years** for surveillance-audit evidence | `bnsp.net` (secondary, SEO-style) | Weak — not bnsp.go.id |
| Assessment documents & records: **certificate validity + 5 years**; video/audio & CCTV: **4 years** after the certification decision (except under appeal); certificate registry data: permanent | LSP TRI privacy policy (UU 27/2022 + BNSP + ISO/IEC 17024) — one LSP's own policy | Medium — real LSP policy, not a BNSP rule |
| Digital archives retained **up to 3.5 years** per regulations | SERPRO Instagram promo for LSP archiving | Weak — vendor marketing |
| BNSP surveillance audit (min. 1×/year) checks archiving of APL-01/APL-02 and berita acara | `bnsp.net` (secondary) | Weak |

**Conclusion: no single BNSP retention period was verified from an official source in this research.** Design retention as **configurable per document type** (default suggestion: follow the LSP's own documented policy; the strictest figure found is cert-validity + 5 years for records), with deletion only by logged, authorised action and a berita acara for physical destruction. Also note **UU No. 27 Tahun 2022 (Pelindungan Data Pribadi)** applies to KTP scans and personal data — the system must treat KTP/ijazah as sensitive personal data (access control, no public links, encryption at rest, purpose limitation).

### 5.4 Related rules worth carrying into the design

- **PP No. 10 Tahun 2018** — BNSP as the personnel certification authority; **PP No. 23 Tahun 2004** — BNSP's establishment (cited on older material).
- **Pedoman BNSP 201** (Peraturan BNSP 1/BNSP/III/2014, Persyaratan Umum LSP) and **Pedoman BNSP 202** — the LSP quality-system backbone; **Peraturan BNSP 09/BNSP.301/XI/2013** — Pedoman Pelaksanaan Asesmen Kompetensi; **KEP.2343/BNSP/XI/2023** — MUK 2023 (cited by sertifikasi.app as the MUK 2023 basis); **SE Ketua BNSP 1/BNSP/I/2024** — MUK 2023 implementation; **KEP.140/BNSP/I/2024** — assessor competency modules/RCC 2023.
- **ISO/IEC 17024** — the conformity-assessment standard behind LSP quality systems (impartiality, confidentiality, complaints/appeals). Relevant to: assessor conflict of interest (an assessor must not assess their own relatives/employees — a check the system should support, though the exact rule text was not pulled in this research), confidentiality (AK.01), and appeals (AK.04).

---

## 6. The user's live artefacts — what was actually checked

| Artefact | Result |
|---|---|
| GitHub `https://github.com/danste-kun/asesorkompetensi` | **Repository is empty** (GitHub page, fetched 17 Nov 2026). No code, docs, or README to analyse. The system will be built from scratch. |
| Google Sheet "Kelompok Asesi" (`1AqNMp-YU4x1R9RHESo45WYGI-BZtYodUK-dPzvpPDbQ`) | **Opened and read.** Title: "6. 12 November 2026 - Informasi Kelengkapan Asesmen", updated 17 Nov 2026 13:35. 23 asesi rows. Columns: NO, NAMA ASESI, checklist APL 01 / APL 02 / KTP / IJAZAH / PAS FOTO / CV / SERTIFIKAT PELATIHAN / PORTOFOLIO (Sertifikat BNSP, Surat Keterangan Kerja, Laporan Kerja, Uraian Jobdesc), KETERANGAN. Dominant gaps: APL 02, CV, SK Kerja. Notes also flag quality issues: pas foto with glasses reflecting light, pas foto not showing teeth, APL sent as unsigned .docx instead of signed scan. **This sheet is the de-facto APL-completeness tracker — the system should import/replace it, not duplicate it.** |
| Drive folder "Pelatihan Ahli K3 umum Sertifikasi BNSP tahun 2026" (`1UrsbAjehLDuK3fHk2HItPgziWN8TOchy`) | **Not opened in this research** (folder listing not retrievable via text fetch). Contents, size, and structure unverified. Needed for the Drive-scan design: folder size / file count / nesting depth. |
| Drive folder "Persyaratan Pelatihan AK3 Umum BNSP" (`1e3XkvyAHZeQ3KdTs46IrqVTGrDeOLQHR`) | **Not opened in this research.** Same caveat. |

---

## 7. Design implications (for the PRD — stated as implications, not decisions)

1. **Form-version configuration is mandatory.** IA.05/06 suffix meanings, the AK3U unit list, the pass threshold, the 04B question count, and the retention periods all vary by LSP/MUK version. Nothing in §1 may be hard-coded.
2. **Two distinct AI pipelines:** (a) 04A/DIT pipeline — coverage matrix vs presentation + personalised gap questions + 13-question bank; (b) 06B/06C pipeline — per-item correct/partial/incorrect vs the key + cross-asesi similarity report. Both must output Bahasa Indonesia, keep identities exact, and mark AI output as *recommendation* — the assessor's professional judgement (explicit on the 06 form) is the decision.
3. **Similarity is a flag, not a verdict.** Report per-question overlap, shared unique errors, and named pairs; never auto-fail, never auto-merge identities.
4. **Canonical identity workflow:** KTP name vs APL.01 name vs surat-tugas name → human-confirmed certificate name, with a mismatch report before AK.05 is finalised.
5. **AK.05 is per-assessor per-batch**, feeding a pleno stage the assessor does not control. Model the handoff explicitly (AK.05 → TUK/LSP → pleno → BNSP submission).
6. **Google Drive ingestion must be batched/paginated** (Drive API `files.list` with page tokens, per-folder queues) — the user's own warning about a single long folder with many assessors' data. No official Drive limit was researched here; the batching requirement comes from the user's operational experience, not from BNSP.
7. **Audit trail everywhere:** every AI suggestion, every K/BK decision, every name confirmation, and every export must be logged with actor + timestamp — this is what a surveillance audit checks (APL-01/02 archiving, berita acara, assessor qualification).

---

## 8. Gaps — Moza (and the LSP) must confirm

1. **LSP identity + scheme document:** which LSP, scheme number, KKNI level, and MUK version (2023?) governs this AK3U batch? Get the scheme PDF — it fixes the unit list, pass threshold, and instrument set.
2. **FR.IA.04B:** does the LSP want the official presentation-assessment 04B, the user's 13-question bank, or both (and if both, under what form name)?
3. **"Kompeten Bersyarat":** is this an LSP-accepted status or must it be dropped?
4. **Written-test rubric:** pass mark, per-question weighting, number of questions per unit, and whether 05 (MC) is also used for AK3U or only 06 (esai).
5. **06 suffix mapping** in the LSP's actual blank forms (06B = key? confirm against the LSP's own PDFs).
6. **Certificate name rule:** KTP-exact? Titles included, and in what order? What wins when KTP ≠ ijazah?
7. **Surat tugas:** who issues it (LSP director?), how many assessors per letter, and does Moza receive one letter per batch or per asesi group?
8. **Plagiarism policy:** does the LSP have a written similarity threshold or sanction? If not, what should the system's flag thresholds default to, and who judges?
9. **Retention:** the LSP's documented retention schedule (per document type) + PDP handling for KTP scans.
10. **Drive folders:** actual file count / size / nesting of the two Drive folders, and whether the "TUK-altered structure" variant has a known example to test against.
11. **Regulation currency:** confirm the statute list for the OHSE prompts (UU 13/2003 as amended, PP 50/2012, UU 1/1970, UU 32/2009) with the LSP's MUK, rather than hard-coding it.
12. **Re-assessment window** for BK units (1–3 months?) and the banding (AK.04) deadline, per the LSP.

---

## Sources

**Official / primary**
- BNSP, *Sosialisasi Penerapan Perangkat MUK Versi 2023* (SE Ketua BNSP No. 1/BNSP/I/2024, Jakarta, 7 Feb 2024) — https://bnsp.go.id/sisfo/dokumen/eyJpdiI6IittM05mTUN0UlJzTHYzRnBGTXBsWlE9PSIsInZhbHVlIjoiZmtUY0ZaUEltZXZIRHA2bVA3WklFZz09IiwibWFjIjoiNzI5MTBkYjdkNzViNjUxYjFjOGZjZjgyMDc0MDlkMjJmNDkzODk0MjJhNGM3MGU3ODA1MWE3Yjg1M2Q1ZGE2MCIsInRhZyI6IiJ9
- BNSP, *Modul Pelatihan Asesor Kompetensi — Melaksanakan Asesmen (MA)*, daftar isi + form index (FR.IA.05A–06C definitions) — https://bnsp.go.id/sisfo/dokumen/eyJpdiI6IkRlYzNUbCsyVnRITllYSVJySElxaWc9PSIsInZhbHVlIjoiK0RlVDN1eE9YYWY0SStuMXRMM0FUdz09IiwibWFjIjoiMjBmYmQ3MGYzNDQ5NWEyMjQ4OGNkODBkNjNhMzE3NTZlMGFkZGEwMmRmODExYjQwMTE3ZmNlMmEzOWY3MDgxNCIsInRhZyI6IiJ9
- BNSP, *Juknis PSKK Tahun 2024* (surat tugas asesor Form 13; pre-assessment preparation) — https://bnsp.go.id/sisfo/dokumen/eyJpdiI6ImsrYmVYNEw5QVVTaUFVb3l2TThQbXc9PSIsInZhbHVlIjoiTzZFdEdaekV0M1BLdDhsWmQ1bjJMQT09IiwibWFjIjoiNzQxMGExOWQ4NzFlZTliZDlhZDUyNmRjZGMzMDQyY2Y4YjExZjhmY2RjOTEzYWM0ODkzMDI0MjU1YzI1OTFmZCIsInRhZyI6IiJ9

**Specimen forms / LSP procedure pages**
- FR.IA.04B specimen (Junior Ticketing Officer) — https://smknegeri3kotabima.sch.id/wp-content/uploads/2025/10/13.b.-FR.IA_.04B.-Penilaian-Proyek-Singkat-atau-Kegiatan-Terstruktur-Lainnya.pdf
- LSP P1 SMKN 8 Jakarta, *Alur & Prosedur Sertifikasi Kompetensi* (APL.01/02 → pra-asesmen → TUK → AK.02 → pleno → BNSP) — https://lspsmkn8jakarta.web.id/alur-sertifikasi/
- LSP-DATA, *Surat Perintah Tugas* No. 200/ST.UJK.LSP-DATA/VI/2024 — http://repository2.uph.edu/34753/28/Surat%20Tugas%20Asesor%20LSP%20DATA_Riswan%20Efendi%20Tarigan_290624_260624.pdf
- LSP Pertanian, *Surat Penugasan* No. 30/LSP-P/02/2023 — https://repo.polteklpp.ac.id/id/eprint/296/1/S.%20Penugasan%20Asesor%20POLB%20MEDAN%20Tgl.%2001-04%20Maret%202023%20PERBAIKAN.pdf
- LSP Pariwisata Jana Dharma Indonesia, *Surat Perintah Tugas* No. 1877/LSPP-JDI/TGS.22/XI/2023 — http://repository.upy.ac.id/9989/1/Surat%20Perintah%20Tugas%20TUK%20TUK.pdf
- FR.AK.05 specimen (Tukang Bangunan Gedung Level 1, 26 Mei 2023) — https://id.scribd.com/document/654134746/AK-5
- LSP TRI, *Kebijakan Pelindungan Data Pribadi* (retention: records cert-validity + 5 years; video 4 years) — https://lsptri.id/kebijakan-pelindungan-data-pribadi
- LSP Gizi, *Tata Tertib & Mitigasi Risiko Sertifikasi Jarak Jauh* (cheating rules) — https://www.lspgizi.id/mitigasi-risiko-sjj
- LSP-LII, *Buku Panduan SILSP* (variant IA.06 suffix labelling) — https://lsp-lii.com/BUKU-PANDUAN-SILSP-UNTUK-ADMINISTRATOR.pdf

**AK3 Umum scheme (training-provider pages — corroborated across 4+ sources, not BNSP itself)**
- https://cakrabiwa.co.id/sertifikasi-ahli-k3-umum-by-bnsp/ (SKKNI 38/2019, 13 units)
- https://indonesiasafetycenter.org/pelatihan-ahli-k3-umum-bnsp/ (SKKNI Kepmenaker 38/2019; BNSP cert ≠ Kemnaker SK penunjukan)
- https://nevis.co.id/pelatihan/pelatihan-ahli-k3-umum-sertifikasi-bnsp-online/ (13 units)
- https://bisasafety.id/pelatihan-dan-sertifikasi-ak3u-bnsp-online/ (13 units, Kepmenaker 38/2019)

**BNSP assessor training material (SlideShare / Scribd mirrors of BNSP modules — useful, not official)**
- *Implementasi Perangkat MUK 2023* — https://www.slideshare.net/slideshow/01-implemtasi-perangkat-muk-pada-s-pptx/289366887
- *Materi MUK VERSI 2023* — https://www.slideshare.net/slideshow/materi-muk-pptx-digunakan-sebagai-refrensi-asesor-kompetensi/284356144
- *Modul Pelatihan Asesor Kompetensi — Melaksanakan Asesmen* — https://www.slideshare.net/slideshow/modul-pelatihan-asesor-kompetensi-episode-melaksanakan-asesmen/271607039
- *Melaksanakan Asesmen P.85ASM00.003.2* (FR.AK.01–06 list) — https://www.slideshare.net/slideshow/3-melaksanakan-asesmen-p85asmoo0032-melaksanakan-asesmen/266343742

**User's own artefacts (verified live 17 Nov 2026)**
- GitHub repo (empty) — https://github.com/danste-kun/asesorkompetensi
- Google Sheet "6. 12 November 2026 - Informasi Kelengkapan Asesmen" — https://docs.google.com/spreadsheets/d/1AqNMp-YU4x1R9RHESo45WYGI-BZtYodUK-dPzvpPDbQ/edit?usp=sharing
- Drive folders (links provided; contents not verified in this research) — https://drive.google.com/drive/folders/1UrsbAjehLDuK3fHk2HItPgziWN8TOchy?usp=sharing ; https://drive.google.com/drive/folders/1e3XkvyAHZeQ3KdTs46IrqVTGrDeOLQHR
- User prompts: `workspace/user/files/prompt_wawancara_k3.md`, `workspace/user/files/prompt_test_tulis.md` (read from workspace, not web sources)

**Secondary (low weight — used only where no better source was found)**
- https://lsptalentagemilang.co.id/blog/cara-daftar-sertifikasi-bnsp/ (APL-01/02; KTP-name warning)
- https://www.progres.co.id/artikel/sertifikasi-mplb3-bnsp-cara-daftar-masa-berlaku (APL-01/02)
- https://sertifikasi.app/ (MUK 2023 KEP.2343/BNSP/XI/2023; AK-05/pleno/SHA flow)
- https://bnsp.net/blog/tag/rekomendasi-virtual-office-jakarta (AK.05 description; VATM; re-assessment window; retention claims — **bnsp.net is not BNSP**)
