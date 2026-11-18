import { RegisterForm } from "./_components/register-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Daftar Akun — AsesorKompetensi",
};

export default function RegisterPage() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return <RegisterForm supabaseConfigured={supabaseConfigured} />;
}
