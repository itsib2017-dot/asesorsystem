# Fix: Vercel Build & TypeScript Typecheck Error

- **Date / Timestamp:** 2026-11-18 08:02:00 +07:00
- **Project Name:** `webapps_asesor`
- **Issue:** Vercel automated CI/CD deployment failure during `npm run build` (`Failed to type check`)
- **Lead / Staff Engineer:** Senior Full-Stack Engineer

---

## 1. Root Cause Analysis

During Vercel deployment, `npm run build` triggers `next build`, which runs `tsc` (TypeScript compiler) and `eslint`.
1. **`tsconfig.json` Over-inclusion**:
   - The default `tsconfig.json` configured `"include": ["**/*.ts"]` with only `"exclude": ["node_modules"]`.
   - Consequently, TypeScript attempted to compile all test harnesses (`tests/**/*.ts`) and scripts (`scripts/**/*.ts`), which depend on external packages like `vitest` and `@modelcontextprotocol/sdk` not meant for the client/server Next.js runtime bundle.
2. **`eslint.config.mjs` Over-scanning**:
   - ESLint 9 configuration only had `.next/**`, `out/**`, `build/**`, and `next-env.d.ts` in `globalIgnores`.
   - React Hook linter rules (`react-hooks/rules-of-hooks`) were applied to auxiliary CLI and test scripts (e.g. `tests/use-cases.ts`).

---

## 2. Changes Applied

### A. `tsconfig.json`
- Scoped `"include"` strictly to:
  - `next-env.d.ts`
  - `src/**/*.ts`
  - `src/**/*.tsx`
  - `.next/types/**/*.ts`
  - `.next/dev/types/**/*.ts`
- Added explicit `"exclude"` entries:
  - `node_modules`
  - `tests`
  - `scripts`
  - `.agents`
  - `.pi`
  - `.openclaw-plugin`
  - `configs`

### B. `eslint.config.mjs`
- Added auxiliary non-web directories to `globalIgnores`:
  - `tests/**`
  - `scripts/**`
  - `hooks/**`
  - `skills/**`
  - `configs/**`
  - `.agents/**`
  - `.pi/**`
  - `.openclaw-plugin/**`
  - `.claude/**`
  - `.codex-plugin/**`
  - `.cursor-plugin/**`

---

## 3. Verification

1. **`npm run lint`**:
   - Passed with 0 errors and 0 warnings.
2. **`npm run build`**:
   - Next.js 16.4.6 (Turbopack) successfully compiled and optimized production build in 5.9s.
   - TypeScript completed in 3.2s without error.
   - Prerendered static pages: `/` and `/_not-found`.
