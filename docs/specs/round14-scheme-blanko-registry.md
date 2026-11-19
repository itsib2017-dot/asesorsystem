> **Verifikasi live 2026-11-20 (Putaran 15b lanjutan):** skema `PK3MGB-UJI` dibuat seluruhnya dari UI (clone ICT-PM → ubah kode/nama → simpan → unggah blanko `.docx` 04A), lalu batch `5d183359-...` dipindai dengan 34 berkas dan 0 perlu triase. AK3U tetap normal. Kartu AK3U kini memakai `resolveSchemeUnitsList` sehingga menampilkan 13 unit, bukan 0.

# F2/F5 — Per-Scheme Form Registry, Versioned Blanko Upload & Zero-Hardcoding Multi-Scheme Execution

- **Date:** 2026-11-19
- **Mode:** AUDIT MODE (`ground_rules_v5.md` §0.2)
- **Target Scope:** Round 14 Implementation Brief — Registry Blanko & Manifes Formulir per Skema (D17/D21)

---

## 1. Feature Spec (F2)

### User & Outcome
LSP Admins and Assessors using **Settings → Skema (`/settings/schemes`)** can create, clone, or edit any certification scheme completely from the UI—defining its custom set of forms (`formKey`, `formName`, `instrumentRole`, `required`, `sortOrder`, `filePatterns`), uploading versioned `.docx` blanko templates per `(scheme, formKey)`, specifying scheme-specific question banks (`FR.IA.04B` Kelompok Pekerjaan & aspects, `FR.IA.06A` written questions, `FR.IA.09` interview questions), and configuring scheme/LSP branding—so new schemes such as `ICT-PM` work end-to-end without touching source code while existing `AK3U` batches behave identically.

### Scope In
- Database schema & private Supabase Storage bucket (`scheme-blankos`) for versioned `.docx` blanko templates scoped by `lsp_id`.
- Seeding existing `AK3U` schemes with the 6 official `.docx` templates (`builtin://ak3u/...`) and full form manifest entries.
- Scheme Registry UI (`/settings/schemes`) supporting empty start, cloning from existing schemes, editing existing schemes, CRUD of form manifest rows, `.docx` blanko upload per form with version badges, question editors (04B, 06A, 09), and branding inputs.
- Isolation of AK3U constants (`AK3U_OFFICIAL_UNITS`, `IA04B_KELOMPOK_PEKERJAAN`, `/templates/ak3u/` logos) strictly to `AK3U` schemes (`isAk3uScheme`).
- Scheme-scoped classification in `drive_scan`, ZIP expansion, and content enrichment using the batch scheme's `scheme_form_manifests.file_patterns`.
- Dynamic DOCX/PDF export filling the scheme's uploaded blanko `.docx` from registry/storage and adapting unit/aspect/question rows to the scheme's manifest.

### Scope Out
- Modifying v1.4 specification thresholds (`similarity.flag_thresholds`, `name_jury.thresholds`).
- Modifying or deleting `audit_log` rows or confirming assessee certificate names.
- Accessing private assessee Google Drive folders outside demo fixtures.

### Trust Boundary & Data Model
- **Mutations (`saveSchemeManifestAction`, `uploadSchemeFormBlankoAction`):**
  - Authenticated session (`getUser()`) + `resolveAuthorizedLsp(user.id, ["lsp_admin"])`.
  - Zod schema validation on all fields, `formKey` slug constraints, URL safety checks for branding logos.
  - `.docx` validation: max 10 MB, ZIP magic bytes `PK\x03\x04`, valid OOXML archive containing `word/document.xml`, SHA-256 checksum recorded.
  - Append-only audit logs: `scheme.manifest.upsert` and `scheme.blanko.upload`.
- **Storage Isolation (`scheme-blankos`):**
  - Private bucket (`public = false`) with `storage.objects` RLS requiring `private.auth_is_member((storage.foldername(name))[1]::uuid)` for SELECT and `private.auth_has_role(..., array['lsp_admin'])` for INSERT/UPDATE/DELETE.
  - Export endpoints verify `batch` belongs to the caller's LSP and only download templates whose `template_storage_path` belongs to `scheme.lspId` (or `builtin://ak3u/`).

### Observable Acceptance Criteria
1. Admin LSP can create a brand-new scheme (e.g., `ICT-PM`) entirely from `/settings/schemes` with custom forms, upload a `.docx` blanko per form (incrementing `template_version`), enter scheme-specific 04B/06A/09 questions, and save without code edits.
2. Existing schemes can be loaded into the editor and updated without losing already-uploaded `.docx` blanko references.
3. A batch using `ICT-PM` classifies files during `drive_scan` using `ICT-PM`'s `filePatterns`, displays `ICT-PM`'s questions (not AK3U constants), and exports DOCX documents generated from `ICT-PM`'s registered blanko templates.
4. Existing `AK3U` batches remain unchanged in classification, 04B/06A/09 question sets, and official BNSP AK.02/IA.04B/IA.06C/AK.05 exports.

---

## 2. Ticket Breakdown (F5)

| Ticket | Mode | Target | Status |
|---|---|---|---|
| T0 | AUDIT | `_documentations_/2026-11-19_1928_plan-putaran-14-registry-blanko.md`, `docs/specs/round14-scheme-blanko-registry.md` | **Done** |
| T1 | AUDIT | Migration `20261119000013_scheme_blanko_registry.sql`, `src/db/schema.ts`, `src/repositories/schemes.repository.ts` | Pending |
| T2 | AUDIT | `src/lib/forms/assessee-forms.ts`, `src/components/forms/blanko-chrome.tsx`, `src/app/(app)/batches/[id]/assessees/[assesseeId]/interview/page.tsx` | Pending |
| T3 | AUDIT | `src/app/(app)/settings/schemes/actions.ts`, `src/app/(app)/settings/schemes/_components/scheme-registration-form.tsx`, `src/app/(app)/settings/schemes/page.tsx` | Pending |
| T4 | AUDIT | `src/services/drive.ts`, `src/services/drive-extract.ts`, `src/worker/index.ts` | Pending |
| T5 | AUDIT | `src/services/export.ts`, export API routes, `written/page.tsx` | Pending |
| T6 | AUDIT | Vitest unit tests + demo tenant `ICT-PM` verification + Playwright E2E `e2e/scheme-blanko-registry.spec.ts` | Pending |
| T7 | AUDIT | Full gate verification, docs (`schema.md`, `rls-policies.md`, `security-proof.md`, `feature-test-report.md`), `graphify`, backup | Pending |
