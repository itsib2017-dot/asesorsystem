# Round 22 hal.6 — T0+T1: Written grading (06C) chunked pipeline

**Date:** 2026-11-25 17:05 WIB · **Mode:** AUDIT · **Packet:** `paket-putaran-22-simulasi-penuh-gabungan-2026-11-25.md` P0-1 / §3

## T0 — Diagnosis
- Vercel runtime logs for the 2 failed jobs (07:26–07:36Z) are **not retrievable**: Hobby plan retention expired (`vercel logs` → "does not retain runtime logs for the requested time range"). Future runs log per chunk with `correlation_id = <jobId>:q<from>-<to>` / `<jobId>:rollup`.
- Code confirms packet: one `generateStructured` call with full key + full answer + 13 items + VATM + plagiarism; 240s total / 220s attempt. "102 s" = remaining budget for attempt 2.

## T1 — Change
| File | Change |
|---|---|
| `src/services/grading.ts` | Pipeline now: ⌈N/4⌉ item-chunk calls **in parallel** (140s cap, 150s budget each) → 1 rollup call for VATM + plagiarism (80s/85s) fed with compact verdicts. `ringkasanKesalahan` derived deterministically (non-"Benar"). All-or-nothing: any failed chunk → error naming the range, nothing persisted. |
| `src/ai/prompts/written-test-grading.v2.ts` | New chunk + rollup prompts; spans ≤200 chars, explanation ≤2 sentences; PII redaction + injection guard kept. |
| `src/ai/written-grading-schemas.ts` | Chunk/rollup sub-schemas derived from `writtenGradingSchema` (output shape unchanged → worker/save/UI untouched). |
| `src/services/__tests__/grading-chunked.test.ts` | Ranges, merge/dedupe, happy path (5 calls), failed chunk, empty input. |

`promptVersion` = `v2.0.0-chunked`. v1 prompt file kept (rollback = revert `grading.ts`).

## Constraints honoured
- DIT path untouched. No grade written on assessor's behalf (still proposals; official06c retention unchanged). K/BK rule unchanged.

## Risks
- Parallel calls may hit provider rate limits (4–5 concurrent). If seen, lower concurrency.
- Question count defaults to unit count (13 for AK3U); schemes with different counts rely on scheme units.

## Verify live
Run grading once for ASESI-001 (simulation batch, key active) after deploy; expect 13 verdicts + plagiarism + 06C proposals. Then T2–T4 (error classifier, Job ID banner, split key/run).
