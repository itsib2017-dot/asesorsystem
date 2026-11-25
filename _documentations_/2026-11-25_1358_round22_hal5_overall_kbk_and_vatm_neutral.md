# Remediasi Putaran 22 (hal. 5): Aturan 100% Lulus Usulan Keseluruhan K/BK, VATM Netral Tanpa Cakupan DIT, dan Roll-Up Lintas Kanal AK.02/AK.05

- **Tanggal:** 2026-11-25 13:58 +07:00
- **HEAD Sebelumnya:** `00bd039`
- **Pemicu:** Brief Developer Putaran 22, Hal. 5 (tes ulang 25 Nov 09:50 & eksekusi koreksi pemilik 12:02–12:26 pada batch `6d577c84` / `ASESI-001`).
- **Mode:** FAST MODE (`ground_rules_v5.md` §0.2) — nol perubahan skema DB/migrasi/RLS/auth; tidak menyentuh keputusan asesor yang sudah tersimpan (`Ya:9 / Tidak:4 / BK` untuk `ASESI-001`).

---

## 1. Akar Masalah

1. **Usulan keseluruhan 04B (`buildIa04bAiProposals`):** menyalin `readiness.recommendation` secara langsung tanpa memeriksa daftar usulan item per soal, sehingga komposisi `Ya:8 / Tidak:0 / Belum:5` tetap mengusulkan **K** (`Kompeten`). Pada `buildIa06cAiProposals`, pengecekan `sorted.every(...)` juga berisiko mengabaikan slot soal yang masih `Belum`.
2. **VATM per unit (`computeVatmUnitRollup`):** untuk unit tanpa baris cakupan `coverageMatrix` yang cocok, kode jatuh ke `ditReadiness.recommendation` keseluruhan sehingga 4 unit tanpa bukti DIT menampilkan `"K — Kesiapan DIT: Kompeten"`.
3. **Roll-up AK.02 & AK.05 lintas kanal:** `resolveAssesseeOverallDecision` dan `resolveAk05BatchRows` sebelumnya hanya membaca tabel `decisions` per unit dan override manual, belum mempropagandakan status `BK` tersimpan dari kanal `FR.IA.04B`, `FR.IA.06C`, dan `FR.IA.09`.
4. **Polish minor:** typo LLM `"menenangkan persyaratan..."` pada catatan `readiness`.

---

## 2. Solusi yang Diterapkan

### A. Aturan 100% Lulus Usulan Keseluruhan 04B & 06C + Typo Polish
- [src/lib/forms/assessee-forms.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/lib/forms/assessee-forms.ts):
  - `buildIa04bAiProposals`: menurunkan `overallRecommendation` ketat dari `items` (`>= 1 Tidak` → `"BK"`; `100% Ya` → `"K"`; bila belum ada `Tidak` tetapi masih ada `Belum` → `null`). `readinessPct` & `readinessRecommendation` disimpan terpisah hanya sebagai informasi konteks.
  - `sanitizeReadinessNote`: membersihkan typo `"menenangkan"` → `"memenuhi"` sebelum `persyaratan|kriteria|standar|kompetensi|ketentuan`.
  - `buildIa06cAiProposals`: memeriksa seluruh slot `items` (`slotCount`), bukan hanya `sorted`.
  - `buildAk02Payload`: menangani komentar & tindak lanjut `BK` ketika sumber `BK` berasal dari kanal form (bukan hanya baris `decisions`).
- [ia04b-assessment-form.tsx](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/_components/ia04b-assessment-form.tsx) & [ia06c-assessment-form.tsx](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/batches/[id]/assessees/[assesseeId]/written/_components/ia06c-assessment-form.tsx): memisahkan badge `Info Kesiapan DIT` dari `Usulan 04B`, serta menampilkan label `Usulan AI: Belum Dapat Diputuskan (Perlu Nilai Asesor)` saat item parsial masih `Belum`.

