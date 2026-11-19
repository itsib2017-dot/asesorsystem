import { getUser } from "@/lib/auth/get-session";
import { listSchemes } from "@/repositories/schemes.repository";
import { SchemeRegistrationForm } from "./_components/scheme-registration-form";

export const metadata = {
  title: "Skema & Manifes — AsesorKompetensi",
};

export default async function SchemesPage() {
  const user = await getUser();
  const schemes = user ? await listSchemes(user.id) : [];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Skema Sertifikasi, Registry Formulir &amp; Blanko
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftarkan skema, himpunan formulir, pola klasifikasi berkas, template blanko{" "}
          <code>.docx</code> berversi, serta isi pertanyaan per skema di sini (D13/D17/D21). Saat
          membuat batch, cukup pilih skema dan tempel tautan Drive.
        </p>
      </div>

      <SchemeRegistrationForm existingSchemes={schemes} />
    </div>
  );
}
