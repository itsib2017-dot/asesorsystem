import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeInternalRedirect } from "@/lib/security/redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeInternalRedirect(searchParams.get("next"), "/onboarding");

  try {
    const supabase = await getSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  } catch (err) {
    console.error(
      "[Auth Callback Error]:",
      err instanceof Error ? err.message : "unknown",
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
