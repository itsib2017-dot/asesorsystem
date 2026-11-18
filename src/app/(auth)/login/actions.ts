"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizeInternalRedirect } from "@/lib/security/redirect";
import { redirect } from "next/navigation";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Alamat email tidak valid." }),
  password: z
    .string()
    .min(6, { message: "Password minimal terdiri dari 6 karakter." }),
});

export type LoginState = {
  error?: string;
  email?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
};

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const emailRaw = String(formData.get("email") ?? "").trim();

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`login:${ip}`, 15, 60_000);
  if (!rate.allowed) {
    return {
      email: emailRaw,
      error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const rawData = {
    email: emailRaw,
    password: formData.get("password"),
  };

  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      email: emailRaw,
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      email: emailRaw,
      error:
        "Konfigurasi Supabase belum diatur pada server deployment. Lengkapi environment variable NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: validated.data.email,
      password: validated.data.password,
    });

    if (error) {
      console.error("[Login Error]:", error.message);
      return {
        email: emailRaw,
        error: "Kombinasi email atau password salah. Silakan coba kembali.",
      };
    }
  } catch (err) {
    console.error("[Login Error]:", err instanceof Error ? err.message : "unknown");
    return {
      email: emailRaw,
      error: "Layanan autentikasi sedang tidak tersedia. Silakan periksa konfigurasi server.",
    };
  }

  const nextPath = sanitizeInternalRedirect(
    formData.get("next") as string | null,
    "/dashboard",
  );
  redirect(nextPath);
}