### B. VATM Per Unit Tanpa Cakupan DIT = Netral
- [src/services/vatm-rollup.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/services/vatm-rollup.ts):
  - Menghapus fallback `ditReadiness?.recommendation`. Unit tanpa baris cakupan DIT yang cocok tetap netral (`aiRecommendation: null` jika kanal lain juga belum ada) dengan keterangan `[DIT 04A/04B: Netral] Belum ada cakupan bukti DIT untuk unit ini.`.
  - Memprioritaskan item tersimpan `official_04b` per `unitCode` bila asesor sudah menyimpan 04B; status `Sebagian` dibiarkan netral (tidak memaksa `BK`/`K`).
- [src/components/ak05/decision-toggle.tsx](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/components/ak05/decision-toggle.tsx): menampilkan status `Rekomendasi AI (VATM): Netral / Belum Dinilai` saat `aiRecommendation` adalah `null`.

### C. Roll-Up Lintas Kanal AK.02 & AK.05
- [src/repositories/assessment.repository.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/repositories/assessment.repository.ts): menambah `listDitAnalysesForBatch` dan `listInterviewAssessmentsForBatch` (jalur ganda Drizzle + Supabase).
- [src/lib/ak05/decision-rules.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/lib/ak05/decision-rules.ts): menambah `deriveOfficialChannelVerdicts` (hanya membaca keputusan **tersimpan asesor** pada `official_04b`, `official06c`, dan `interview_assessments`, bukan usulan AI yang belum disimpan) dan memperluas `resolveAssesseeOverallDecision` + `computeAk05RowForAssessee` sehingga satu `BK` di unit atau kanal mana pun langsung memicu `BK` otomatis pada AK.02 & AK.05.
- Terhubung ke [src/lib/ak05/rollup.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/lib/ak05/rollup.ts), [src/app/(app)/batches/[id]/assessees/[assesseeId]/page.tsx](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/(app)/batches/[id]/assessees/[assesseeId]/page.tsx), dan [src/app/api/v1/batches/[id]/assessees/[assesseeId]/export/route.ts](file:///d:/PRIVATES/Documents/Kimi/Workspaces/webapps_asesor/src/app/api/v1/batches/[id]/assessees/[assesseeId]/export/route.ts).

---

## 3. Verifikasi & Bukti Gate

- `npx tsc --noEmit`: **PASS** (`0` error).
- `npx eslint . --max-warnings 0`: **PASS** (`0` warning, `0` error).
- `npx vitest run`: **PASS — 48/48 berkas uji, 236/236 kasus lulus** (termasuk `ia04b-ai-proposal.test.ts` 7/7, `ia06c-ai-proposal.test.ts` 3/3, `vatm-rollup.test.ts` 3/3, `rollup.test.ts` 7/7, dan `worker.test.ts`).
- `npm run build`: **PASS** (`next build` Turbopack selesai bersih).
- **Playwright (Chromium `chromium-1208`, `next start -p 3199`):**
  - `GET /api/health` → `200`
  - Unauthenticated `GET /api/v1/batches/.../export?form=ak02&format=docx` & `/ak05/export?format=pdf` → `401`
  - `/login` desktop & mobile → `200`, `overflow: false`
  - `/dit`, `/written`, `/ak05` unauthenticated → redirect bersih ke `/login?next=...` (`200`)
  - `0` console error, `0` page error.

---

## 4. Risiko & Rollback

- **Risiko:** Bila ada asesi dengan seluruh unit `decisions` bernilai `K`, tetapi salah satu form `FR.IA.04B`/`FR.IA.06C`/`FR.IA.09` tersimpan `BK`, AK.02 & AK.05 otomatis menjadi `BK` sesuai aturan pemilik — asesor tetap dapat menggunakan override manual berlog-audit jika bukti susulan memadai.
- **Rollback:** `git revert <commit-sha>` tanpa menyentuh skema database.
