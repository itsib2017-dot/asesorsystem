# Round 22 — Wave 2 (P1 + P2 + E7): Interview Determinism & Drafts, 04A Fallback/Gate, Batch Cards, Job IDs & Bulk Actions

**Date:** 2026-11-26 09:15 WIB · **Mode:** AUDIT

## Changes
| Item | File(s) | Change |
|---|---|---|
| **P1-1 / P1-2 / P1-3** | `src/ai/prompts/interview-rctfa.v1.ts`, `src/services/interview.ts` | Deterministic slot allocation plan across all 5 dimensions (`TS`, `TMS`, `CMS`, `JRES`, `TrS`), explicit inline STAR cues, unit-order sorting, sequential `1..N` numbering, and post-generation normalization ensuring 5/5 dimensions when `questionCount >= 5`. |
| **P1-3 / P1-4 / P1-5** | `interview/actions.ts`, `interview/page.tsx`, `interview-assessment-form.tsx` | Index-based UI numbering (`idx + 1`), auto-fill per-unit `K`/`BK` & overall recommendation from item `Ya`/`Tidak` clicks (still manually overridable), auto-save generated questions + explicit **"Simpan Draf Soal"** button (`saveInterviewDraftAction`) stored as `drive_files` `docType="ia09_draft"` (`triageStatus="not_needed"`, zero DB migration). |
| **P1-9 / P1-10** | `batch-metadata-surat-tugas-panel.tsx` | Always shows participant import rule/checkbox + multi-scheme notice when `schemeGroups.length > 1`; clears stale local metadata drafts on apply before `router.refresh()` so the server TUK header updates immediately. |
| **P1-11 (Issue 1) + P2-1** | `assessee-forms.ts`, `export/route.ts`, `dit/page.tsx` | `buildIa04aPayload` falls back to extracted `04a` file text (or scheme instructions) when `rawOutput.frIa04aText` is missing; disables 04A export button when KTP name or signature is missing (matching 04B/06C). |
| **P2-2** | `src/app/(app)/batches/page.tsx` | Displays scheme (`code — name`), assessee count, and file count on each batch card using `listBatchResourceCountsForUser`. |
| **P2-5** | `src/components/identity/name-jury-card.tsx` | Adds `router.refresh()` on confirmation and **"Gunakan Nama Tampilan (Isi Form)"** shortcut prefilling `typedName` from `apl01Name` while retaining required audit reason. |
| **P2-6** | `format-dit-error.ts`, `dit-analysis-trigger.tsx` | Shows full `jobId` (instead of 8-char prefix) in DIT completion, timeout, and error banners. |
| **E7** | `ia04b-assessment-form.tsx`, `ia06c-assessment-form.tsx` | Adds **"Tandai Semua Ya"** and **"Kosongkan"** bulk actions with confirmation prompt when overwriting saved decisions. |

## Verification
- `npx tsc --noEmit`
- `npx eslint` (`--max-warnings 0`) on all modified/created files
- `npx vitest run interview-rctfa.test.ts interview.test.ts format-dit-error.test.ts official-forms-export.test.ts ia04a-fallback.test.ts`
