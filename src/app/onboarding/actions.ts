"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { bootstrapLspForUser } from "@/repositories/auth.repository";

const onboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Nama lengkap minimal 2 karakter." })
    .max(120, { message: "Nama lengkap maksimal 120 karakter." }),
  regNoMet: z
    .string()
    .trim()
    .max(64, { message: "Nomor MET maksimal 64 karakter." })
    .optional(),
  lspCode: z
    .string()
    .trim()
    .min(3, { message: "Kode LSP minimal 3 karakter." })
    .max(32, { message: "Kode LSP maksimal 32 karakter." })
    .regex(/^[A-Za-z0-9-]+$/, {
      message: "Kode LSP hanya boleh berisi huruf, angka, dan tanda hubung (-).",
    }),
  lspName: z
    .string()
    .trim()
    .min(3, { message: "Nama resmi LSP minimal 3 karakter." })
    .max(160, { message: "Nama LSP maksimal 160 karakter." }),
});

export type OnboardingState = {
  error?: string;
  fieldErrors?: {
    fullName?: string[];
    regNoMet?: string[];
    lspCode?: string[];
    lspName?: string[];
  };
};

export async function completeOnboardingAction(
  _prevState: OnboardingState | null,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = hdrs.get("user-agent") || null;

  const rate = checkRateLimit(`onboarding:${user.id}`, 5, 60_000);
  if (!rate.allowed) {
    return {
      error: `Terlalu banyak percobaan setup LSP. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsed = onboardingSchema.safeParse({
    fullName: formData.get("fullName"),
    regNoMet: (formData.get("regNoMet") as string | null) || undefined,
    lspCode: formData.get("lspCode"),
    lspName: formData.get("lspName"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const res = await bootstrapLspForUser({
    userId: user.id,
    fullName: parsed.data.fullName,
    regNoMet: parsed.data.regNoMet ?? null,
    lspCode: parsed.data.lspCode,
    lspName: parsed.data.lspName,
    ip,
    userAgent,
  });

  if (!res.ok) {
    return {
      error: res.error || "Gagal membuat ruang kerja LSP.",
    };
  }

  redirect("/dashboard");
}

export async function signOutFromOnboardingAction() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
