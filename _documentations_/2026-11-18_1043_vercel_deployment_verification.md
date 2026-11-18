# Vercel Deployment & Graphify Verification Log

- **Timestamp:** `2026-11-18 10:43 WIB`
- **Commits Pushed to `origin/main`:** `6fd0327` (Phases 0–5 platform), `91c4544` (Fail-closed auth & graceful env guardrails)
- **Live Target:** `https://assessor-zeta.vercel.app/`
- **Graphify Knowledge Graph:** `graphify-out/GRAPH_REPORT.md` (`4861 nodes · 10887 edges · 241 communities`) + local Obsidian vault `graphify-out/obsidian/` (`5095 notes` + `graph.canvas`)

## Live Browser Diagnosis & Fix Summary
1. Initial probe after `6fd0327` revealed `/api/health` returned HTTP `200`, `/login` returned HTTP `200`, while unauthenticated `/dashboard` and `/settings/provider` returned HTTP `500` (`Minified React error #441`).
2. Root cause: `src/lib/supabase/middleware.ts` returned `NextResponse.next()` (fail-open) when `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` were absent on Vercel, and `src/app/(app)/layout.tsx` lacked an explicit `if (!user) redirect("/login")` fallback, causing `getSupabaseServerClient()` to throw during Server Component rendering.
3. Resolution (`91c4544`):
   - `src/lib/supabase/middleware.ts`: fails closed to `/login?next=<pathname>&reason=config` whenever Supabase public env vars are missing or auth validation throws.
   - `src/app/(app)/layout.tsx` & `src/app/page.tsx`: explicit session checks redirecting unauthenticated traffic to `/login`.
   - `src/lib/auth/get-session.ts` & `src/app/(auth)/login/actions.ts`: return null/friendly error instead of uncaught server exceptions when env vars are missing.
   - `src/app/(auth)/login/_components/login-form.tsx` & `src/app/(app)/error.tsx`: graceful deployment config status banner and fallback error boundary.
4. Post-fix Vercel Browser Check (`BROWSER_HOST_FACTS` origin: `https://assessor-zeta.vercel.app`, `blocked_origins: none`):
   - `/` -> `/login?next=%2F&reason=config` (`HTTP 200`, 0 console errors)
   - `/dashboard` -> `/login?next=%2Fdashboard&reason=config` (`HTTP 200`, 0 HTTP 500s)
   - `/settings/provider` -> `/login?next=%2Fsettings%2Fprovider&reason=config` (`HTTP 200`, 0 HTTP 500s)
   - `/login` -> `HTTP 200` with Email/Password/Masuk form and configuration guidance banner
   - `/api/health` -> `HTTP 200` (`{"ok":true,"data":{"status":"ok","service":"AsesorKompetensi","version":"v1.4",...}}`)
