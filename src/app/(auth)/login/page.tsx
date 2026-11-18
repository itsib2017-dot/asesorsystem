import { LoginForm } from "./_components/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return <LoginForm supabaseConfigured={supabaseConfigured} />;
}
