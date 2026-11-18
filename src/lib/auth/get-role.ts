import { findAssessorRoleForLsp, type LspRole } from "@/repositories/auth.repository";

export type { LspRole };

export async function getLspRole(lspId: string, assessorId: string): Promise<LspRole | null> {
  return findAssessorRoleForLsp(lspId, assessorId);
}

export async function requireLspRole(
  lspId: string,
  assessorId: string,
  allowedRoles: LspRole[],
): Promise<{ allowed: boolean; role: LspRole | null }> {
  const role = await getLspRole(lspId, assessorId);
  if (!role || !allowedRoles.includes(role)) {
    return { allowed: false, role };
  }
  return { allowed: true, role };
}
