# Remediasi Putaran 22 (hal. 4): Usulan Otomatis AI pada Formulir FR.IA.04B & FR.IA.06C

- **Tanggal:** 2026-11-25 09:22 +07:00
- **HEAD Sebelumnya:** `713290a`
- **Pemicu:** Koreksi pemilik 25 Nov 2026 (08:46 WIB) agar formulir penilaian terisi otomatis sebagai usulan AI (termasuk rekomendasi biner K/BK) sehingga asesor cukup meninjau, mengoreksi bila perlu, lalu menyimpan; diperluas ke **FR.IA.04B** dan **FR.IA.06C**.
- **Mode:** FAST MODE (`ground_rules_v5.md` §0.2) — nol perubahan skema DB, nol migrasi, nol perubahan RLS/auth/PII boundary.

---

## 1. Akar Masalah

1. **FR.IA.04B:** Commit `2e0659c` memutus pembacaan `coverageMatrix` dan `readiness` pada form mandiri 04B, sehingga setelah DIT selesai seluruh 13 aspek tampil `Belum` dan rekomendasi tampil `Belum ditetapkan` dengan catatan lama `"bukan tercentang otomatis dari AI"`.
2. **FR.IA.06C:** Halaman penilaian tertulis belum memiliki formulir mandiri bagi asesor untuk meninjau/mengoreksi `Ya / Tidak / Belum` per nomor soal maupun umpan balik `Tercapai / Belum Tercapai`, sedangkan `buildIa06cPayload` langsung mencentang blanko resmi dari hasil AI tanpa persetujuan simpan asesor.

---

## 2. Perubahan yang Diterapkan

### A. Helper Pemetaan Usulan & Batas Resmi (`src/lib/forms/assessee-forms.ts`)
- **04B:**
  - `hasSavedOfficial04bAssessment(assessment)`: membedakan metadata worker (`officialQuestionCount`, `decisionRule`) dari keputusan tersimpan asesor.
  - `buildIa04bAiProposals({ scheme, ditAnalysis })`: memetakan `coverageMatrix` ke aspek `kelompokPekerjaan` (prioritas `unitCode` → kecocokan judul/lingkup & KP → indeks posisi → fallback KP tunggal) dengan aturan `Terpenuhi` → `Ya` (`true`), `Belum Dibahas` → `Tidak` (`false`), `Sebagian` → `Belum` (`null`), serta `readiness.recommendation` biner (`Kompeten` → `K`, `Belum Kompeten` → `BK`).
  - `buildIa04bPayload`: tetap hanya membaca keputusan tersimpan asesor (`official_04b` / unit `decisions`), sehingga blanko resmi & ekspor DOCX tidak berubah menjadi resmi sebelum tombol Simpan diklik.
- **06C:**
  - `extractOfficial06cAssessment(writtenGrading)` & `hasSavedOfficial06cAssessment(assessment)`: membaca keputusan asesor tersimpan dari `written_gradings.form_mapping.official06c` (serta `confirmed_by`/`confirmed_at`).
  - `buildIa06cAiProposals({ scheme, writtenGrading })`: memetakan `item_verdicts` (`Benar` → `Ya`, `Salah` → `Tidak`, `Sebagian` → `Belum`) dan usulan `overallAchieved` (`false` jika ada unit `BK` atau soal `Salah`; `true` jika semua soal `Benar` dan tanpa unit `BK`; `null` jika parsial/kosong).
  - `buildIa06cPayload`: tetap netral (`achieved: null`, `overallAchieved: null`, `feedbackDetail: undefined`) sebelum `official06c` disimpan asesor; setelah disimpan, memakai keputusan asesor.

### B. Repositori & Retensi Worker (`src/repositories/assessment.repository.ts`, `src/worker/index.ts`)
- `saveOfficial06cAssessment`: menyimpan keputusan asesor 06C ke `written_gradings.form_mapping.official06c` (mempertahankan `soal`, `kunci`, `jawaban`) dan mengisi `confirmed_by` / `confirmed_at` via `runRepositoryDualPath` (Drizzle + Supabase).
- `saveWrittenGrading` & `handleWrittenGradingJob`: saat koreksi tertulis dijalankan ulang, `prevOfficial06c`, `confirmedBy`, dan `confirmedAt` dipertahankan agar keputusan asesor tidak pernah tertimpa (setara dengan retensi `prevOfficial04b` pada `handleDitAnalysisJob`).

