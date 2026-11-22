import { and, desc, eq, sql } from "drizzle-orm";
import { isUuid, runRepositoryDualPath } from "@/db";
import { assessees, batchAssessors, batchRosterNotes, batches, driveFiles } from "@/db/schema";
import { normalizeOcrConfidence } from "@/lib/ocr/confidence";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type MasterKeySource =
  | "assessor_upload"
  | "manual_text"
  | "drive_file"
  | "archive_extract";

export type MasterKeyValidationStatus =
  | "valid"
  | "empty_or_blanko"
  | "encrypted_unreadable";

export type BatchRosterNoteSourceKind =
  | "developer_remediation"
  | "manual_assessor_note"
  | "system_migration";

export interface BatchRosterNoteRecord {
  id: string;
  lspId: string;
  batchId: string;
  beforeCount: number | null;
  afterCount: number | null;
  summary: string;
  sourceKind: BatchRosterNoteSourceKind;
  sourceLabel: string;
  referenceDoc: string | null;
  eventOccurredAt: string | null;
  recordedBy: string | null;
  createdAt: string;
}

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
  activeMasterKeyFileId: string | null;
  activeMasterKeySource: MasterKeySource | null;
  activeMasterKeyValidationStatus: MasterKeyValidationStatus | null;
  activeMasterKeyValidationSummary: string | null;
  activeMasterKeyActivatedAt: string | null;
  activeMasterKeyActivatedBy: string | null;
  createdBy: string;
  createdAt: string;
}

export type DriveTriageStatus =
  | "unmatched"
  | "suggested"
  | "assigned"
  | "not_needed"
  | "unextractable";

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
  triageStatus: DriveTriageStatus;
  triageReason: string | null;
  extractedText: string | null;
  extractionMethod: string | null;
  ocrConfidence: number | null;
  driveModifiedTime: string | null;
  archiveParentId: string | null;
  archiveEntryPath: string | null;
}

function mapDrizzleBatchRow(r: typeof batches.$inferSelect): BatchSummary {
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
    activeMasterKeyFileId: r.activeMasterKeyFileId ?? null,
    activeMasterKeySource: (r.activeMasterKeySource as MasterKeySource | null) ?? null,
    activeMasterKeyValidationStatus:
      (r.activeMasterKeyValidationStatus as MasterKeyValidationStatus | null) ?? null,
    activeMasterKeyValidationSummary: r.activeMasterKeyValidationSummary ?? null,
    activeMasterKeyActivatedAt: r.activeMasterKeyActivatedAt?.toISOString() ?? null,
    activeMasterKeyActivatedBy: r.activeMasterKeyActivatedBy ?? null,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

function mapSupabaseBatchRow(r: Record<string, unknown>): BatchSummary {
  return {
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
    activeMasterKeyFileId: (r.active_master_key_file_id as string | null) ?? null,
    activeMasterKeySource: (r.active_master_key_source as MasterKeySource | null) ?? null,
    activeMasterKeyValidationStatus:
      (r.active_master_key_validation_status as MasterKeyValidationStatus | null) ?? null,
    activeMasterKeyValidationSummary:
      (r.active_master_key_validation_summary as string | null) ?? null,
    activeMasterKeyActivatedAt: (r.active_master_key_activated_at as string | null) ?? null,
    activeMasterKeyActivatedBy: (r.active_master_key_activated_by as string | null) ?? null,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
  };
}

export async function listBatchesForUser(userId: string): Promise<BatchSummary[]> {
  return runRepositoryDualPath({
    userId,
    label: "BatchesRepository.listBatchesForUser",
    drizzle: async (tx) => {
      const rows = await tx.select().from(batches).orderBy(desc(batches.createdAt));
      return rows.map(mapDrizzleBatchRow);
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false });

      return (data ?? []).map((r) => mapSupabaseBatchRow(r as Record<string, unknown>));
    },
  });
}

