import { sanitizeInternalRedirect } from "@/lib/security/redirect";
import { LoginForm } from "./_components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const nextPath = sanitizeInternalRedirect(params.next, "/dashboard");
  const hasCallbackError = params.error === "auth_callback_failed";

  return (
    <LoginForm
      supabaseConfigured={supabaseConfigured}
      nextPath={nextPath}
      hasCallbackError={hasCallbackError}
    />
  );
}
