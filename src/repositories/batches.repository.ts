import { desc, eq } from "drizzle-orm";
import { hasDatabaseUrl, withRlsTransaction } from "@/db";
import { batches, batchAssessors, driveFiles } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface BatchSummary {
  id: string;
  lspId: string;
  schemeId: string;
  name: string;
  status: string;
  tukName: string | null;
  tukType: string | null;
  assessmentDate: string | null;
  driveFolderUrl: string | null;
  kelompokSheetUrl: string | null;
  createdBy: string;
  createdAt: string;
}

export interface DriveFileRecord {
  id: string;
  lspId: string;
  batchId: string;
  assesseeId: string | null;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  drivePath: string;
  docType: string;
  classificationConfidence: number;
  triageStatus: "unmatched" | "suggested" | "assigned" | "not_needed";
  triageReason: string | null;
  extractedText: string | null;
  extractionMethod: string | null;
  ocrConfidence: number | null;
}

export async function listBatchesForUser(userId: string): Promise<BatchSummary[]> {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx.select().from(batches).orderBy(desc(batches.createdAt)),
    );
    return rows.map((r) => ({
      id: r.id,
      lspId: r.lspId,
      schemeId: r.schemeId,
      name: r.name,
      status: r.status,
      tukName: r.tukName,
      tukType: r.tukType,
      assessmentDate: r.assessmentDate,
      driveFolderUrl: r.driveFolderUrl,
      kelompokSheetUrl: r.kelompokSheetUrl,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("batches")
    .select("*")
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    lspId: r.lsp_id as string,
    schemeId: r.scheme_id as string,
    name: r.name as string,
    status: r.status as string,
    tukName: (r.tuk_name as string | null) ?? null,
    tukType: (r.tuk_type as string | null) ?? null,
    assessmentDate: (r.assessment_date as string | null) ?? null,
    driveFolderUrl: (r.drive_folder_url as string | null) ?? null,
    kelompokSheetUrl: (r.kelompok_sheet_url as string | null) ?? null,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
  }));
}

export async function getBatchById(userId: string, batchId: string): Promise<BatchSummary | null> {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx.select().from(batches).where(eq(batches.id, batchId)).limit(1),
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      lspId: r.lspId,
      schemeId: r.schemeId,
      name: r.name,
      status: r.status,
      tukName: r.tukName,
      tukType: r.tukType,
      assessmentDate: r.assessmentDate,
      driveFolderUrl: r.driveFolderUrl,
      kelompokSheetUrl: r.kelompokSheetUrl,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    };
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("batches").select("*").eq("id", batchId).maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    lspId: data.lsp_id as string,
    schemeId: data.scheme_id as string,
    name: data.name as string,
    status: data.status as string,
    tukName: (data.tuk_name as string | null) ?? null,
    tukType: (data.tuk_type as string | null) ?? null,
    assessmentDate: (data.assessment_date as string | null) ?? null,
    driveFolderUrl: (data.drive_folder_url as string | null) ?? null,
    kelompokSheetUrl: (data.kelompok_sheet_url as string | null) ?? null,
    createdBy: data.created_by as string,
    createdAt: data.created_at as string,
  };
}

