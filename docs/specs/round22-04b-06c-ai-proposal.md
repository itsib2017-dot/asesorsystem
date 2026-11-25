# F2 / F5 Spec — Putaran 22 (hal. 4): Usulan Otomatis AI pada Formulir FR.IA.04B & FR.IA.06C (AI Mengusulkan, Asesor Memutuskan)

- **Tanggal:** 2026-11-25
- **Mode:** FAST MODE (`ground_rules_v5.md` §0.2) — tanpa perubahan skema DB, RLS, maupun boundary otorisasi.
- **Status:** Implemented & Verifying

## 1. Masalah & Keputusan Pemilik (25 Nov 2026)

- **Pengguna:** Asesor kompetensi yang meninjau hasil analisis DIT (`FR.IA.04B`) dan koreksi tes tertulis esai (`FR.IA.06C`).
- **Masalah sebelumnya:**
  - Pada `FR.IA.04B`, commit `2e0659c` memutus pembacaan `coverageMatrix` dan `readiness.recommendation` sehingga seluruh 13 butir muncul sebagai `Belum` dan rekomendasi `Belum ditetapkan`.
  - Pada `FR.IA.06C`, belum ada formulir mandiri untuk mengoreksi `Ya/Tidak/Belum` per nomor soal maupun umpan balik `Tercapai/Belum Tercapai`, dan `buildIa06cPayload` mencentang blanko resmi langsung dari AI tanpa persetujuan simpan asesor.
- **Keputusan pemilik (mengikat):** AI wajib mengisi otomatis seluruh jawaban penilaian awal sebagai usulan (termasuk rekomendasi K/BK), sehingga asesor cukup meninjau, mengoreksi bila perlu, lalu menyimpan sebagai keputusan resmi.

## 2. Trust Boundary & Keamanan

- **Otorisasi:** `saveIa04bAssessmentAction` dan `saveIa06cAssessmentAction` tetap mewajibkan session valid (`getUser()`), kepemilikan `batch`/`assessee`, RBAC `requireLspRole(lspId, userId, ["lsp_admin", "assessor"])`, rate limit `30/60s` per `(userId, assesseeId)`, validasi Zod, serta audit log (`dit.ia04b.save`, `written.ia06c.save`).
- **Batas Usulan vs Resmi:** Usulan AI **tidak pernah** menjadi tanda centang resmi pada pratinjau blanko (`Ia04bBlankoPreview`, `Ia06cBlankoPreview`) maupun ekspor `.docx` (`buildIa04bPayload`, `buildIa06cPayload`) sebelum asesor menekan tombol Simpan.
- **Gate Tidak Berubah:** Ekspor resmi tetap terkunci sampai nama sertifikat (KTP) dikonfirmasi; keputusan akhir tetap biner `K`/`BK` tanpa kategori bersyarat.

## 3. Aturan Pemetaan Usulan AI

1. **FR.IA.04B (`buildIa04bAiProposals`):**
   - Sumber: `dit_analyses.coverage_matrix` dan `dit_analyses.readiness`.
   - Pencocokan aspek: prioritas `unitCode` → kecocokan teks judul/lingkup & KP → posisi baris bila panjang sama → fallback baris KP tunggal.
   - Status: `Terpenuhi` → `Ya` (`true`); `Belum Dibahas` → `Tidak` (`false`); `Sebagian` → `Belum` (`null`, bukti parsial wajib dinilai asesor).
   - Rekomendasi keseluruhan: `Kompeten` → `K`, `Belum Kompeten` → `BK`, selain itu `null`.
2. **FR.IA.06C (`buildIa06cAiProposals`):**
   - Sumber: `written_gradings.item_verdicts` dan `written_gradings.vatm_unit_recommendations`.
   - Status per soal: `Benar` → `Ya` (`true`); `Salah` → `Tidak` (`false`); `Sebagian` → `Belum` (`null`, bukti parsial wajib dinilai asesor).
   - Umpan balik keseluruhan: `false` (Belum Tercapai / BK) bila ada unit `BK` atau soal `Salah`; `true` (Tercapai / K) bila semua soal `Benar` dan tanpa unit `BK`; `null` bila hanya `Benar` + `Sebagian` atau kosong.
3. **Retensi Keputusan Asesor:**
   - Bila `official_04b` atau `form_mapping.official06c` sudah tersimpan, formulir wajib menampilkan keputusan tersimpan (tidak tertimpa usulan AI).
   - Pekerja `handleDitAnalysisJob` mempertahankan `prevOfficial04b` dan `handleWrittenGradingJob` mempertahankan `prevOfficial06c` beserta `confirmedBy`/`confirmedAt` saat analisis ulang dijalankan.

## 4. Kriteria Penerimaan (Acceptance Criteria)

1. Setelah DIT selesai, formulir `FR.IA.04B` langsung terisi usulan `Ya/Tidak/Belum` + rekomendasi `K/BK` dengan badge visual pembeda (*Usulan AI*, *Usulan AI: Sebagian (Perlu Nilai Asesor)*, *Dikoreksi Asesor*, *Ditetapkan Asesor*).
2. Setelah koreksi tertulis selesai, formulir `FR.IA.06C` langsung terisi usulan `Ya/Tidak/Belum` per soal + status `Tercapai/Belum Tercapai` dengan badge visual pembeda yang sama.
3. Blanko pratinjau resmi & ekspor `.docx` untuk 04B dan 06C tetap netral hingga asesor menekan tombol **Simpan**, dan setelah disimpan menampilkan keputusan asesor yang bertahan saat halaman dimuat ulang maupun saat analisis AI dijalankan ulang.
4. Catatan lama `"bukan tercentang otomatis dari AI"` dihapus dan diganti penjelasan alur usulan AI → koreksi/penetapan asesor.

## 5. Daftar Tiket (F5)

1. Helper murni `buildIa04bAiProposals`, `hasSavedOfficial04bAssessment`, `extractOfficial06cAssessment`, `hasSavedOfficial06cAssessment`, `buildIa06cAiProposals`, serta pembaruan `buildIa06cPayload` di `src/lib/forms/assessee-forms.ts`.
2. Penyimpanan `saveOfficial06cAssessment` & retensi `saveWrittenGrading` di `src/repositories/assessment.repository.ts` dan `src/worker/index.ts`.
3. Server action `saveIa06cAssessmentAction` di `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/actions.ts`.
4. Pembaruan UI & halaman `Ia04bAssessmentForm` (`dit/_components/ia04b-assessment-form.tsx`, `dit/page.tsx`) + formulir baru `Ia06cAssessmentForm` (`written/_components/ia06c-assessment-form.tsx`, `written/page.tsx`).
5. Pengujian Vitest (unit helper, action RBAC/validasi/audit, ekspor netral vs tersimpan, retensi worker), lint, typecheck, build, dan verifikasi Playwright.
