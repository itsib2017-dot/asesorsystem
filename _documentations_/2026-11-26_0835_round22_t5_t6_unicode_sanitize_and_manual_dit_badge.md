# Round 22 — T5 (P0-2) & T6 (P1-6): Extraction Unicode Sanitization + Persistent Manual DIT Override

**Date:** 2026-11-26 08:35 WIB · **Mode:** AUDIT · **Packet:** `paket-putaran-22-simulasi-penuh-gabungan-2026-11-25.md` P0-2 & P1-6

## Root Cause
- **P0-2:** `extractTextFromPdfBasic` / `extractTextFromBuffer` could return NUL bytes, control chars, or unpaired UTF-16 surrogates from malformed PDF streams; PostgreSQL/Supabase rejected the write with `DRIVE_FILE_EXTRACTION_UPDATE_FAILED: unsupported Unicode escape sequence`, which surfaced raw DB text to the user and blocked DIT.
- **P1-6:** Manual pasted DIT overrides (`candidateProfileSummary`, `frIa04aText`, `presentationTranscript`) were sent in the `dit_analysis` job payload only and never written back to `drive_files`, so reloading the DIT page reverted the badge to `Drive` and subsequent runs tried to re-extract the broken Drive file.

## Changes
| File | Change |
|---|---|
| `src/lib/text/sanitize-extracted-text.ts` | New single-pass O(n) `sanitizeExtractedText(raw)` stripping NUL, C0/DEL controls (keeping `\t`, `\n`, `\r`), `U+FFFE`/`U+FFFF`, and unpaired UTF-16 surrogates while preserving valid surrogate pairs (emoji) and Indonesian prose. |
| `src/lib/text/__tests__/sanitize-extracted-text.test.ts` | Unit tests covering NUL, controls, non-characters, unpaired high/low surrogates, and valid surrogate pairs. |
| `src/services/extract.ts` | Sanitizes extracted text across all branches in `extractTextFromBuffer` and `extractTextFromPdfBasic`. |
| `src/repositories/batches.repository.ts` | Sanitizes `extractedText` in both `drizzle` and `supabase` paths of `updateDriveFileExtraction` and `updateDriveFileClassification`. |
| `src/services/drive-extract.ts` | Sanitizes before persistence; catches DB persistence failures in `ensureDriveFileExtracted` and returns user-friendly `FRIENDLY_EXTRACTION_PERSIST_ERROR` (`"Berkas tidak bisa dibaca otomatis — tempel teks secara manual."`); adds `skip04a`/`skip04b`/`skipCv` flags to `resolveAssesseeDitInputs`. |
| `src/worker/index.ts` | Sanitizes manual DIT payload overrides and persists them to `drive_files` with `extractionMethod: "manual_paste"` before calling `resolveAssesseeDitInputs` with skip flags. |
| `src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/page.tsx` | Passes `sourceNote: "manual"` when `extractionMethod === "manual_paste"` so the badge renders `"Siap (manual)"` across reloads. |
| `src/app/(app)/batches/[id]/assessees/[assesseeId]/dit/_components/dit-analysis-trigger.tsx` | Displays `"Siap (manual)"` immediately while manual textarea override is entered. |
| `src/services/__tests__/extract-and-drive-download.test.ts` | Tests PDF NUL/control stripping, friendly DB persist error message, and `skipCv` skip behavior. |
| `src/worker/__tests__/worker.test.ts` | Tests `dit_analysis` with manual CV override persists `extractionMethod: "manual_paste"` and skips Drive CV extraction. |

## Verification
- `npx tsc --noEmit` (0 errors)
- `npx eslint ... --max-warnings 0` (0 warnings, 0 errors)
- `npx vitest run sanitize-extracted-text.test.ts extract-and-drive-download.test.ts worker.test.ts dit.test.ts`
