import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { upsertDriveFilesForBatch } from "@/repositories/batches.repository";
import { extractTextFromDocx } from "@/services/extract";

export type MasterKeyParseResult =
  | {
      ok: true;
      fileName: string;
      mimeType: string;
      text: string;
      extractionMethod: "raw_text" | "ooxml_docx";
    }
  | { ok: false; error: string };

const MAX_KEY_BYTES = 10 * 1024 * 1024;

export async function parseMasterKey06bFile(
  fileObj: File,
): Promise<MasterKeyParseResult> {
  if (fileObj.size <= 0) {
    return { ok: false, error: "Berkas kunci 06B kosong." };
  }
  if (fileObj.size > MAX_KEY_BYTES) {
    return { ok: false, error: "Ukuran file kunci 06B maksimal 10 MB." };
  }

  const fileNameLower = fileObj.name.toLowerCase();
  if (!fileNameLower.endsWith(".docx") && !fileNameLower.endsWith(".txt")) {
    return {
      ok: false,
      error: "Format berkas kunci 06B harus .docx atau .txt.",
    };
  }

  try {
    const buffer = Buffer.from(await fileObj.arrayBuffer());
    if (fileNameLower.endsWith(".txt")) {
      const text = buffer.toString("utf8").trim();
      if (!text) {
        return { ok: false, error: "Teks kunci jawaban 06B tidak ditemukan di dalam berkas." };
      }
      return {
        ok: true,
        fileName: fileObj.name,
        mimeType: fileObj.type || "text/plain",
        text,
        extractionMethod: "raw_text",
      };
    }

    const parsed = await extractTextFromDocx(buffer);
    if (!parsed.text.trim()) {
      return { ok: false, error: "Teks kunci jawaban 06B tidak ditemukan di dalam berkas." };
    }
    return {
      ok: true,
      fileName: fileObj.name,
      mimeType:
        fileObj.type ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      text: parsed.text.trim(),
      extractionMethod: "ooxml_docx",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal membaca berkas kunci 06B.",
    };
  }
}

export async function persistBatchMasterKey06b(params: {
  userId: string;
  lspId: string;
  batchId: string;
  fileName: string;
  mimeType: string;
  text: string;
  extractionMethod: "raw_text" | "ooxml_docx";
  assesseeId?: string;
  hasUploadedFile: boolean;
}): Promise<void> {
  await upsertDriveFilesForBatch({
    userId: params.userId,
    lspId: params.lspId,
    batchId: params.batchId,
    files: [
      {
        driveFileId: `manual-06b-${params.batchId}`,
        fileName: params.fileName,
        mimeType: params.mimeType,
        drivePath: `Manual Upload/${params.fileName}`,
        docType: "06b",
        confidence: 1,
        assesseeId: null,
        triageStatus: "assigned",
        extractedText: params.text,
        extractionMethod: params.extractionMethod,
      },
    ],
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: params.lspId,
        actor_id: params.userId,
        action: "written.key_06b.upload",
        resource: "batches",
        resource_id: params.batchId,
        after_summary: {
          fileName: params.fileName,
          hasUploadedFile: params.hasUploadedFile,
          masterKeyChars: params.text.length,
          ...(params.assesseeId ? { assesseeId: params.assesseeId } : {}),
        },
      },
      supabase,
    );
  } catch {
    // non-fatal audit log error
  }
}
