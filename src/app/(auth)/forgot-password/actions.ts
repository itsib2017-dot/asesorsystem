"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { resolveSafeOrigin } from "@/lib/security/redirect";

const forgotSchema = z.object({
  email: z.string().trim().email({ message: "Alamat email tidak valid." }),
});

export type ForgotPasswordState = {
  error?: string;
  successMessage?: string;
  email?: string;
  fieldErrors?: {
    email?: string[];
  };
};

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState | null,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const emailRaw = String(formData.get("email") ?? "").trim();

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`forgot-password:${ip}`, 5, 60_000);
  if (!rate.allowed) {
    return {
      email: emailRaw,
      error: `Terlalu banyak permintaan reset password. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsed = forgotSchema.safeParse({ email: emailRaw });
  if (!parsed.success) {
    return {
      email: emailRaw,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      email: emailRaw,
      error: "Konfigurasi Supabase belum diatur pada server deployment.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const origin = resolveSafeOrigin(hdrs);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/settings/profile`,
    });

    if (error) {
      console.error("[ForgotPassword Error]:", error.message);
    }
  } catch (err) {
    console.error(
      "[ForgotPassword Error]:",
      err instanceof Error ? err.message : "unknown",
    );
    return {
      email: emailRaw,
      error: "Layanan pemulihan password sedang tidak tersedia. Silakan coba kembali.",
    };
  }

  // Always return generic message to avoid account enumeration
  return {
    email: emailRaw,
    successMessage:
      "Jika alamat email tersebut terdaftar, tautan pemulihan kata sandi telah dikirim ke kotak masuk Anda.",
  };
}
