import { getUser } from "@/lib/auth/get-session";
import { apiError } from "@/lib/errors";
import { loadBatchSimilarityReportData } from "@/lib/similarity/load-batch-similarity";
import {
  generateSimilarityReportDocx,
  validateExportFormat,
  type ExportFormat,
} from "@/services/export";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "docx") as ExportFormat;
  const check = validateExportFormat("similarity", format);
  if (!check.allowed) {
    return apiError("EXPORT_FORMAT_NOT_ALLOWED", check.reason);
  }

  const { id: batchId } = await context.params;
  const data = await loadBatchSimilarityReportData(user.id, batchId);
  if (!data) {
    return apiError("NOT_FOUND", "Batch tidak ditemukan.");
  }

  const docxBuffer = await generateSimilarityReportDocx({
    batchName: data.batch.name,
    schemeName: data.schemeName,
    thresholds: data.thresholds,
    thresholdsUncalibrated: data.thresholdsUncalibrated,
    assessees: data.assesseeSummaries,
    flaggedPairs: data.flaggedPairs,
  });

  const safeName = data.batch.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new Response(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Laporan_Kemiripan_Gabungan_${safeName}.docx"`,
    },
  });
}
