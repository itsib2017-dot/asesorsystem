import { findAssessorRoleForLsp, type LspRole } from "@/repositories/auth.repository";

export type { LspRole };

export async function getLspRole(lspId: string, assessorId: string): Promise<LspRole | null> {
  return findAssessorRoleForLsp(lspId, assessorId);
}
