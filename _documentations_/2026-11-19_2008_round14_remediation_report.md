# Round 14 Remediation Report — Per-Scheme Form Registry & Versioned `.docx` Blanko Templates

- **Timestamp:** `2026-11-19 20:08 WIB`
- **Base Commit:** `e7fa16c`
- **Source Brief:** `brief-developer-registry-blanko-2026-11-19.md`
- **Authority:** `ground_rules_v5.md` (§0.2 AUDIT MODE, D17 Multi-Skema by Default, D21 Zero Hardcoding)

---

## 1. Summary of Remediations (Deliverables 1–5)

### Deliverable 1 — Editable Per-Scheme Form Registry in UI (`/settings/schemes`)
- Removed the hardcoded 5-form injection (`04a`, `04b`, `06a`, `06b`, `06c`) in `src/app/(app)/settings/schemes/actions.ts`.
- Upgraded `SchemeRegistrationForm` (`src/app/(app)/settings/schemes/_components/scheme-registration-form.tsx`) to provide full interactive CRUD over `forms[]` (`formKey`, `formName`, `instrumentRole`, `required`, `sortOrder`, `filePatterns`) with 3 starting modes:
  1. **Mulai dari daftar kosong** (0 forms)
  2. **Salin dari skema yang sudah ada** (clone any scheme's units, forms, question banks, and branding)
  3. **Edit skema yang sudah ada** (load existing scheme + registered `.docx` blanko badges)
- Upgraded `createOrUpdateScheme` in `src/repositories/schemes.repository.ts` to preserve existing `template_*` blanko metadata (`template_storage_path`, `template_file_name`, `template_sha256`, `template_version`, `template_uploaded_at`, `template_uploaded_by`) whenever form rows are edited, and added `deleteSchemeFormEntry` for deleting individual forms.

### Deliverable 2 — Versioned `.docx` Blanko Upload per `(scheme, formKey)`
- Applied migration `supabase/migrations/20261119000013_scheme_blanko_registry.sql` to remote Supabase (`oiplhsmmfuqriaqrxjud`):
  - Added `version int not null default 1`, `template_storage_path`, `template_file_name`, `template_sha256`, `template_version`, `template_uploaded_at`, and `template_uploaded_by` to `public.scheme_form_manifests`.
  - Created private storage bucket `scheme-blankos` (`5 MB` limit, `.docx` MIME) and multi-tenant RLS policies (`scheme_blankos_bucket_select`, `scheme_blankos_bucket_insert`, `scheme_blankos_bucket_update`, `scheme_blankos_bucket_delete`).
  - Seeded all 6 existing `AK3U` `.docx` templates (`ak02`, `ak05`, `04a`, `04b`, `06c`, `06a`) as `template_version = 1`.
  - Seeded a complete second non-K3 scheme in the demo tenant (`b03afb00-9266-467d-823e-44a7830a4077`): **`ICT-PM` — `Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)`** (`id = 1c49ecd0-b82a-463b-b9a3-7f8a410e4097`) with 8 SKKNI TIK project management units, 3 Kelompok Pekerjaan (`KP 1..3`) with 12 project questions, 15 `06A` written questions, 8 `09` interview questions, 12 registered forms, and 5 official `.docx` blanko templates (`src/templates/ict-pm/FR.*.docx`).
- Created `validateDocxTemplateBuffer` in `src/lib/forms/scheme-manifest-parser.ts` (verifies PK ZIP magic bytes `50 4B 03 04`, `word/document.xml` entry presence, and `<= 5 MB` size) and `uploadSchemeFormBlankoAction` in `src/app/(app)/settings/schemes/actions.ts` (uploads to `scheme-blankos/{lsp_id}/{scheme_id}/{form_key}/v{version}_{filename}.docx`, increments `template_version`, and writes `scheme.form_blanko.upload` to `audit_log`).

### Deliverable 3 — Per-Scheme Question Content & Branding in Manifest
- Removed unconditional `IA04B_KELOMPOK_PEKERJAAN` injection when saving a scheme in `src/app/(app)/settings/schemes/actions.ts`.
- Added strict scheme scoping (`isAk3uScheme`) in `src/lib/forms/assessee-forms.ts` so `AK3U_OFFICIAL_UNITS`, `IA04B_KELOMPOK_PEKERJAAN`, and `/templates/ak3u/logo-*.png` are used **only** for `AK3U` schemes.
- Added `resolveSchemeWrittenQuestions`, `resolveSchemeInterviewQuestions`, and `resolveSchemeBranding` so non-AK3U schemes use their own `manifestJson.writtenQuestions`, `manifestJson.interviewQuestions`, and `manifestJson.branding` across `/written`, `/interview`, and `BlankoChrome` (`src/components/forms/blanko-chrome.tsx`).

### Deliverable 4 — Classification & Export Driven by Registry
- Updated `classifyFileWithConfidence` (`src/services/drive.ts`) and `enrichAndReclassifyDriveFiles` (`src/services/drive-extract.ts`, wired through `src/worker/index.ts` and `src/app/(app)/batches/[id]/triage/actions.ts`) to evaluate the batch scheme's `scheme.forms` (`filePatterns`) before built-in regex fallbacks.
- Updated `src/services/export.ts` (`resolveSchemeTemplateBuffer`, `applyPlaceholderTokens`, dynamic unit rows in `generateAk02Docx`, dynamic KP/aspect tables in `generateIa04bDocx`, dynamic answer slots in `generateIa06cDocx`, and custom `templateBuffer` in `generateAk05Docx`/`generateAk05Pdf`) and both export routes (`src/app/api/v1/batches/[id]/assessees/[assesseeId]/export/route.ts` and `src/app/api/v1/batches/[id]/ak05/export/route.ts`) to resolve the scheme's registered blanko template and adapt table rows dynamically.

---

## 2. Verbatim Gate Outputs

1. **TypeScript (`npx tsc --noEmit`):** Exit code `0` (0 errors).
2. **ESLint (`npx eslint . --max-warnings 0`):** Exit code `0` (0 errors, 0 warnings).
3. **Vitest (`npm test`):** `30 passed (30)` test files, `130 passed (130)` tests.
4. **Remote PostgreSQL RLS (`supabase db query --remote --yes --file tests/rls-multi-lsp.test.sql`):** `42/42 PASS`, `0 FAIL`.
5. **Next.js Production Build (`npm run build`):** Exit code `0` (36 routes compiled).
6. **Playwright Headless UI & Viewport (`verify_round14_playwright.py`):**
   - Interactive registry & `.docx` blanko upload harness: `PASS` (`Blanko Aktif: v1 · FR.AK.02.REKAMAN_ASESMEN_ICT_PM.docx`, `overflow_desktop: False`, `overflow_mobile: False`, `console_errors: 0`).
   - Local production server (`http://127.0.0.1:3199`): `health: 200`, `/settings/schemes` auth guard redirect verified, `overflow_desktop: False`, `overflow_mobile: False`, `page_errors: 0`.
