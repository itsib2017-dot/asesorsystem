"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { decryptSecret } from "@/lib/crypto/encryption";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAssesseeById,
  listAssesseesByBatch,
} from "@/repositories/assessees.repository";
import {
  getBatchById,
  listDriveFilesForBatch,
  updateDriveFileTriage,
} from "@/repositories/batches.repository";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import { reclassifyBatchFilesByContent } from "@/services/drive-extract";

const triageSchema = z.object({
  batchId: z.string().uuid(),
  fileId: z.string().uuid(),
  assesseeId: z.string().uuid().nullable(),
  docType: z.string().trim().min(1).max(64).optional(),
  triageStatus: z.enum(["assigned", "not_needed", "unmatched", "unextractable"]),
});

export async function assignDriveFileAction(formData: FormData) {
  const user = await getUser();
  if (!user) return;

  const rawAssesseeId = String(formData.get("assesseeId") ?? "").trim();
  const rawDocType = String(formData.get("docType") ?? "").trim();
  const parsed = triageSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    fileId: String(formData.get("fileId") ?? "").trim(),
    assesseeId: rawAssesseeId || null,
    docType: rawDocType || undefined,
    triageStatus: String(formData.get("triageStatus") ?? "assigned").trim(),
  });

  if (!parsed.success) return;

  const { batchId, fileId, assesseeId, docType, triageStatus } = parsed.data;
  const [batch, authz] = await Promise.all([
    getBatchById(user.id, batchId),
    resolveAuthorizedLsp(user.id, ["lsp_admin", "tuk_admin", "assessor"]),
  ]);
  if (!batch || !authz.allowed) return;

  if (assesseeId) {
    const assessee = await getAssesseeById(user.id, assesseeId);
    if (!assessee || assessee.batchId !== batch.id) return;
  }

  await updateDriveFileTriage({
    userId: user.id,
    fileId,
    assesseeId,
    ...(docType ? { docType } : {}),
    triageStatus,
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "triage.file.update",
        resource: "batches",
        resource_id: batchId,
        after_summary: {
          fileId,
          assesseeId,
          docType: docType ?? null,
          triageStatus,
        },
      },
      supabase,
    );
  } catch {
    // non-fatal audit error
  }

  revalidatePath(`/batches/${batchId}/triage`);
  revalidatePath(`/batches/${batchId}`);
}

const reclassifyBatchSchema = z.object({
  batchId: z.string().uuid(),
});

export async function reclassifyBatchContentAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const parsed = reclassifyBatchSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
  });
  if (!parsed.success) return;

  const { batchId } = parsed.data;
  const [batch, authz] = await Promise.all([
    getBatchById(user.id, batchId),
    resolveAuthorizedLsp(user.id, ["lsp_admin", "tuk_admin", "assessor"]),
  ]);
  if (!batch || !authz.allowed) return;

  const [files, assessees, providerCfg] = await Promise.all([
    listDriveFilesForBatch(user.id, batchId),
    listAssesseesByBatch(user.id, batchId),
    getLatestProviderConfigForAssessor(user.id),
  ]);

  let apiKey: string | undefined;
  if (providerCfg?.googleDriveApiKeyEncrypted) {
    try {
      apiKey = decryptSecret(providerCfg.googleDriveApiKeyEncrypted) || undefined;
    } catch {
      apiKey = undefined;
    }
  }

  const summary = await reclassifyBatchFilesByContent({
    userId: user.id,
    files,
    assessees,
    apiKey,
    maxInspect: 12,
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "triage.content.reclassify",
        resource: "batches",
        resource_id: batchId,
        after_summary: summary,
      },
      supabase,
    );
  } catch {
    // non-fatal audit error
  }

  revalidatePath(`/batches/${batchId}/triage`);
  revalidatePath(`/batches/${batchId}`);
}
