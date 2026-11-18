# FR.IA.06B working key — structure note (2026-11-18)

Source: `workspace/user/files/FR.IA.06B._AK3U.docx`, uploaded by Moza 2026-11-18 01:06,
alongside screenshots of the two existing AI Studio apps (Test Grader + K3 Expert AI).
SHA-256: e7cac40a782e340380ae509d3dda8d171e2a2ad28afc8424cb456359e868fd52. Size 217,769 bytes.

**This note records STRUCTURE ONLY. No key-answer text is reproduced here.**

## What this file is

The working master key for AK3U — the same file shown as "Schema A" in the Test Grader
screenshots. Header: FR.IA.06B LEMBAR KUNCI JAWABAN PERTANYAAN TERTULIS ESAI;
Skema Judul AHLI KESELAMATAN DAN KESEHATAN KERJA UMUM; Nomor SKM/2037/00013/2/2021/1;
TUK Sewaktu/Tempat Kerja/Mandiri; fields Nama Asesor / Nama Asesi / Tanggal.

## Format facts (verified by parsing, 2026-11-18)

- **NOT encrypted.** Plain OOXML docx (PK zip magic). Opens directly. This is different
  from the repo's SKEMA copy of the 06B blank, which is OLE-encrypted (verified 2026-11-17).
  Both copies exist: the encrypted blank in the repo, and this working key. The runtime
  password mechanism (password supplied per-request, never stored) still applies to
  encrypted copies and to other schemes.
- **13 key answers** in one table (14 rows incl. the "Jawaban:" header row) — matches
  06A's 13 essay questions and 07's 13 questions + keys.
- **Answers are prose**, not bullet point lists — acceptable points are embedded in
  sentences (e.g. the hazard-vs-risk definition answer). The partial-credit design
  (acceptable-points coverage) must extract points from prose; there is no pre-split
  point list in the file.
- **8 embedded images** (word/media image1–8, jpeg/png). The key doc carries images;
  extraction must flag embedded images rather than silently dropping them.
- **Penyusun/validator table** present (STATUS | NO. | NAMA | NOMOR MET | TANDA TANGAN DAN
  TANGGAL, 14 rows) — same table as in the other blanks.
- 118 non-empty paragraphs total; 4 tables (title, header, answers, penyusun/validator).

## Password mechanism (Moza, 2026-11-18)

- Each scheme's 06B ships with a PASSWORD Excel file holding the key password.
- The password is supplied by the assessor at runtime (key-upload step), never stored,
  never logged — as specced in docs v1.1/v1.2. The password VALUE is not recorded in
  any doc, note, or memory file.

## Reference apps in the same upload (screenshots)

- **AI Teacher's Assistant: Test Grader** — 06B master (Schema A) vs 06C student answers;
  tabs Summary / Detailed Comparison / Plagiarism Analysis. Judging shape: per-question
  Correct/Incorrect + Bahasa Indonesia explanation; per-student error summary
  ("Ringkasan Kesalahan"); plagiarism report is a separate qualitative analysis
  (per-student status Bersih / Waspada + reasoning, cross-sectional patterns). No overall
  percentage shown as the decision. 10 students in the screenshot batch; 13 questions.
  Assessor shown: Sri Mulyati.
- **K3 Expert AI / K3 Expert Interview Generator** — FR.IA.04B/FR.IA.09 + candidate
  profiles (CV, KTP, ijazah); runs on Gemini 3 Pro ("SKKNI Compliant", "Gemini 3 Pro
  Reasoning"). Model note: the docs specify GPT-4o-mini primary (swappable); the working
  tools run on Gemini — primary-model choice is an open decision for Moza.