### C. Server Action FR.IA.06C (`src/app/(app)/batches/[id]/assessees/[assesseeId]/written/actions.ts`)
- `saveIa06cAssessmentAction`: autentikasi `getUser()`, parsing JSON aman, validasi Zod, wajib catatan umpan balik jika `Belum Tercapai` (`false`), rate limit `30/60s`, cek kepemilikan batch/asesi, RBAC `requireLspRole(batch.lspId, user.id, ["lsp_admin", "assessor"])`, audit log `written.ia06c.save`, dan `revalidatePath`.

### D. Antarmuka & Provenance Visual
- **FR.IA.04B (`ia04b-assessment-form.tsx`, `dit/page.tsx`):**
  - Pre-fill otomatis dari `aiProposal04b` jika belum ada `official_04b` tersimpan; menampilkan keputusan tersimpan jika sudah ada.
  - Badge status visual per aspek dan rekomendasi keseluruhan (`Usulan AI`, `Usulan AI: Sebagian (Perlu Nilai Asesor)`, `Dikoreksi Asesor`, `Ditetapkan Asesor`, `Diubah (Belum Disimpan)`), banner status form, konteks `Status DIT AI`, pembaruan catatan form (menghapus teks `"bukan tercentang otomatis dari AI"`), perbaikan bug `setAspectAchieved` agar tidak memaksa `BK` saat aspek lain diubah ke `Ya`/`Belum`, dan `key={String(analysis?.id ?? "none")}` agar refresh langsung memuat hasil DIT baru.
- **FR.IA.06C (`ia06c-assessment-form.tsx`, `written/page.tsx`):**
  - Komponen `Ia06cAssessmentForm` dengan pre-fill usulan AI `itemVerdicts`, edit jawaban/catatan, tombol `Ya / Tidak / Belum`, pilihan keseluruhan `Tercapai (K) / Belum Tercapai (BK) / Belum ditetapkan`, badge provenance yang konsisten, serta banner peringatan di atas `Ia06cBlankoPreview` saat usulan AI belum disimpan.

---

## 3. Verifikasi & Bukti Gate

- `npx tsc --noEmit`: **PASS** (exit code `0`).
- `npx eslint . --max-warnings 0`: **PASS** (exit code `0`).
- `npx vitest run`: **PASS — 48/48 berkas uji, 233/233 kasus lulus** (termasuk `ia04b-ai-proposal.test.ts`, `ia06c-ai-proposal.test.ts`, `written/__tests__/actions.test.ts`, `dit/__tests__/actions.test.ts`, `official-forms-export.test.ts`, dan tes retensi `worker.test.ts`).
- `npm run build` (`next build`): **PASS** (Turbopack, seluruh route dinamis dan statis terkompilasi).
- **Playwright (Chromium `chromium-1208`, `next start -p 3199`):**
  - `GET /api/health` → `200`
  - Unauthenticated `GET /api/v1/batches/.../export?form=ia04b&format=docx` & `form=ia06` → `401` JSON
  - `/login` desktop (`1280×800`) & mobile (`390×844`) → `200`, `overflow: false`
  - `/dit` & `/written` unauthenticated → redirect bersih ke `/login?next=...` (`200`)
  - `0` console error, `0` page error.

---

## 4. Risiko & Rollback

- **Risiko:** Bila asesor lupa klik **Simpan** pada 04B/06C setelah melihat usulan AI, blanko resmi & ekspor DOCX tetap netral (tidak tercentang). Banner kuning di form dan di atas pratinjau blanko sudah memperjelas hal ini.
- **Rollback:** `git revert <commit-sha>` mengembalikan perilaku sebelumnya tanpa menyentuh skema database (karena `official06c` disimpan di dalam kolom JSONB `written_gradings.form_mapping` yang sudah ada).
