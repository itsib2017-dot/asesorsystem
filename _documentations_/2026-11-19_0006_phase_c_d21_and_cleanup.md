# Phase C Remediation Report — D21 Manifest Portability & Architecture Cleanup

**Timestamp:** 2026-11-19 00:06 WIB  
**Tickets Completed:** T11 (`R7`), T12 (`R6 Option A`, `R9`, `R10`, `R11`, `R12`, `R13`)  
**Mode:** FAST MODE / AUDIT MODE (`ground_rules_v5.md` §0.2)

---

## 1. Summary of Changes

### T11 (`R7`) — Migrate Hardcoded Scheme Units, Columns, and Logos into `SchemeManifestConfig` (D21)
- **Files:** `src/repositories/schemes.repository.ts`, `src/lib/config/types.ts`, `src/lib/forms/assessee-forms.ts`, `src/components/forms/blanko-chrome.tsx`, `src/components/forms/ak02-blanko-preview.tsx`, `src/components/forms/ia04b-blanko-preview.tsx`, `src/components/ak05/ak05-preview.tsx`, `src/app/(app)/batches/[id]/page.tsx`, `src/app/(app)/batches/[id]/ak05/page.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/page.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/page.tsx`, `src/app/api/v1/batches/[id]/assessees/[assesseeId]/export/route.ts`, `src/app/(app)/settings/schemes/actions.ts`, `src/app/(app)/settings/schemes/_components/scheme-registration-form.tsx`, `src/lib/forms/__tests__/scheme-manifest-portability.test.ts`
- **Fix:**
  - Extended `SchemeManifestConfig` & `SchemeManifest` with optional `kelompokPekerjaan`, `docColumns`, and `branding` (`leftLogoUrl`, `leftLogoAlt`, `rightLogoUrl`, `rightLogoAlt`).
  - Added `resolveSchemeUnitsList`, `resolveSchemeKelompokPekerjaan`, `resolveSchemeDocColumns`, and `resolveSchemeBranding` in `src/lib/forms/assessee-forms.ts`, wiring them into `buildAk02Payload`, `buildIa04bPayload`, blanko previews, completeness matrix, and DOCX export routes while retaining AK3U defaults solely as explicit fallback.
  - Added custom `unitsText` and `docColumnsText` configuration inputs to `SchemeRegistrationForm` and `saveSchemeManifestAction` (plus seeding 13 AK3U units on "Isi Contoh Skema AK3U").
  - Added unit tests in `scheme-manifest-portability.test.ts` verifying non-AK3U manifests do not fall back to AK3U units, columns, or logos.

### T12 (`R6 Option A`, `R9`, `R10`, `R11`, `R12`, `R13`) — Shared AK.05 Layout & Dead Artifact Cleanup
- **`R6 Option A`:** Extracted `src/lib/ak05/layout.ts` (`AK05_LAYOUT` geometry, colors `#4472C4`/`#A8D08D`/`#92D050`, column ratios, table headers, note labels) shared cleanly between `src/services/export.ts` (`generateAk05Pdf`), `src/components/ak05/ak05-preview.tsx`, and `src/components/forms/blanko-chrome.tsx`. Kept `pdf-lib` PDF output (Vercel Hobby lacks LibreOffice headless).
- **`R9`, `R10`:** Removed the dead `hello` job type and `src/worker/handlers/hello.handler.ts` from `src/worker/queue.ts`, `src/worker/index.ts`, `src/app/api/v1/jobs/enqueue/route.ts`, and updated `src/worker/__tests__/worker.test.ts` to test real `extract_file` inline execution.
- **`R11`:** Removed unused `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, and `NEXT_PUBLIC_SENTRY_DSN` placeholders from `.env.example`, and documented `# ENABLE_DIRECT_DB="false"` and `# GOOGLE_DRIVE_API_KEY=""`.
- **`R12`:** Removed duplicate source prompts under `src/ai/prompts/source/` (`_documentations_/research/prompts/` remains preserved as original reference).
- **`R13`:** Added `unconfirmed?: boolean` to `SimilarityThresholds` and `"identity.ktp_ocr_min_confidence": number` to `ConfigMap`, and wired `getConfig("identity.ktp_ocr_min_confidence")` in `src/app/(app)/batches/[id]/page.tsx`.

---

## 2. Verification Results (Post-Final-Edit)
- `npm run typecheck` (`tsc --noEmit`): **PASS** (0 errors)
- `npm run lint` (`eslint`): **PASS** (0 warnings, 0 errors)
- `npm test` (`vitest run`): **PASS** — **21 test files passed, 69 tests passed**
- `npm run build` (`next build`): **PASS** — Compiled 35 routes cleanly
