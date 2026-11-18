"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { registerAction, type RegisterState } from "../actions";

interface RegisterFormProps {
  supabaseConfigured: boolean;
}

export function RegisterForm({ supabaseConfigured }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState<RegisterState, FormData>(
    registerAction,
    {},
  );
  const [fullName, setFullName] = useState(state?.fullName ?? "");
  const [email, setEmail] = useState(state?.email ?? "");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Daftar AsesorKompetensi
        </h1>
        <p className="text-sm text-slate-400">
          Buat akun untuk menyiapkan portal LSP baru
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
          <Link
            href="/login"
            className="inline-block text-xs font-semibold text-emerald-300 underline"
          >
            Kembali ke Halaman Masuk
          </Link>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
          >
            Nama Lengkap (sesuai KTP / Sertifikat Asesor)
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => {
              e.currentTarget.setCustomValidity("");
              setFullName(e.target.value);
            }}
            onInvalid={(e) => {
              if (e.currentTarget.validity.valueMissing) {
                e.currentTarget.setCustomValidity("Harap masukkan nama lengkap Anda.");
              }
            }}
            placeholder="Contoh: Nama Lengkap Sesuai KTP"
            aria-invalid={Boolean(state?.fieldErrors?.fullName)}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {state?.fieldErrors?.fullName && (
            <p role="alert" className="text-xs text-red-400 mt-1">
              {state.fieldErrors.fullName[0]}
            </p>
          )}
        </div>

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
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {state?.fieldErrors?.email && (
            <p role="alert" className="text-xs text-red-400 mt-1">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
          >
            Password (min. 8 karakter)
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              onInput={(e) => e.currentTarget.setCustomValidity("")}
              onInvalid={(e) => {
                const t = e.currentTarget;
                if (t.validity.valueMissing) {
                  t.setCustomValidity("Harap buat password minimal 8 karakter.");
                } else if (t.validity.tooShort) {
                  t.setCustomValidity("Password minimal terdiri dari 8 karakter.");
                }
              }}
              placeholder="••••••••"
              aria-invalid={Boolean(state?.fieldErrors?.password)}
              className="w-full px-4 py-2.5 pr-11 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {state?.fieldErrors?.password && (
            <p role="alert" className="text-xs text-red-400 mt-1">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
          >
            Konfirmasi Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            onInput={(e) => e.currentTarget.setCustomValidity("")}
            onInvalid={(e) => {
              if (e.currentTarget.validity.valueMissing) {
                e.currentTarget.setCustomValidity("Harap ulangi password Anda.");
              } else if (e.currentTarget.validity.tooShort) {
                e.currentTarget.setCustomValidity("Konfirmasi password minimal 8 karakter.");
              }
            }}
            placeholder="••••••••"
            aria-invalid={Boolean(state?.fieldErrors?.confirmPassword)}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {state?.fieldErrors?.confirmPassword && (
            <p role="alert" className="text-xs text-red-400 mt-1">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-2 py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isPending ? "Mendaftarkan..." : "Daftar & Lanjut Setup LSP"}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
        Sudah memiliki akun?{" "}
        <Link
          href="/login"
          className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
        >
          Masuk ke Portal
        </Link>
      </div>
    </div>
  );
}
