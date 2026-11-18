"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "../actions";

interface LoginFormProps {
  supabaseConfigured: boolean;
  nextPath?: string;
  hasCallbackError?: boolean;
}

export function LoginForm({
  supabaseConfigured,
  nextPath = "/dashboard",
  hasCallbackError = false,
}: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  const [email, setEmail] = useState(state?.email ?? "");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          AsesorKompetensi
        </h1>
        <p className="text-sm text-slate-400">
          Masuk ke portal asesmen &amp; manajemen sertifikasi LSP
        </p>
      </div>

      {!supabaseConfigured && (
        <div
          role="status"
          className="mb-6 p-4 rounded-lg bg-amber-950/60 border border-amber-700/70 text-amber-200 text-xs space-y-1.5"
        >
          <p className="font-semibold text-amber-100">
            Konfigurasi Environment Deployment Diperlukan
          </p>
          <p className="text-amber-200/90 leading-relaxed">
            Lengkapi variabel environment pada Vercel Project Settings:{" "}
            <code className="font-mono text-amber-100">
              NEXT_PUBLIC_SUPABASE_URL
            </code>
            ,{" "}
            <code className="font-mono text-amber-100">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
            ,{" "}
            <code className="font-mono text-amber-100">
              SUPABASE_SERVICE_ROLE_KEY
            </code>
            , dan{" "}
            <code className="font-mono text-amber-100">
              BYOK_ENCRYPTION_SECRET
            </code>
            , lalu redeploy.
          </p>
        </div>
      )}

      {hasCallbackError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-800/80 text-red-200 text-sm"
        >
          Tautan verifikasi email tidak valid atau telah kedaluwarsa. Silakan
          masuk atau daftar kembali.
        </div>
      )}

      {state?.error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-800/80 text-red-200 text-sm"
        >
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="next" value={nextPath} />
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
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
            aria-describedby={state?.fieldErrors?.email ? "login-email-error" : undefined}
            className="w-full px-4 py-3 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {state?.fieldErrors?.email && (
            <p id="login-email-error" role="alert" className="text-xs text-red-400 mt-1">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
            >
              Lupa password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              onInput={(e) => e.currentTarget.setCustomValidity("")}
              onInvalid={(e) => {
                if (e.currentTarget.validity.valueMissing) {
                  e.currentTarget.setCustomValidity("Harap masukkan password Anda.");
                }
              }}
              placeholder="••••••••"
              aria-invalid={Boolean(state?.fieldErrors?.password)}
              aria-describedby={
                state?.fieldErrors?.password ? "login-password-error" : undefined
              }
              className="w-full px-4 py-3 pr-11 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
            <p
              id="login-password-error"
              role="alert"
              className="text-xs text-red-400 mt-1"
            >
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-2 py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <span>Masuk</span>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
        Belum punya akun LSP atau asesor?{" "}
        <Link
          href="/register"
          className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
        >
          Daftar Akun &amp; Buat LSP Baru
        </Link>
      </div>
    </div>
  );
}
