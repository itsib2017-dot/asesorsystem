# Round 22 hal.6 — T2+T3+T4: Written grading error classification, async Job ID progress & split key/run UX

**Date:** 2026-11-25 17:25 WIB · **Mode:** AUDIT · **Packet:** `paket-putaran-22-simulasi-penuh-gabungan-2026-11-25.md` P0-1 (§3.3 #3–4), P1-7, P1-8

## Changes
| File | Change |
|---|---|
| `src/lib/jobs/format-written-error.ts` | **T2:** Classifies failures (`quota` → `config` → `timeout` → `empty_output` → `input` → `unknown`) so quota errors wrapped in `"Structured output validation failed..."` are never misclassified as `empty_output`, and empty outputs are clearly distinguished from timeouts. Includes **full `jobId`** for log correlation. |
| `src/lib/jobs/__tests__/format-written-error.test.ts` | Unit tests covering Run 1 verbatim (`No output generated`), Run 2 verbatim (`melewati batas waktu 102 detik`), wrapped quota, BYOK config, invalid/empty 06B/06C input, and unknown/null fallback. |
| `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/page.tsx` | **T3:** Exports `maxDuration = 300` for Server Actions and `after()` callbacks on this page (per Next.js 16 route segment docs). |
| `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/actions.ts` | **T3+T4:** Adds `saveWrittenMasterKeyAction` (upload/manual key persistence separated from grading); updates `runWrittenGradingWithKeyAction` to require active batch key, check rate limit + batch/assessee IDOR ownership + RBAC, enqueue with `runImmediately: false`, schedule `executeJob` via `after()`, and return `{ ok, jobId, status, progress }`. |
| `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/_components/written-key-form.tsx` | **T3+T4:** Two distinct sections & buttons (**Langkah 1: Simpan & Aktifkan Kunci 06B**, **Langkah 2: Jalankan Koreksi Tertulis AI**); polls `waitForJob` and renders live banner `data-testid="written-active-job-id"` with full `Job ID` + `status · progress%`; always calls `router.refresh()` after success or failure (fixes P1-8 stale key gate banner). |
| `src/app/(app)/batches/[id]/assessees/[assesseeId]/written/__tests__/actions.test.ts` | Tests for `saveWrittenMasterKeyAction` (auth, RBAC, IDOR cross-batch check, empty input, persistence without grading) and `runWrittenGradingWithKeyAction` (auth, RBAC, rate limit, active-key gate, `runImmediately: false` + `after()` `executeJob`). |

## Security & Integrity Check
- **Auth & RBAC:** Both actions enforce `getUser()` and `requireLspRole(batch.lspId, user.id, ["lsp_admin", "assessor"])`.
- **IDOR / BOLA:** Both actions verify `batch` and `assessee` exist and `assessee.batchId === batch.id`.
- **Rate limiting:** `written:key:${user.id}:${batchId}` (20/min) and `written:grade:${user.id}:${assesseeId}` (15/min).
- **No silent auto-grading:** Key persistence never triggers grading; grading never mutates saved official 06C assessments; K/BK rule and DIT path untouched.

## Verification
- `npx tsc --noEmit`
- `npx eslint` (`--max-warnings 0`) on all modified/created files
- `npx vitest run` on `format-written-error.test.ts`, `format-dit-error.test.ts`, `grading-chunked.test.ts`, `written/__tests__/actions.test.ts`
- Live verification (user/QA): run grading once on ASESI-001 (simulation batch, key active) after deploy — observe live full Job ID banner, active key banner staying green regardless of outcome, and specific error classification if a failure occurs.
