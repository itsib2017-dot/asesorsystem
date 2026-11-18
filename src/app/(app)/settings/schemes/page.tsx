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
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Skema Sertifikasi & Manifes Formulir
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftarkan skema dan blanko sekali saja di sini (D13/D17). Saat membuat batch, cukup pilih skema dan tempel tautan Drive.
        </p>
      </div>

      {schemes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schemes.map((s) => (
            <div key={s.id} className="glass-card rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800">
                  {s.code}
                </span>
                <span className="text-xs text-slate-400">v{s.version}</span>
              </div>
              <h3 className="font-semibold text-slate-900">{s.name}</h3>
              <p className="text-xs text-slate-600">
                Aturan: {s.manifest.decisionRule || "-"} · Bank Soal:{" "}
                {s.manifest.questionCounts?.questionBankCount ?? "-"} butir
              </p>
            </div>
          ))}
        </div>
      )}

      <SchemeRegistrationForm />
    </div>
  );
}
