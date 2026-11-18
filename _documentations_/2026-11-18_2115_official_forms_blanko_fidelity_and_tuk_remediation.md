# Official BNSP Blanko Fidelity, TUK (`Sewaktu`), and Historical Vercel Error Triage

**Timestamp:** 2026-11-18 21:15 WIB  
**Checkpoints:** `3373246` (Checkpoint 14) & `1ef4ba5` (Checkpoint 15)  
**Target Domain:** `https://assessor-zeta.vercel.app`

---

## 1. Historical Vercel Deployment Errors Triage

- The eight red `Error / Production` rows seen in earlier deployment history (`844eb21` through `80a482b`) were caused by TypeScript failures in CI/Vercel build (`tsc --noEmit` failing on removed `framer-motion` import in `src/components/dashboard/stats-card.tsx` and `LayoutProps<"/">` in `src/app/layout.tsx`).
- They were fixed in commit `cdfea9e` and superseded by subsequent `Ready / Production` deployments (`cdfea9e`, `1906f13`, `0047511`, `540497b`, `3373246`, `1ef4ba5`). Historical failed rows can be safely ignored once current `main` builds green (`Ready / Production`).

---

## 2. Official TUK Default & Rendering (`Sewaktu`)

- Normalized `normalizeTukType` in `src/lib/forms/assessee-forms.ts` and `buildTukCellRuns` in `src/services/export.ts` and `BlankoTukValue` in `src/components/forms/blanko-chrome.tsx` so `"sewaktu"` is the active selection whenever `tuk_type` is `"sewaktu"` or unspecified.
- Across all official blankos (`FR.AK.05`, `FR.AK.02`, `FR.IA.04B`, `FR.IA.06C`), TUK renders strictly as `Sewaktu/Tempat Kerja/Mandiri*` with `<w:strike/>` (DOCX) or CSS `line-through` (web preview) on unselected options and no extra `(...)` suffix appended.
- Production batches in Supabase (`Demo Audit R3`, `Demo Audit R4`, `LSP-VERIFY-E2E`) were already updated to `tuk_type = 'sewaktu'`.

---

## 3. Unaltered Official BNSP Forms & Template-Fill Architecture

Official AK3U blankos downloaded into `src/templates/ak3u/` and traced via `next.config.ts` (`outputFileTracingIncludes: { "/api/v1/**/*": ["./src/templates/**/*"] }`):

| Form | Template Path | Tables Preserved | Interactive/Output Behavior |
| :--- | :--- | :---: | :--- |
| **FR.AK.05** | `src/templates/ak3u/FR.AK.05.LAPORAN_ASESMEN.docx` | 5 | PDF (2-page A4) + surgical OOXML DOCX; WYSIWYG preview (`Ak05Preview`) |
| **FR.AK.02** | `src/templates/ak3u/FR.AK.02.REKAMAN_ASESMEN.docx` | 4 | Unaltered `#92D050` 13-unit evidence grid, native `<w:sdt>` K/BK checkboxes, signature block; DOCX export (`D8`) + `Ak02BlankoPreview` |
| **FR.IA.04B** | `src/templates/ak3u/FR.IA.04B.PENILAIAN_PROYEK_SINGKAT.docx` | 13 | Preserves `PANDUAN BAGI ASESOR`, `Kelompok Pekerjaan 1..4` unit lists, 4 white-header aspect tables with 13 `<w:sdt>` Ya/Tidak checkboxes, and `Rekomendasi Asesor`; DOCX export (`D8`) + `Ia04bBlankoPreview` |
| **FR.IA.06C** | `src/templates/ak3u/FR.IA.06C.LEMBAR_JAWABAN_TERTULIS.docx` | 5 | Preserves `ListParagraph` numbered rows (clones safely for `>13`), native `<w:sdt>` Ya/Tidak checkboxes, `Umpan balik untuk Asesi`, dynamic `[Content_Types].xml` media defaults; DOCX export (`D8`) + `Ia06cBlankoPreview` |

### Shared Modules Introduced
- `src/components/forms/blanko-chrome.tsx`: `BlankoSheetHeader`, `BlankoSheetFooter`, `BlankoTukValue`, `BlankoTitleBar`, `BlankoMetadataTable`, `BlankoDocxExportBar`, `BlankoSignatureBlock`.
- `src/lib/forms/assessee-forms.ts`: `AK3U_OFFICIAL_UNITS`, `IA04B_KELOMPOK_PEKERJAAN`, `extractSchemeMeta`, `normalizeTukType`, `buildAk02Payload`, `buildIa04bPayload`, `buildIa06cPayload`.
- `src/lib/forms/load-assessee-page-data.ts`: Shared page loader (`loadAssesseeCommonFormMeta`) used across assessee detail, DIT analysis, and written grading pages.
- `src/app/api/v1/batches/[id]/assessees/[assesseeId]/export/route.ts`: Authenticated, tenant-isolated, audit-logged DOCX exporter enforcing Export Rule `D8`, KTP confirmation gate (`D6`), and active signature gate (`D7`).

---

## 4. Verification Summary

- Static & unit gates on Checkpoints 14 & 15:
  - `npx tsc --noEmit`: 0 errors
  - `npx eslint --max-warnings 0 src`: 0 errors, 0 warnings
  - `npx vitest run`: 14 test files, 47 tests passed (`official-forms-export.test.ts` + existing suite)
  - `npm run build`: clean production build (33 routes)
  - Python strict `xml.etree.ElementTree.fromstring` check across generated `.docx` ZIP packages (`sample_ak02.docx`: 20 XML parts valid; `sample_ia04b.docx`: 15 XML parts valid; `sample_ia06c.docx`: 15 XML parts valid)

---

## 5. Post-Visual-QA Layout Fix (`32bc9eb`) & Live Verification

- Live screenshot inspection revealed horizontal table overflow past the white paper border on narrow viewports in `FR.IA.06C`.
- Extracted `BlankoA4Sheet` (`w-full overflow-x-auto` wrapper around fixed `w-[794px]` A4 sheet container) in `src/components/forms/blanko-chrome.tsx` and applied it uniformly across `FR.AK.05`, `FR.AK.02`, `FR.IA.04B`, and `FR.IA.06C`.
- Verified live on `https://assessor-zeta.vercel.app` (`LSP-VERIFY-E2E`) across all four official forms, live `.docx` downloads (`FR-AK-02`, `FR-IA-04B`, `FR-IA-06C`), strict Python `ElementTree.fromstring` XML validation on the downloaded binaries, and `D8` PDF rejection (`HTTP 422 EXPORT_FORMAT_NOT_ALLOWED`).

