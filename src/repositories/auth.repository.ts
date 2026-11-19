import { and, eq } from "drizzle-orm";
import { runRepositoryDualPath } from "@/db";
import { lspMemberships, assessors, lsps } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write-audit-log";

export type LspRole = "assessor" | "lsp_admin" | "tuk_admin";

export interface BootstrapLspInput {
  userId: string;
  fullName: string;
  regNoMet?: string | null;
  lspCode: string;
  lspName: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface BootstrapLspResult {
  ok: boolean;
  lspId?: string;
  error?: string;
  status?: number;
}

export async function findAssessorRoleForLsp(
  lspId: string,
  assessorId: string,
): Promise<LspRole | null> {
  return runRepositoryDualPath({
    userId: assessorId,
    label: "AuthRepository.findAssessorRoleForLsp",
    drizzle: async (tx) => {
      const rows = await tx
        .select({ role: lspMemberships.role })
        .from(lspMemberships)
        .where(
          and(
            eq(lspMemberships.lspId, lspId),
            eq(lspMemberships.assessorId, assessorId),
          ),
        )
        .limit(1);
      return rows[0]?.role ?? null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("lsp_memberships")
        .select("role")
        .eq("lsp_id", lspId)
        .eq("assessor_id", assessorId)
        .maybeSingle();

      if (error || !data) return null;
      return data.role as LspRole;
    },
  });
}

export async function getLspById(
  lspId: string,
  assessorId: string,
): Promise<{ id: string; code: string; name: string } | null> {
  return runRepositoryDualPath({
    userId: assessorId,
    label: "AuthRepository.getLspById",
    drizzle: async (tx) => {
      const rows = await tx
        .select({ id: lsps.id, code: lsps.code, name: lsps.name })
        .from(lsps)
        .where(eq(lsps.id, lspId))
        .limit(1);
      return rows[0] ?? null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("lsps")
        .select("id, code, name")
        .eq("id", lspId)
        .maybeSingle();
      if (error || !data) return null;
      return { id: data.id as string, code: data.code as string, name: data.name as string };
    },
  });
}

export async function listUserMemberships(assessorId: string) {
  return runRepositoryDualPath({
    userId: assessorId,
    label: "AuthRepository.listUserMemberships",
    drizzle: (tx) =>
      tx
        .select({
          lspId: lspMemberships.lspId,
          role: lspMemberships.role,
        })
        .from(lspMemberships)
        .where(eq(lspMemberships.assessorId, assessorId)),
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("lsp_memberships")
        .select("lsp_id, role")
        .eq("assessor_id", assessorId);

      return (data ?? []).map((row) => ({
        lspId: row.lsp_id as string,
        role: row.role as LspRole,
      }));
    },
  });
}

export async function getAssessorProfile(assessorId: string) {
  return runRepositoryDualPath({
    userId: assessorId,
    label: "AuthRepository.getAssessorProfile",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(assessors)
        .where(eq(assessors.id, assessorId))
        .limit(1);
      return rows[0] ?? null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("assessors")
        .select("*")
        .eq("id", assessorId)
        .maybeSingle();

      return data ?? null;
    },
  });
}

/**
 * Bootstraps an assessor profile, a brand-new isolated LSP tenant, and initial lsp_admin
 * membership for an authenticated user who does not yet belong to any LSP.
 * Uses scoped admin client strictly after verifying uniqueness and membership absence,
 * and records an immutable audit_log event.
 */
export async function bootstrapLspForUser(
  input: BootstrapLspInput,
): Promise<BootstrapLspResult> {
  const existingMemberships = await listUserMemberships(input.userId);
  if (existingMemberships.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "Akun Anda sudah terdaftar dalam sebuah LSP.",
    };
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return {
      ok: false,
      status: 500,
      error:
        "Konfigurasi SUPABASE_SERVICE_ROLE_KEY belum tersedia di server untuk membuat LSP baru.",
    };
  }

  const normalizedCode = input.lspCode.trim().toUpperCase();
  const normalizedName = input.lspName.trim();
  const normalizedFullName = input.fullName.trim();

  const { data: existingLsp, error: checkErr } = await admin
    .from("lsps")
    .select("id")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (checkErr) {
    return { ok: false, status: 500, error: "Gagal memeriksa ketersediaan kode LSP." };
  }
  if (existingLsp) {
    return {
      ok: false,
      status: 409,
      error:
        "Kode LSP sudah terdaftar. Gunakan kode unik baru atau hubungi Admin LSP terkait untuk undangan.",
    };
  }

  const { error: assessorErr } = await admin.from("assessors").upsert(
    {
      id: input.userId,
      full_name: normalizedFullName,
      reg_no_met: input.regNoMet?.trim() || null,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (assessorErr) {
    return {
      ok: false,
      status: 500,
      error: "Gagal membuat profil asesor.",
    };
  }

  const { data: createdLsp, error: lspErr } = await admin
    .from("lsps")
    .insert({
      code: normalizedCode,
      name: normalizedName,
      status: "active",
    })
    .select("id")
    .single();

  if (lspErr || !createdLsp) {
    const isDuplicate = lspErr?.code === "23505";
    return {
      ok: false,
      status: isDuplicate ? 409 : 500,
      error: isDuplicate
        ? "Kode LSP sudah digunakan. Silakan pilih kode LSP lain."
        : "Gagal membuat entitas LSP baru.",
    };
  }

  const { error: memErr } = await admin.from("lsp_memberships").insert({
    lsp_id: createdLsp.id,
    assessor_id: input.userId,
    role: "lsp_admin",
  });

  if (memErr) {
    // Compensating cleanup to avoid orphan LSP tenant without admin.
    await admin.from("lsps").delete().eq("id", createdLsp.id);
    return {
      ok: false,
      status: 500,
      error: "Gagal menautkan keanggotaan LSP Admin.",
    };
  }

  await writeAuditLog(
    {
      lsp_id: createdLsp.id,
      actor_id: input.userId,
      action: "onboarding.bootstrap_lsp",
      resource: "lsps",
      resource_id: createdLsp.id,
      after_summary: {
        code: normalizedCode,
        name: normalizedName,
        role: "lsp_admin",
      },
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    },
    admin,
  );

  return { ok: true, lspId: createdLsp.id };
}
