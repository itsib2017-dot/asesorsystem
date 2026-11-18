import { and, eq } from "drizzle-orm";
import { hasDatabaseUrl, withRlsTransaction } from "@/db";
import { lspMemberships, assessors } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type LspRole = "assessor" | "lsp_admin" | "tuk_admin";

export async function findAssessorRoleForLsp(
  lspId: string,
  assessorId: string,
): Promise<LspRole | null> {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(assessorId, (tx) =>
      tx
        .select({ role: lspMemberships.role })
        .from(lspMemberships)
        .where(
          and(
            eq(lspMemberships.lspId, lspId),
            eq(lspMemberships.assessorId, assessorId),
          ),
        )
        .limit(1),
    );
    return rows[0]?.role ?? null;
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("lsp_memberships")
    .select("role")
    .eq("lsp_id", lspId)
    .eq("assessor_id", assessorId)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as LspRole;
}

export async function listUserMemberships(assessorId: string) {
  if (hasDatabaseUrl()) {
    return withRlsTransaction(assessorId, (tx) =>
      tx
        .select({
          lspId: lspMemberships.lspId,
          role: lspMemberships.role,
        })
        .from(lspMemberships)
        .where(eq(lspMemberships.assessorId, assessorId)),
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("lsp_memberships")
    .select("lsp_id, role")
    .eq("assessor_id", assessorId);

  return (data ?? []).map((row) => ({
    lspId: row.lsp_id as string,
    role: row.role as LspRole,
  }));
}

export async function getAssessorProfile(assessorId: string) {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(assessorId, (tx) =>
      tx
        .select()
        .from(assessors)
        .where(eq(assessors.id, assessorId))
        .limit(1),
    );
    return rows[0] ?? null;
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("assessors")
    .select("*")
    .eq("id", assessorId)
    .maybeSingle();

  return data ?? null;
}
