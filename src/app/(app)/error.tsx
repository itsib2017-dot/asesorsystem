"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto mt-16 glass-card rounded-2xl p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        Halaman Tidak Dapat Dimuat
      </h2>
      <p className="text-sm text-slate-600">
        Terjadi kendala saat menghubungkan ke layanan data atau sesi Anda telah berakhir.
      </p>
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Muat Ulang</span>
        </button>
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium"
        >
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}
