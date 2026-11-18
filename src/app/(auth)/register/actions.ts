"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { resolveSafeOrigin } from "@/lib/security/redirect";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: "Nama lengkap minimal 2 karakter." })
      .max(120, { message: "Nama lengkap maksimal 120 karakter." }),
    email: z.string().trim().email({ message: "Alamat email tidak valid." }),
    password: z
      .string()
      .min(8, { message: "Password minimal 8 karakter." })
      .max(128, { message: "Password maksimal 128 karakter." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  });

export type RegisterState = {
  error?: string;
  successMessage?: string;
  fullName?: string;
  email?: string;
  fieldErrors?: {
    fullName?: string[];
    email?: string[];
    password?: string[];
    confirmPassword?: string[];
  };
};

export async function registerAction(
  _prevState: RegisterState | null,
  formData: FormData,
): Promise<RegisterState> {
  const fullNameRaw = String(formData.get("fullName") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`register:${ip}`, 5, 60_000);
  if (!rate.allowed) {
    return {
      fullName: fullNameRaw,
      email: emailRaw,
      error: `Terlalu banyak percobaan pendaftaran. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsed = registerSchema.safeParse({
    fullName: fullNameRaw,
    email: emailRaw,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      fullName: fullNameRaw,
      email: emailRaw,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      fullName: fullNameRaw,
      email: emailRaw,
      error: "Konfigurasi Supabase belum diatur pada server deployment.",
    };
  }

  let hasSession = false;
  try {
    const supabase = await getSupabaseServerClient();
    const origin = resolveSafeOrigin(hdrs);

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
        data: {
          full_name: parsed.data.fullName,
        },
      },
    });

    if (error) {
      console.error("[Register Error]:", error.message);
      return {
        fullName: fullNameRaw,
        email: emailRaw,
        error:
          "Pendaftaran gagal diproses. Pastikan email valid dan kata sandi memenuhi kebijakan.",
      };
    }

    hasSession = Boolean(data.session);
  } catch (err) {
    console.error(
      "[Register Error]:",
      err instanceof Error ? err.message : "unknown",
    );
    return {
      fullName: fullNameRaw,
      email: emailRaw,
      error: "Layanan pendaftaran sedang tidak tersedia. Silakan coba kembali.",
    };
  }

  if (hasSession) {
    redirect("/onboarding");
  }

  return {
    successMessage:
      "Permintaan pendaftaran diterima. Jika email ini belum terdaftar, silakan cek inbox/spam untuk tautan verifikasi sebelum melanjutkan setup LSP.",
  };
}
