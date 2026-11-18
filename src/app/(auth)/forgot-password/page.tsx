import { ForgotPasswordForm } from "./_components/forgot-password-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lupa Password — AsesorKompetensi",
};

export default function ForgotPasswordPage() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return <ForgotPasswordForm supabaseConfigured={supabaseConfigured} />;
}
