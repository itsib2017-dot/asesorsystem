import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
        <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
          HTTP 404
        </div>
        <h1 className="text-2xl font-bold text-white">Halaman Tidak Ditemukan</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Tautan yang Anda buka tidak tersedia atau telah dipindahkan. Silakan kembali
          ke dasbor atau halaman masuk portal AsesorKompetensi.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            Ke Dasbor
          </Link>
          <Link
            href="/login"
            className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-200 transition-colors"
          >
            Halaman Masuk
          </Link>
        </div>
      </div>
    </main>
  );
}
