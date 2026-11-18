# Registration, PKCE Callback & First-Time LSP Onboarding Log

- **Timestamp:** `2026-11-18 11:30 WIB`
- **Scope:** Option 1 (`/register`, `/auth/callback`, `/onboarding`) + fail-closed tenant bootstrap & throttling

## Implemented Components
1. **Rate Limiting & Safe Redirect Helpers**
   - `src/lib/security/rate-limit.ts`: fixed-window throttle helper (`login`: 15 req/min/IP, `register`: 5 req/min/IP, `onboarding`: 5 req/min/user).
   - `src/lib/security/redirect.ts`: `sanitizeInternalRedirect()` blocking open redirects (`//evil.com`, external origins, backslashes).
2. **Scoped LSP Bootstrap Repository (`src/repositories/auth.repository.ts`)**
   - `bootstrapLspForUser()`: verifies user has `0` existing memberships, checks `lsps.code` uniqueness (`409` conflict if taken), upserts `assessors` row, creates isolated `lsps` tenant, inserts initial `lsp_admin` row in `lsp_memberships` (with compensating cleanup on failure), and appends an immutable `audit_log` entry (`onboarding.bootstrap_lsp`).
   - Added Supabase REST fallback on network failure for `listUserMemberships()` and `getAssessorProfile()`.
3. **Routes & Guardrails**
   - `/register` (`src/app/(auth)/register/`): Zod-validated signup (`fullName`, `email`, password min 8 chars, confirmation match) via `supabase.auth.signUp()` with dynamic `Host` validation for `emailRedirectTo`.
   - `/auth/callback` (`src/app/(auth)/auth/callback/route.ts`): exchanges email verification PKCE `code` or `token_hash` cleanly and redirects safely to `/onboarding`.
   - `/onboarding` (`src/app/onboarding/`): authenticated wizard for new accounts lacking an LSP membership; `(app)/layout.tsx` redirects `0`-membership users to `/onboarding`, while `/onboarding` redirects already-onboarded users to `/dashboard`.
   - `/login`: added `"Daftar Akun & Buat LSP Baru"` link + `next` redirect preservation + callback error state.