export async function getBatchById(userId: string, batchId: string): Promise<BatchSummary | null> {
  if (!isUuid(batchId)) return null;
  return runRepositoryDualPath({
    userId,
    label: "BatchesRepository.getBatchById",
    drizzle: async (tx) => {
      const rows = await tx.select().from(batches).where(eq(batches.id, batchId)).limit(1);
      return rows[0] ? mapDrizzleBatchRow(rows[0]) : null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase.from("batches").select("*").eq("id", batchId).maybeSingle();
      return data ? mapSupabaseBatchRow(data as Record<string, unknown>) : null;
    },
  });
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
  try {
    return await runRepositoryDualPath({
      userId: params.userId,
      label: "BatchesRepository.createBatchRecord",
      drizzle: async (tx) => {
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

        return { ok: true, batchId: row.id } as const;
      },
      supabase: async () => {
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
          return { ok: false, error: error?.message ?? "Gagal membuat batch" } as const;
        }

        await supabase.from("batch_assessors").upsert({
          batch_id: data.id,
          lsp_id: params.lspId,
          assessor_id: params.userId,
        });

        return { ok: true, batchId: data.id as string } as const;
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB error" };
  }
}

function mapDrizzleDriveFileRow(r: typeof driveFiles.$inferSelect): DriveFileRecord {
  return {
    id: r.id,
    lspId: r.lspId,
    batchId: r.batchId,
    assesseeId: r.assesseeId,
    driveFileId: r.driveFileId,
    fileName: r.fileName,
    mimeType: r.mimeType,
    drivePath: r.drivePath ?? "",
    docType: r.docType,
    classificationConfidence: Number(r.classificationConfidence),
    triageStatus: r.triageStatus as DriveFileRecord["triageStatus"],
    triageReason: r.triageReason,
    extractedText: r.extractedText,
    extractionMethod: r.extractionMethod,
    ocrConfidence: r.ocrConfidence ? Number(r.ocrConfidence) : null,
    driveModifiedTime: r.driveModifiedTime?.toISOString() ?? null,
    archiveParentId: r.archiveParentId ?? null,
    archiveEntryPath: r.archiveEntryPath ?? null,
  };
}

function mapSupabaseDriveFileRow(r: Record<string, unknown>): DriveFileRecord {
  return {
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
    driveModifiedTime: (r.drive_modified_time as string | null) ?? null,
    archiveParentId: (r.archive_parent_id as string | null) ?? null,
    archiveEntryPath: (r.archive_entry_path as string | null) ?? null,
  };
}

export async function getDriveFileById(
  userId: string,
  fileId: string,
): Promise<DriveFileRecord | null> {
  if (!isUuid(fileId)) return null;
  return runRepositoryDualPath({
    userId,
    label: "BatchesRepository.getDriveFileById",
    drizzle: async (tx) => {
      const [row] = await tx.select().from(driveFiles).where(eq(driveFiles.id, fileId)).limit(1);
      return row ? mapDrizzleDriveFileRow(row) : null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("drive_files")
        .select("*")
        .eq("id", fileId)
        .maybeSingle();
      return data ? mapSupabaseDriveFileRow(data as Record<string, unknown>) : null;
    },
  });
}

export async function listDriveFilesForBatch(
  userId: string,
  batchId: string,
): Promise<DriveFileRecord[]> {
  if (!isUuid(batchId)) return [];
  return runRepositoryDualPath({
    userId,
    label: "BatchesRepository.listDriveFilesForBatch",
    drizzle: async (tx) => {
      const rows = await tx.select().from(driveFiles).where(eq(driveFiles.batchId, batchId));
      return rows.map(mapDrizzleDriveFileRow);
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase.from("drive_files").select("*").eq("batch_id", batchId);
      return (data ?? []).map((r) => mapSupabaseDriveFileRow(r as Record<string, unknown>));
    },
  });
}

export async function updateDriveFileTriage(params: {
  userId: string;
  fileId: string;
  assesseeId: string | null;
  docType?: string;
  triageStatus: "assigned" | "not_needed" | "unmatched" | "unextractable";
  triageReason?: string;
}): Promise<void> {
  return runRepositoryDualPath({
    userId: params.userId,
    label: "BatchesRepository.updateDriveFileTriage",
    drizzle: async (tx) => {
      await tx
        .update(driveFiles)
        .set({
          assesseeId: params.assesseeId,
          ...(params.docType ? { docType: params.docType } : {}),
          triageStatus: params.triageStatus,
          triageReason: params.triageReason ?? null,
        })
        .where(eq(driveFiles.id, params.fileId));
    },
    supabase: async () => {
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
    },
  });
}

const DRIVE_FILES_INSERT_CHUNK = 100;
const DRIVE_FILES_UPDATE_CHUNK = 20;

export async function upsertDriveFilesForBatch(params: {
  userId: string;
  lspId: string;
  batchId: string;
  files: Array<{
    driveFileId: string;
    fileName: string;
    mimeType: string;
    drivePath: string;
    docType: string;
    confidence: number;
    assesseeId?: string | null;
    triageStatus?: DriveTriageStatus;
    triageReason?: string | null;
    extractedText?: string | null;
    extractionMethod?: string | null;
    ocrConfidence?: number | null;
    driveModifiedTime?: string | null;
    archiveParentId?: string | null;
    archiveEntryPath?: string | null;
  }>;
}): Promise<number> {
  if (params.files.length === 0) return 0;

  return runRepositoryDualPath({
    userId: params.userId,
    label: "BatchesRepository.upsertDriveFiles",
    drizzle: async (tx) => {
      const existing = await tx
        .select({ id: driveFiles.id, driveFileId: driveFiles.driveFileId })
        .from(driveFiles)
        .where(eq(driveFiles.batchId, params.batchId));

      const existingMap = new Map(existing.map((r) => [r.driveFileId, r.id]));
      const toInsert: Array<typeof driveFiles.$inferInsert> = [];
      const toUpdate: Array<{ id: string; setPayload: Partial<typeof driveFiles.$inferInsert> }> = [];
      const now = new Date();

      for (const f of params.files) {
        const existingId = existingMap.get(f.driveFileId);
        const resolvedStatus =
          f.triageStatus ?? (f.assesseeId ? "assigned" : "unmatched");
        const parsedModified =
          f.driveModifiedTime && !Number.isNaN(Date.parse(f.driveModifiedTime))
            ? new Date(f.driveModifiedTime)
            : undefined;
        if (existingId) {
          toUpdate.push({
            id: existingId,
            setPayload: {
              fileName: f.fileName,
              mimeType: f.mimeType,
              drivePath: f.drivePath,
              docType: f.docType,
              classificationConfidence: f.confidence.toFixed(4),
              ...(f.assesseeId !== undefined ? { assesseeId: f.assesseeId } : {}),
              ...(f.assesseeId || f.triageStatus ? { triageStatus: resolvedStatus } : {}),
              ...(f.triageReason !== undefined ? { triageReason: f.triageReason } : {}),
              ...(f.extractedText !== undefined ? { extractedText: f.extractedText } : {}),
              ...(f.extractionMethod !== undefined ? { extractionMethod: f.extractionMethod } : {}),
              ...(f.ocrConfidence !== undefined && f.ocrConfidence !== null
                ? { ocrConfidence: f.ocrConfidence.toFixed(4) }
                : {}),
              ...(parsedModified ? { driveModifiedTime: parsedModified } : {}),
              ...(f.archiveParentId !== undefined ? { archiveParentId: f.archiveParentId } : {}),
              ...(f.archiveEntryPath !== undefined ? { archiveEntryPath: f.archiveEntryPath } : {}),
              updatedAt: now,
            },
          });
        } else {
          toInsert.push({
            lspId: params.lspId,
            batchId: params.batchId,
            assesseeId: f.assesseeId ?? null,
            driveFileId: f.driveFileId,
            fileName: f.fileName,
            mimeType: f.mimeType,
            drivePath: f.drivePath,
            docType: f.docType,
            classificationConfidence: f.confidence.toFixed(4),
            triageStatus: resolvedStatus,
            triageReason: f.triageReason ?? null,
            extractedText: f.extractedText ?? null,
            extractionMethod: f.extractionMethod ?? null,
            ocrConfidence:
              f.ocrConfidence != null ? f.ocrConfidence.toFixed(4) : null,
            driveModifiedTime: parsedModified ?? null,
            archiveParentId: f.archiveParentId ?? null,
            archiveEntryPath: f.archiveEntryPath ?? null,
          });
        }
      }

      let saved = 0;
      for (let i = 0; i < toInsert.length; i += DRIVE_FILES_INSERT_CHUNK) {
        const chunk = toInsert.slice(i, i + DRIVE_FILES_INSERT_CHUNK);
        await tx.insert(driveFiles).values(chunk);
        saved += chunk.length;
      }

      for (let i = 0; i < toUpdate.length; i += DRIVE_FILES_UPDATE_CHUNK) {
        const chunk = toUpdate.slice(i, i + DRIVE_FILES_UPDATE_CHUNK);
        for (const item of chunk) {
          await tx.update(driveFiles).set(item.setPayload).where(eq(driveFiles.id, item.id));
          saved++;
        }
      }

      return saved;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data: existingRows } = await supabase
        .from("drive_files")
        .select("id, drive_file_id")
        .eq("batch_id", params.batchId);

      const existingMap = new Map<string, string>(
        (existingRows ?? []).map((r) => [String(r.drive_file_id), String(r.id)]),
      );

      const toInsert: Array<Record<string, unknown>> = [];
      const toUpdate: Array<{ id: string; payload: Record<string, unknown> }> = [];
      const nowIso = new Date().toISOString();

      for (const f of params.files) {
        const existingId = existingMap.get(f.driveFileId);
        const resolvedStatus = f.triageStatus ?? (f.assesseeId ? "assigned" : "unmatched");
        const hasModified =
          Boolean(f.driveModifiedTime) && !Number.isNaN(Date.parse(String(f.driveModifiedTime)));
        if (existingId) {
          toUpdate.push({
            id: existingId,
            payload: {
              file_name: f.fileName,
              mime_type: f.mimeType,
              drive_path: f.drivePath,
              doc_type: f.docType,
              classification_confidence: f.confidence,
              ...(f.assesseeId !== undefined ? { assessee_id: f.assesseeId } : {}),
              ...(f.assesseeId || f.triageStatus ? { triage_status: resolvedStatus } : {}),
              ...(f.triageReason !== undefined ? { triage_reason: f.triageReason } : {}),
              ...(f.extractedText !== undefined ? { extracted_text: f.extractedText } : {}),
              ...(f.extractionMethod !== undefined ? { extraction_method: f.extractionMethod } : {}),
              ...(f.ocrConfidence !== undefined ? { ocr_confidence: f.ocrConfidence } : {}),
              ...(hasModified ? { drive_modified_time: f.driveModifiedTime } : {}),
              ...(f.archiveParentId !== undefined ? { archive_parent_id: f.archiveParentId } : {}),
              ...(f.archiveEntryPath !== undefined ? { archive_entry_path: f.archiveEntryPath } : {}),
              updated_at: nowIso,
            },
          });
        } else {
          toInsert.push({
            lsp_id: params.lspId,
            batch_id: params.batchId,
            assessee_id: f.assesseeId ?? null,
            drive_file_id: f.driveFileId,
            file_name: f.fileName,
            mime_type: f.mimeType,
            drive_path: f.drivePath,
            doc_type: f.docType,
            classification_confidence: f.confidence,
            triage_status: resolvedStatus,
            triage_reason: f.triageReason ?? null,
            extracted_text: f.extractedText ?? null,
            extraction_method: f.extractionMethod ?? null,
            ocr_confidence: f.ocrConfidence ?? null,
            drive_modified_time: hasModified ? f.driveModifiedTime : null,
            archive_parent_id: f.archiveParentId ?? null,
            archive_entry_path: f.archiveEntryPath ?? null,
          });
        }
      }

      let saved = 0;
      for (let i = 0; i < toInsert.length; i += DRIVE_FILES_INSERT_CHUNK) {
        const chunk = toInsert.slice(i, i + DRIVE_FILES_INSERT_CHUNK);
        const { error } = await supabase.from("drive_files").insert(chunk);
        if (!error) saved += chunk.length;
      }

      for (let i = 0; i < toUpdate.length; i += DRIVE_FILES_UPDATE_CHUNK) {
        const chunk = toUpdate.slice(i, i + DRIVE_FILES_UPDATE_CHUNK);
        const results = await Promise.all(
          chunk.map((item) =>
            supabase.from("drive_files").update(item.payload).eq("id", item.id),
          ),
        );
        saved += results.filter((r) => !r.error).length;
      }

      return saved;
    },
  });
}

export async function updateDriveFileExtraction(params: {
  userId: string;
  fileId: string;
  extractedText: string;
  extractionMethod: string;
  ocrConfidence?: number | null;
}): Promise<void> {
  const now = new Date();
  const normalizedOcr =
    params.ocrConfidence != null ? normalizeOcrConfidence(params.ocrConfidence) : null;
  return runRepositoryDualPath({
    userId: params.userId,
    label: "BatchesRepository.updateDriveFileExtraction",
    drizzle: async (tx) => {
      await tx
        .update(driveFiles)
        .set({
          extractedText: params.extractedText,
          extractionMethod: params.extractionMethod,
          ocrConfidence: normalizedOcr != null ? normalizedOcr.toFixed(4) : null,
          updatedAt: now,
        })
        .where(eq(driveFiles.id, params.fileId));
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase
        .from("drive_files")
        .update({
          extracted_text: params.extractedText,
          extraction_method: params.extractionMethod,
          ocr_confidence: normalizedOcr,
          updated_at: now.toISOString(),
        })
        .eq("id", params.fileId);
      if (error) {
        throw new Error(`DRIVE_FILE_EXTRACTION_UPDATE_FAILED: ${error.message}`);
      }
    },
  });
}

export async function updateDriveFileClassification(params: {
  userId: string;
  fileId: string;
  docType: string;
  confidence: number;
  triageReason: string;
  extractedText?: string | null;
  extractionMethod?: string | null;
  ocrConfidence?: number | null;
  assesseeId?: string | null;
  triageStatus?: "assigned" | "not_needed" | "unmatched";
}): Promise<void> {
  const now = new Date();
  return runRepositoryDualPath({
    userId: params.userId,
    label: "BatchesRepository.updateDriveFileClassification",
    drizzle: async (tx) => {
      await tx
        .update(driveFiles)
        .set({
          docType: params.docType,
          classificationConfidence: params.confidence.toFixed(4),
          triageReason: params.triageReason,
          ...(params.extractedText !== undefined ? { extractedText: params.extractedText } : {}),
          ...(params.extractionMethod !== undefined
            ? { extractionMethod: params.extractionMethod }
            : {}),
          ...(params.ocrConfidence !== undefined
            ? {
                ocrConfidence:
                  params.ocrConfidence != null ? params.ocrConfidence.toFixed(4) : null,
              }
            : {}),
          ...(params.assesseeId !== undefined ? { assesseeId: params.assesseeId } : {}),
          ...(params.triageStatus !== undefined ? { triageStatus: params.triageStatus } : {}),
          updatedAt: now,
        })
        .where(eq(driveFiles.id, params.fileId));
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      await supabase
        .from("drive_files")
        .update({
          doc_type: params.docType,
          classification_confidence: params.confidence,
          triage_reason: params.triageReason,
          ...(params.extractedText !== undefined ? { extracted_text: params.extractedText } : {}),
          ...(params.extractionMethod !== undefined
            ? { extraction_method: params.extractionMethod }
            : {}),
          ...(params.ocrConfidence !== undefined
            ? { ocr_confidence: params.ocrConfidence }
            : {}),
          ...(params.assesseeId !== undefined ? { assessee_id: params.assesseeId } : {}),
          ...(params.triageStatus !== undefined ? { triage_status: params.triageStatus } : {}),
          updated_at: now.toISOString(),
        })
        .eq("id", params.fileId);
    },
  });
}

export interface BatchResourceCounts {
  assesseeCount: number;
  fileCount: number;
}

export async function listBatchResourceCountsForUser(
  userId: string,
): Promise<Map<string, BatchResourceCounts>> {
  const counts = new Map<string, BatchResourceCounts>();
  const bump = (batchId: string, field: keyof BatchResourceCounts) => {
    const entry = counts.get(batchId) ?? { assesseeCount: 0, fileCount: 0 };
    entry[field] += 1;
    counts.set(batchId, entry);
  };

  return runRepositoryDualPath({
    userId,
    label: "BatchesRepository.listBatchResourceCounts",
    drizzle: async (tx) => {
      const [aRows, fRows] = await Promise.all([
        tx.select({ batchId: assessees.batchId }).from(assessees),
        tx.select({ batchId: driveFiles.batchId }).from(driveFiles),
      ]);
      for (const r of aRows) bump(r.batchId, "assesseeCount");
      for (const r of fRows) bump(r.batchId, "fileCount");
      return counts;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const [{ data: aRows }, { data: fRows }] = await Promise.all([
        supabase.from("assessees").select("batch_id"),
        supabase.from("drive_files").select("batch_id"),
      ]);

      for (const r of aRows ?? []) {
        if (r.batch_id) bump(String(r.batch_id), "assesseeCount");
      }
      for (const r of fRows ?? []) {
        if (r.batch_id) bump(String(r.batch_id), "fileCount");
      }

      return counts;
    },
  });
}

export async function getDriveFileByDriveFileId(
  userId: string,
  batchId: string,
  driveFileId: string,
): Promise<DriveFileRecord | null> {
  const trimmedDriveFileId = driveFileId.trim();
  if (!isUuid(batchId) || !trimmedDriveFileId) return null;
  return runRepositoryDualPath({
    userId,
    label: "BatchesRepository.getDriveFileByDriveFileId",
    drizzle: async (tx) => {
      const [row] = await tx
        .select()
        .from(driveFiles)
        .where(and(eq(driveFiles.batchId, batchId), eq(driveFiles.driveFileId, trimmedDriveFileId)))
        .limit(1);
      return row ? mapDrizzleDriveFileRow(row) : null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("drive_files")
        .select("*")
        .eq("batch_id", batchId)
        .eq("drive_file_id", trimmedDriveFileId)
        .maybeSingle();
      return data ? mapSupabaseDriveFileRow(data as Record<string, unknown>) : null;
    },
  });
}

/**
 * Sets a verified `drive_files` row as the explicit active FR.IA.06B master key for a batch
 * after verifying file ownership within the batch.
 */
export async function setBatchActiveMasterKey(params: {
  userId: string;
  batchId: string;
  fileId: string;
  source: MasterKeySource;
  validationStatus: MasterKeyValidationStatus;
  validationSummary: string;
  activatedAt?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(params.batchId) || !isUuid(params.fileId)) {
    return { ok: false, error: "Parameter ID batch atau berkas kunci 06B tidak valid." };
  }
  const activatedIso =
    params.activatedAt && !Number.isNaN(Date.parse(params.activatedAt))
      ? new Date(params.activatedAt).toISOString()
      : new Date().toISOString();

  return runRepositoryDualPath({
    userId: params.userId,
    label: "BatchesRepository.setBatchActiveMasterKey",
    drizzle: async (tx) => {
      const [targetFile] = await tx
        .select({ id: driveFiles.id })
        .from(driveFiles)
        .where(and(eq(driveFiles.id, params.fileId), eq(driveFiles.batchId, params.batchId)))
        .limit(1);
      if (!targetFile) {
        return { ok: false, error: "Berkas kunci 06B tidak ditemukan pada batch ini." } as const;
      }

      await tx
        .update(batches)
        .set({
          activeMasterKeyFileId: params.fileId,
          activeMasterKeySource: params.source,
          activeMasterKeyValidationStatus: params.validationStatus,
          activeMasterKeyValidationSummary: params.validationSummary,
          activeMasterKeyActivatedAt: new Date(activatedIso),
          activeMasterKeyActivatedBy: params.userId,
        })
        .where(eq(batches.id, params.batchId));
      return { ok: true } as const;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data: targetFile } = await supabase
        .from("drive_files")
        .select("id")
        .eq("id", params.fileId)
        .eq("batch_id", params.batchId)
        .maybeSingle();
      if (!targetFile) {
        return { ok: false, error: "Berkas kunci 06B tidak ditemukan pada batch ini." } as const;
      }

      const { error } = await supabase
        .from("batches")
        .update({
          active_master_key_file_id: params.fileId,
          active_master_key_source: params.source,
          active_master_key_validation_status: params.validationStatus,
          active_master_key_validation_summary: params.validationSummary,
          active_master_key_activated_at: activatedIso,
          active_master_key_activated_by: params.userId,
        })
        .eq("id", params.batchId);

      if (error) {
        return { ok: false, error: error.message } as const;
      }
      return { ok: true } as const;
    },
  });
}

