# UI Polish — Dashboard & Batches Status Pill Wrapping

**Timestamp:** 2026-11-19 13:45 WIB  
**Scope:** Prevent horizontal pill overflow (`in_assessment` / scan badges) on batch cards at medium desktop widths.

## Files Changed
- `src/app/(app)/dashboard/page.tsx`: Placed batch card `<h3>` full-width (`leading-snug break-words`) above a `flex flex-wrap items-center gap-1.5` badge row, and added `min-w-0 overflow-hidden` on the card `<Link>`.
- `src/app/(app)/batches/page.tsx`: Added `min-w-0 overflow-hidden` on the card `<Link>` and `flex-wrap` + `break-words min-w-0` on the card header so status pills (`draft`, `in_assessment`, etc.) never overflow long batch titles.

## Verification
- Verified via `npm run typecheck`, `npx eslint . --max-warnings 0`, `npm test`, `npm run build`, and live browser inspection on `/dashboard` and `/batches`.