export async function createBatchRecord(params: {
  userId: string;
  lspId: string;
  schemeId: string;
  name: string;
  tukName?: string;
  tukType?: "sewaktu" | "tempat_kerja" | "mandiri";
  driveFolderUrl?: string;
  kelompokSheetUrl?: string;
}): Promise<{ ok: true; batchId: string } | { ok: false; error: string }> {
  if (hasDatabaseUrl()) {
    try {
      const id = await withRlsTransaction(params.userId, async (tx) => {
        const [row] = await tx
          .insert(batches)
          .values({
            lspId: params.lspId,
            schemeId: params.schemeId,
            name: params.name,
            tukName: params.tukName ?? null,
            tukType: params.tukType ?? "sewaktu",
            driveFolderUrl: params.driveFolderUrl ?? null,
            kelompokSheetUrl: params.kelompokSheetUrl ?? null,
            createdBy: params.userId,
          })
          .returning({ id: batches.id });

        if (!row) throw new Error("Failed to insert batch");

        await tx
          .insert(batchAssessors)
          .values({
            batchId: row.id,
            lspId: params.lspId,
            assessorId: params.userId,
          })
          .onConflictDoNothing();

        return row.id;
      });
      return { ok: true, batchId: id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "DB error" };
    }
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("batches")
    .insert({
      lsp_id: params.lspId,
      scheme_id: params.schemeId,
      name: params.name,
      tuk_name: params.tukName ?? null,
      tuk_type: params.tukType ?? "sewaktu",
      drive_folder_url: params.driveFolderUrl ?? null,
      kelompok_sheet_url: params.kelompokSheetUrl ?? null,
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Gagal membuat batch" };
  }

  await supabase.from("batch_assessors").upsert({
    batch_id: data.id,
    lsp_id: params.lspId,
    assessor_id: params.userId,
  });

  return { ok: true, batchId: data.id as string };
}

export async function listDriveFilesForBatch(
  userId: string,
  batchId: string,
): Promise<DriveFileRecord[]> {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx.select().from(driveFiles).where(eq(driveFiles.batchId, batchId)),
    );
    return rows.map((r) => ({
      id: r.id,
      lspId: r.lspId,
      batchId: r.batchId,
      assesseeId: r.assesseeId,
      driveFileId: r.driveFileId,
      fileName: r.fileName,
      mimeType: r.mimeType,
      drivePath: r.drivePath,
      docType: r.docType,
      classificationConfidence: Number(r.classificationConfidence),
      triageStatus: r.triageStatus as DriveFileRecord["triageStatus"],
      triageReason: r.triageReason,
      extractedText: r.extractedText,
      extractionMethod: r.extractionMethod,
      ocrConfidence: r.ocrConfidence ? Number(r.ocrConfidence) : null,
    }));
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("drive_files").select("*").eq("batch_id", batchId);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    lspId: r.lsp_id as string,
    batchId: r.batch_id as string,
    assesseeId: (r.assessee_id as string | null) ?? null,
    driveFileId: r.drive_file_id as string,
    fileName: r.file_name as string,
    mimeType: r.mime_type as string,
    drivePath: (r.drive_path as string) ?? "",
    docType: r.doc_type as string,
    classificationConfidence: Number(r.classification_confidence ?? 0),
    triageStatus: r.triage_status as DriveFileRecord["triageStatus"],
    triageReason: (r.triage_reason as string | null) ?? null,
    extractedText: (r.extracted_text as string | null) ?? null,
    extractionMethod: (r.extraction_method as string | null) ?? null,
    ocrConfidence: r.ocr_confidence != null ? Number(r.ocr_confidence) : null,
  }));
}

export async function updateDriveFileTriage(params: {
  userId: string;
  fileId: string;
  assesseeId: string | null;
  docType?: string;
  triageStatus: "assigned" | "not_needed" | "unmatched";
  triageReason?: string;
}) {
  if (hasDatabaseUrl()) {
    await withRlsTransaction(params.userId, (tx) =>
      tx
        .update(driveFiles)
        .set({
          assesseeId: params.assesseeId,
          ...(params.docType ? { docType: params.docType } : {}),
          triageStatus: params.triageStatus,
          triageReason: params.triageReason ?? null,
        })
        .where(eq(driveFiles.id, params.fileId)),
    );
    return;
  }

  const supabase = await getSupabaseServerClient();
  await supabase
    .from("drive_files")
    .update({
      assessee_id: params.assesseeId,
      ...(params.docType ? { doc_type: params.docType } : {}),
      triage_status: params.triageStatus,
      triage_reason: params.triageReason ?? null,
    })
    .eq("id", params.fileId);
}
