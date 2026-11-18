import Link from "next/link";
import { Cpu, UserCheck, BookOpenCheck, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Pengaturan — AsesorKompetensi",
};

export default function SettingsHubPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Pengaturan Sistem
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kelola penyedia AI (BYOK), profil & tanda tangan digital asesor, serta manifes skema sertifikasi.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/settings/provider"
          className="glass-card rounded-2xl p-6 hover:border-indigo-400 transition-all flex flex-col justify-between space-y-4"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-slate-900">Penyedia AI (BYOK)</h2>
            <p className="text-xs text-slate-500">
              Anthropic, OpenAI-compatible gateway, Gemini, dan Google Drive API key.
            </p>
          </div>
          <span className="text-xs font-semibold text-indigo-700 inline-flex items-center gap-1">
            Buka konfigurasi <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          href="/settings/profile"
          className="glass-card rounded-2xl p-6 hover:border-teal-400 transition-all flex flex-col justify-between space-y-4"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-slate-900">Profil & Tanda Tangan</h2>
            <p className="text-xs text-slate-500">
              Unggah atau gambar tanda tangan asesor (wajib sebelum finalisasi FR.AK.05).
            </p>
          </div>
          <span className="text-xs font-semibold text-teal-700 inline-flex items-center gap-1">
            Kelola tanda tangan <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          href="/settings/schemes"
          className="glass-card rounded-2xl p-6 hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-slate-900">Skema & Manifes</h2>
            <p className="text-xs text-slate-500">
              Daftarkan skema, daftar formulir, jumlah soal, aturan keputusan, dan prasyarat.
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
            Atur skema <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
