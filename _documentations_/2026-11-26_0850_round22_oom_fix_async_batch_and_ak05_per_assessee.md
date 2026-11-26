# Round 22 — Wave 1: 2048 MB OOM Fix, Async Batch Create/Rescan, P0-3 AK.05 Per-Assessee Export & Multi-Scheme Surat Tugas

**Date:** 2026-11-26 08:50 WIB · **Mode:** AUDIT

## Root Causes Diagnosed
1. **Production 500 OOM on `POST /api/v1/batches` (Screenshots `08:16:40` & `08:19:59`):**
   - `POST /api/v1/batches` called `enqueueJob({ type: "drive_scan" })` synchronously (`runImmediately: true`), downloading and scanning all Drive files/ZIPs inside the HTTP request handler.
   - `extractStreamTextWithLayout` in `src/services/extract.ts` ran `stream.slice(i).match(...)` inside character-by-character loops and had no `maxOutputLength` cap on `zlib.inflateSync` nor a size cap on the raw uncompressed-PDF fallback (`targetStreams = [latin]`), causing multi-MB PDF streams to exhaust Vercel's 2048 MB heap (`Peak Memory: 2048 MB / 2048 MB`).
2. **P0-3 AK.05 Batch Lock:** Exporting AK.05 blocked confirmed assessees whenever any other assessee in the batch lacked KTP confirmation.
3. **Multi-Scheme Surat Tugas (`3897/ST/LSP-K3N/XI/2026`):** `extractParticipantsFromSuratTugas` incremented `expectedBareSeqIdx` across scheme tables without resetting at `Skema : ...` / `NO NAMA ORGANISASI`, dropping the second scheme's participants.

## Changes
| File | Change |
|---|---|
| `src/services/extract.ts` | Sticky regexes (`/.../y`) replacing `stream.slice()` allocations, `MAX_PDF_INFLATE_BYTES` (4 MB) cap on `zlib.inflateSync`, `MAX_PDF_TEXT_STREAM_CHARS` (2 MB), and `MAX_PDF_RAW_FALLBACK_BYTES` (512 KB) guard. |
| `src/services/drive-extract.ts` | Lowered concurrent file extraction/inspection from 4 → 2 to bound peak heap. |
| `src/worker/index.ts` | Frees `item.entry.buffer` immediately after each ZIP entry is processed. |
| `src/app/api/v1/batches/route.ts` | Exports `maxDuration = 300`; enqueues `drive_scan` with `runImmediately: false` and runs `executeJob` in `after()`. |
| `src/app/(app)/batches/[id]/page.tsx` | Exports `maxDuration = 300`; `rescanBatchDriveAction` uses `runImmediately: false` + `after()`. |
| `src/app/api/v1/batches/[id]/ak05/export/route.ts` | Supports `?assesseeId=<uuid>` for per-assessee PDF/DOCX export gated only by that assessee's KTP confirmation (batch-wide gate unchanged). |
| `src/app/(app)/batches/[id]/ak05/page.tsx`, `src/components/ak05/ak05-preview.tsx` | Adds "Ekspor FR.AK.05 Per Asesi (PDF / DOCX)" list without altering official BNSP A4 sheets. |
| `src/services/surat-tugas.ts` | Resets `expectedBareSeqIdx = 1` on `Skema : ...` and `NO NAMA ORGANISASI` headers and populates `schemeGroups`. |
| Tests | Added OOM binary-PDF test in `extract-and-drive-download.test.ts`, 6 route tests in `ak05/export/__tests__/route.test.ts`, and `3897` multi-scheme fixture test in `surat-tugas.test.ts`. |

## Multi-Scheme Single-Assessor Readiness (Surat Tugas `3897`)
- **Current data model:** Each batch binds to one `scheme_id` (`batches.scheme_id`). For a multi-scheme Surat Tugas (e.g. `3897` with AK3U + Operator K3 under 1 assessor), the recommended workflow today is **2 batches** (one per scheme, sharing the Drive folder or split subfolders) so each scheme uses its own units, question counts, and blankos.
- `parseSuratTugasText` now extracts **all 7 participants + `schemeGroups`** cleanly; full auto-splitting into multiple batches from one Surat Tugas can be added in a follow-up ticket if desired.
