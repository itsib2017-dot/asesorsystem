"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireLspRole, resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { decryptSecret } from "@/lib/crypto/encryption";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAssesseeById,
  listAssesseesByBatch,
} from "@/repositories/assessees.repository";
import {
  addAssesseeAction as rosterAddAssessee,
  deleteAssesseeAction as rosterDeleteAssessee,
  importRosterFromSheetAction as rosterImportRoster,
  updateAssesseeAction as rosterUpdateAssessee,
} from "../roster-actions";
import {
  getBatchById,
  insertBatchRosterNote,
  listDriveFilesForBatch,
  updateDriveFileTriage,
} from "@/repositories/batches.repository";
import { getLatestProviderConfigForAssessor } from "@/repositories/provider.repository";
import { getSchemeById } from "@/repositories/schemes.repository";
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

  const [files, assessees, providerCfg, scheme] = await Promise.all([
    listDriveFilesForBatch(user.id, batchId),
    listAssesseesByBatch(user.id, batchId),
    getLatestProviderConfigForAssessor(user.id),
    getSchemeById(user.id, batch.schemeId),
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
    schemeForms: scheme?.forms,
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

const addRosterNoteSchema = z.object({
  batchId: z.string().uuid("Parameter batchId tidak valid."),
  beforeCount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(0).max(10000).nullable(),
  ),
  afterCount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(0).max(10000).nullable(),
  ),
  summary: z
    .string()
    .trim()
    .min(10, "Ringkasan perubahan minimal 10 karakter.")
    .max(600, "Ringkasan maksimal 600 karakter."),
  sourceLabel: z
    .string()
    .trim()
    .min(5, "Keterangan sumber minimal 5 karakter.")
    .max(200, "Keterangan sumber maksimal 200 karakter."),
  referenceDoc: z.string().trim().max(200).optional(),
});

export async function addBatchRosterNoteAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const parsed = addRosterNoteSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    beforeCount: String(formData.get("beforeCount") ?? "").trim(),
    afterCount: String(formData.get("afterCount") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    sourceLabel: String(formData.get("sourceLabel") ?? "").trim(),
    referenceDoc: String(formData.get("referenceDoc") ?? "").trim() || undefined,
  });

  if (!parsed.success) return;

  const { batchId, beforeCount, afterCount, summary, sourceLabel, referenceDoc } = parsed.data;
  const batch = await getBatchById(user.id, batchId);
  if (!batch) return;

  const authz = await requireLspRole(batch.lspId, user.id, [
    "lsp_admin",
    "tuk_admin",
    "assessor",
  ]);
  if (!authz.allowed) return;

  await insertBatchRosterNote({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    beforeCount,
    afterCount,
    summary,
    sourceKind: "manual_assessor_note",
    sourceLabel,
    referenceDoc: referenceDoc ?? null,
    eventOccurredAt: new Date().toISOString(),
  });

  revalidatePath(`/batches/${batchId}/triage`);
}

const BULK_SKIP_DOC_TYPES = new Set([
  "materi_pelatihan",
  "template_muk",
  "surat_tugas",
  "06a",
  "06b",
]);

const bulkAssignSchema = z.object({
  batchId: z.string().uuid(),
  assesseeId: z.string().uuid(),
});

export async function bulkAssignUnmatchedFilesAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const parsed = bulkAssignSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
  });
  if (!parsed.success) return;

  const { batchId, assesseeId } = parsed.data;
  const batch = await getBatchById(user.id, batchId);
  if (!batch) return;

  const authz = await requireLspRole(batch.lspId, user.id, [
    "lsp_admin",
    "tuk_admin",
    "assessor",
  ]);
  if (!authz.allowed) return;

  const assessee = await getAssesseeById(user.id, assesseeId);
  if (!assessee || assessee.batchId !== batch.id) return;

  const files = await listDriveFilesForBatch(user.id, batchId);
  const targets = files.filter(
    (f) =>
      f.triageStatus === "unmatched" &&
      !BULK_SKIP_DOC_TYPES.has((f.docType ?? "").toLowerCase()),
  );
  if (targets.length === 0) return;

  const CONCURRENCY = 4;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const slice = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map((f) =>
        updateDriveFileTriage({
          userId: user.id,
          fileId: f.id,
          assesseeId: assessee.id,
          triageStatus: "assigned",
        }),
      ),
    );
  }

  const skippedCount = files.filter(
    (f) =>
      f.triageStatus === "unmatched" &&
      BULK_SKIP_DOC_TYPES.has((f.docType ?? "").toLowerCase()),
  ).length;

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "triage.file.bulk_assign",
        resource: "batches",
        resource_id: batchId,
        after_summary: {
          assesseeId: assessee.id,
          assesseeName: assessee.displayName,
          assignedCount: targets.length,
          skippedCount,
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

/**
 * Thin void-returning wrappers around roster server actions so they can be
 * used directly as Next.js form `action` in a Server Component. Wrapping in a
 * "use server" file makes them recognizable as Server Actions by the
 * Next.js client boundary (production-enforced).
 */
export async function addAssesseeFormAction(formData: FormData): Promise<void> {
  await rosterAddAssessee(formData);
}
export async function updateAssesseeFormAction(formData: FormData): Promise<void> {
  await rosterUpdateAssessee(formData);
}
export async function deleteAssesseeFormAction(formData: FormData): Promise<void> {
  await rosterDeleteAssessee(formData);
}
export async function importRosterFormAction(formData: FormData): Promise<void> {
  await rosterImportRoster(formData);
}
