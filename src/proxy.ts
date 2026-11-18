/**
 * src/proxy.ts
 *
 * Next.js 16 Proxy entry point (replaces deprecated middleware.ts).
 * Delegates session refresh to the Supabase proxy helper so that:
 *  - Auth tokens are refreshed on every SSR request.
 *  - Unauthenticated users are redirected to /login.
 *  - Authenticated users are redirected away from /login to /dashboard.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
