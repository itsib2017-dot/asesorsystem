"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { forgotPasswordAction, type ForgotPasswordState } from "../actions";

interface ForgotPasswordFormProps {
  supabaseConfigured: boolean;
}

export function ForgotPasswordForm({
  supabaseConfigured,
}: ForgotPasswordFormProps) {
  const [state, formAction, isPending] = useActionState<
    ForgotPasswordState,
    FormData
  >(forgotPasswordAction, {});
  const [email, setEmail] = useState(state?.email ?? "");

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Pemulihan Password
        </h1>
        <p className="text-sm text-slate-400">
          Masukkan email akun Anda untuk menerima tautan reset password
        </p>
      </div>

      {!supabaseConfigured && (
        <div
          role="status"
          className="mb-5 p-4 rounded-lg bg-amber-950/60 border border-amber-700/70 text-amber-200 text-xs"
        >
          Environment Supabase belum dikonfigurasi pada deployment ini.
        </div>
      )}

      {state?.error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 p-4 rounded-lg bg-red-950/50 border border-red-800/80 text-red-200 text-sm"
        >
          {state.error}
        </div>
      )}

      {state?.successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 p-4 rounded-lg bg-emerald-950/60 border border-emerald-700/80 text-emerald-200 text-sm space-y-2"
        >
          <p>{state.successMessage}</p>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              e.currentTarget.setCustomValidity("");
              setEmail(e.target.value);
            }}
            onInvalid={(e) => {
              const target = e.currentTarget;
              if (target.validity.valueMissing) {
                target.setCustomValidity("Harap masukkan alamat email Anda.");
              } else if (target.validity.typeMismatch) {
                target.setCustomValidity("Format alamat email tidak valid.");
              }
            }}
            placeholder="nama@lsp.id"
            aria-invalid={Boolean(state?.fieldErrors?.email)}
            className="w-full px-4 py-3 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {state?.fieldErrors?.email && (
            <p role="alert" className="text-xs text-red-400 mt-1">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isPending ? "Mengirim Tautan..." : "Kirim Tautan Reset Password"}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
        Ingat password Anda?{" "}
        <Link
          href="/login"
          className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
        >
          Kembali ke Halaman Masuk
        </Link>
      </div>
    </div>
  );
}
