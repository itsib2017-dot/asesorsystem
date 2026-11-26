import path from "node:path";
import { isUuid } from "@/db";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getUser } from "@/lib/auth/get-session";
import { apiError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { downloadPublicDriveFileBuffer } from "@/services/drive-extract";

function sanitizeDownloadFilename(rawName: string): string {
  const base = path.basename(rawName || "berkas").replace(/[\r\n"\\/]/g, "_").trim();
  return base || "berkas";
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const { id: batchId, fileId } = await context.params;
  if (!isUuid(batchId) || !isUuid(fileId)) {
    return apiError("VALIDATION_ERROR", "Parameter batch atau berkas tidak valid.");
  }

  const rl = checkRateLimit(`file-download:${user.id}`, 40, 60_000);
  if (!rl.allowed) {
    return apiError(
      "RATE_LIMITED",
      `Terlalu banyak permintaan unduhan. Coba lagi dalam ${rl.retryAfterSeconds} detik.`,
    );
  }

  const [batch, files] = await Promise.all([
    getBatchById(user.id, batchId),
    listDriveFilesForBatch(user.id, batchId),
  ]);
  if (!batch) {
    return apiError("NOT_FOUND", "Batch tidak ditemukan.");
  }

  const file = files.find((f) => f.id === fileId && f.batchId === batch.id);
  if (!file) {
    return apiError("NOT_FOUND", "Berkas tidak ditemukan pada batch ini.");
  }

  const safeName = sanitizeDownloadFilename(file.fileName);
  let bytes: Buffer;
  let contentType = file.mimeType || "application/octet-stream";
  let downloadName = safeName;

  if (!file.driveFileId || file.driveFileId.startsWith("manual-")) {
    const manualText = file.extractedText?.trim();
    if (!manualText) {
      return apiError(
        "NOT_FOUND",
        "Berkas manual ini belum memiliki teks untuk diunduh.",
      );
    }
    bytes = Buffer.from(manualText, "utf8");
    contentType = "text/plain; charset=utf-8";
    downloadName = safeName.toLowerCase().endsWith(".txt") ? safeName : `${safeName}.txt`;
  } else {
    try {
      bytes = await downloadPublicDriveFileBuffer({
        driveFileId: file.driveFileId,
        apiKey: process.env.GOOGLE_DRIVE_API_KEY,
      });
    } catch (err) {
      return apiError(
        "SERVICE_UNAVAILABLE",
        err instanceof Error
          ? err.message
          : "Gagal mengunduh berkas asli dari Google Drive.",
      );
    }
  }

  const supabase = await getSupabaseServerClient();
  await writeAuditLog(
    {
      lsp_id: batch.lspId,
      actor_id: user.id,
      action: "file.download",
      resource: "drive_files",
      resource_id: file.id,
      after_summary: {
        batchId: batch.id,
        docType: file.docType,
        fileName: downloadName,
      },
    },
    supabase,
  );

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
