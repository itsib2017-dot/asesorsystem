"use client";

import { useActionState } from "react";
import {
  completeOnboardingAction,
  signOutFromOnboardingAction,
  type OnboardingState,
} from "../actions";

interface OnboardingFormProps {
  userEmail: string;
  defaultFullName: string;
}

export function OnboardingForm({
  userEmail,
  defaultFullName,
}: OnboardingFormProps) {
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(
    completeOnboardingAction,
    {},
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-wider text-indigo-400 mb-2">
            Onboarding Tenant LSP
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Siapkan Profil &amp; LSP Anda
          </h1>
          <p className="text-sm text-slate-400">
            Akun <span className="text-slate-200 font-medium">{userEmail}</span>{" "}
            belum terhubung ke LSP. Buat organisasi LSP baru Anda sebagai Admin
            LSP.
          </p>
        </div>

        {state?.error && (
          <div className="mb-5 p-4 rounded-lg bg-red-950/50 border border-red-800/80 text-red-200 text-sm">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Nama Lengkap Asesor / Admin
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              defaultValue={defaultFullName}
              placeholder="Ir. Budi Santoso, M.T."
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {state?.fieldErrors?.fullName && (
              <p className="text-xs text-red-400 mt-1">
                {state.fieldErrors.fullName[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="regNoMet"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              No. Registrasi Asesor BNSP / MET (opsional)
            </label>
            <input
              id="regNoMet"
              name="regNoMet"
              type="text"
              placeholder="MET.000.001234 2024"
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {state?.fieldErrors?.regNoMet && (
              <p className="text-xs text-red-400 mt-1">
                {state.fieldErrors.regNoMet[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label
                htmlFor="lspCode"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Kode LSP
              </label>
              <input
                id="lspCode"
                name="lspCode"
                type="text"
                required
                placeholder="LSP-K3-ID"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {state?.fieldErrors?.lspCode && (
                <p className="text-xs text-red-400 mt-1">
                  {state.fieldErrors.lspCode[0]}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="lspName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Nama Resmi LSP
              </label>
              <input
                id="lspName"
                name="lspName"
                type="text"
                required
                placeholder="LSP Keselamatan & Kesehatan Kerja"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {state?.fieldErrors?.lspName && (
                <p className="text-xs text-red-400 mt-1">
                  {state.fieldErrors.lspName[0]}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isPending ? "Menyiapkan LSP..." : "Buat LSP & Masuk Dashboard"}
          </button>
        </form>

        <form action={signOutFromOnboardingAction} className="mt-5 pt-4 border-t border-slate-800 text-center">
          <button
            type="submit"
            className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
          >
            Keluar / Ganti Akun
          </button>
        </form>
      </div>
    </div>
  );
}
