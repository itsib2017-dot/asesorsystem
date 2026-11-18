"use server";

import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

export type LoginState = {
  error?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
};

export async function loginAction(_prevState: LoginState | null, formData: FormData): Promise<LoginState> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
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
        error: "Kombinasi email atau password salah. Silakan coba kembali.",
      };
    }
  } catch (err) {
    console.error("[Login Error]:", err instanceof Error ? err.message : "unknown");
    return {
      error: "Layanan autentikasi sedang tidak tersedia. Silakan periksa konfigurasi server.",
    };
  }

  redirect("/dashboard");
}