/**
 * Deactivates the active 06B master key pointer on the batch without deleting any drive_files rows.
 */
export async function clearBatchActiveMasterKey(params: {
  userId: string;
  batchId: string;
}): Promise<void> {
  if (!isUuid(params.batchId)) return;
  return runRepositoryDualPath({
    userId: params.userId,
    label: "BatchesRepository.clearBatchActiveMasterKey",
    drizzle: async (tx) => {
      await tx
        .update(batches)
        .set({
          activeMasterKeyFileId: null,
          activeMasterKeySource: null,
          activeMasterKeyValidationStatus: null,
          activeMasterKeyValidationSummary: null,
          activeMasterKeyActivatedAt: null,
          activeMasterKeyActivatedBy: null,
        })
        .where(eq(batches.id, params.batchId));
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      await supabase
        .from("batches")
        .update({
          active_master_key_file_id: null,
          active_master_key_source: null,
          active_master_key_validation_status: null,
          active_master_key_validation_summary: null,
          active_master_key_activated_at: null,
          active_master_key_activated_by: null,
        })
        .eq("id", params.batchId);
    },
  });
}

function mapDrizzleRosterNoteRow(
  r: typeof batchRosterNotes.$inferSelect,
): BatchRosterNoteRecord {
  return {
    id: r.id,
    lspId: r.lspId,
    batchId: r.batchId,
    beforeCount: r.beforeCount ?? null,
    afterCount: r.afterCount ?? null,
    summary: r.summary,
    sourceKind: r.sourceKind as BatchRosterNoteSourceKind,
    sourceLabel: r.sourceLabel,
    referenceDoc: r.referenceDoc ?? null,
    eventOccurredAt: r.eventOccurredAt?.toISOString() ?? null,
    recordedBy: r.recordedBy ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function mapSupabaseRosterNoteRow(r: Record<string, unknown>): BatchRosterNoteRecord {
  return {
    id: String(r.id),
    lspId: String(r.lsp_id),
    batchId: String(r.batch_id),
    beforeCount: r.before_count != null ? Number(r.before_count) : null,
    afterCount: r.after_count != null ? Number(r.after_count) : null,
    summary: String(r.summary),
    sourceKind: r.source_kind as BatchRosterNoteSourceKind,
    sourceLabel: String(r.source_label),
    referenceDoc: (r.reference_doc as string | null) ?? null,
    eventOccurredAt: (r.event_occurred_at as string | null) ?? null,
    recordedBy: (r.recorded_by as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

export async function listBatchRosterNotes(
  userId: string,
  batchId: string,
): Promise<BatchRosterNoteRecord[]> {
  if (!isUuid(batchId)) return [];
  return runRepositoryDualPath({
    userId,
    label: "BatchesRepository.listBatchRosterNotes",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(batchRosterNotes)
        .where(eq(batchRosterNotes.batchId, batchId))
        .orderBy(
          desc(sql`coalesce(${batchRosterNotes.eventOccurredAt}, ${batchRosterNotes.createdAt})`),
          desc(batchRosterNotes.createdAt),
        );
      return rows.map(mapDrizzleRosterNoteRow);
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("batch_roster_notes")
        .select("*")
        .eq("batch_id", batchId)
        .order("event_occurred_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      return (data ?? []).map((r) => mapSupabaseRosterNoteRow(r as Record<string, unknown>));
    },
  });
}

export async function insertBatchRosterNote(params: {
  userId: string;
  lspId: string;
  batchId: string;
  beforeCount?: number | null;
  afterCount?: number | null;
  summary: string;
  sourceKind: BatchRosterNoteSourceKind;
  sourceLabel: string;
  referenceDoc?: string | null;
  eventOccurredAt?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isUuid(params.batchId) || !isUuid(params.lspId)) {
    return { ok: false, error: "ID batch atau LSP tidak valid." };
  }
  const eventIso =
    params.eventOccurredAt && !Number.isNaN(Date.parse(params.eventOccurredAt))
      ? new Date(params.eventOccurredAt).toISOString()
      : null;

  return runRepositoryDualPath({
    userId: params.userId,
    label: "BatchesRepository.insertBatchRosterNote",
    drizzle: async (tx) => {
      const [row] = await tx
        .insert(batchRosterNotes)
        .values({
          lspId: params.lspId,
          batchId: params.batchId,
          beforeCount: params.beforeCount ?? null,
          afterCount: params.afterCount ?? null,
          summary: params.summary.trim(),
          sourceKind: params.sourceKind,
          sourceLabel: params.sourceLabel.trim(),
          referenceDoc: params.referenceDoc?.trim() || null,
          eventOccurredAt: eventIso ? new Date(eventIso) : null,
          recordedBy: params.userId,
        })
        .returning({ id: batchRosterNotes.id });
      if (!row) {
        return { ok: false, error: "Gagal menyimpan catatan penyelarasan roster." } as const;
      }
      return { ok: true, id: row.id } as const;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("batch_roster_notes")
        .insert({
          lsp_id: params.lspId,
          batch_id: params.batchId,
          before_count: params.beforeCount ?? null,
          after_count: params.afterCount ?? null,
          summary: params.summary.trim(),
          source_kind: params.sourceKind,
          source_label: params.sourceLabel.trim(),
          reference_doc: params.referenceDoc?.trim() || null,
          event_occurred_at: eventIso,
          recorded_by: params.userId,
        })
        .select("id")
        .single();
      if (error || !data) {
        return {
          ok: false,
          error: error?.message ?? "Gagal menyimpan catatan penyelarasan roster.",
        } as const;
      }
      return { ok: true, id: String(data.id) } as const;
    },
  });
}
