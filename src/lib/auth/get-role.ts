import {
  findAssessorRoleForLsp,
  listUserMemberships,
  type LspRole,
} from "@/repositories/auth.repository";

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

export async function resolveAuthorizedLsp(
  assessorId: string,
  allowedRoles: LspRole[],
): Promise<{ allowed: boolean; lspId: string | null; role: LspRole | null }> {
  const memberships = await listUserMemberships(assessorId);
  const matched = memberships.find((m) => allowedRoles.includes(m.role));
  if (!matched) {
    return { allowed: false, lspId: null, role: memberships[0]?.role ?? null };
  }
  return { allowed: true, lspId: matched.lspId, role: matched.role };
}
