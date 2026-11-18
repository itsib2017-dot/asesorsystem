import { getUser } from "@/lib/auth/get-session";
import { apiError } from "@/lib/errors";
import {
  generateAk05Docx,
  generateAk05Pdf,
  validateExportFormat,
  type ExportFormat,
} from "@/services/export";
import { getBatchById } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { getAssessorProfile } from "@/repositories/auth.repository";
import { getAk05ReportForBatch } from "@/repositories/assessment.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function extractSchemeNumber(name?: string, fallback?: string): string {
  if (name) {
    const match = name.match(/\((SKM\/[^)]+)\)/i);
    if (match?.[1]) return match[1].trim();
  }
  return fallback || "-";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "pdf") as ExportFormat;
  const check = validateExportFormat("ak05", format);
  if (!check.allowed) {
    return apiError("EXPORT_FORMAT_NOT_ALLOWED", check.reason);
  }

  const { id: batchId } = await context.params;
  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return apiError("NOT_FOUND", "Batch tidak ditemukan.");
  }

  const signature = await getActiveSignature(user.id);
  if (!signature) {
    return apiError(
      "NO_ACTIVE_SIGNATURE",
      "Tanda tangan belum diunggah. Unggah tanda tangan di Pengaturan → Profil sebelum mengekspor AK.05.",
    );
  }

  const [assessees, profile, schemes, report] = await Promise.all([
    listAssesseesByBatch(user.id, batchId),
    getAssessorProfile(user.id),
    listSchemes(user.id, batch.lspId),
    getAk05ReportForBatch(user.id, batchId),
  ]);

  const unconfirmed = assessees.filter((a) => !a.certificateNameConfirmed);
  if (unconfirmed.length > 0) {
    return apiError(
      "UNPROCESSABLE",
      `Ekspor diblokir: ${unconfirmed.length} asesi belum memiliki konfirmasi nama sertifikat.`,
    );
  }

  let signatureBytes: Buffer | undefined;
  try {
    const supabase = await getSupabaseServerClient();
    const { data: blob } = await supabase.storage
      .from("signatures")
      .download(signature.storagePath);
    if (blob) {
      signatureBytes = Buffer.from(await blob.arrayBuffer());
    }
  } catch {
    signatureBytes = undefined;
  }

  if (!signatureBytes && signature.signedUrl) {
    try {
      const res = await fetch(signature.signedUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        signatureBytes = Buffer.from(await res.arrayBuffer());
      }
    } catch {
      signatureBytes = undefined;
    }
  }

  const scheme = schemes.find((s) => s.id === batch.schemeId);
  const schemeTitle = scheme
    ? scheme.name.replace(/\s*\(SKM\/[^)]+\)/i, "").trim()
    : "Skema Tersertifikasi";
  const schemeNumber = extractSchemeNumber(
    scheme?.name,
    scheme?.manifest?.decisionRuleRef,
  );

  const payload = {
    schemeCode: scheme?.code ?? "SKEMA",
    schemeTitle,
    schemeNumber,
    tukName: batch.tukName ?? "-",
    tukType: (batch.tukType as "sewaktu" | "tempat_kerja" | "mandiri") ?? "sewaktu",
    assessorName: (profile?.fullName as string) || (profile?.full_name as string) || user.email || "Asesor",
    assessorRegNo: (profile?.regNoMet as string) || (profile?.reg_no_met as string) || "-",
    assessmentDate: batch.assessmentDate ?? new Date().toISOString().slice(0, 10),
    rows: assessees.map((a, idx) => ({
      no: idx + 1,
      assesseeName: a.certificateNameConfirmed || a.displayName,
      recommendation: "K" as const,
      keterangan: "",
    })),
    notesPositiveNegative: String(
      report?.notes_positive_negative ?? report?.notesPositiveNegative ?? "-",
    ),
    notesRejection: String(report?.notes_rejection ?? report?.notesRejection ?? "-"),
    notesImprovement: String(report?.notes_improvement ?? report?.notesImprovement ?? "-"),
    signaturePngBytes: signatureBytes,
    signatureMimeType:
      signature.mimeType === "image/jpeg" ? ("image/jpeg" as const) : ("image/png" as const),
  };

  if (format === "pdf") {
    const pdfBuf = await generateAk05Pdf(payload);
    return new Response(new Uint8Array(pdfBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="FR-AK-05-${batchId.slice(0, 8)}.pdf"`,
      },
    });
  }

  const docxBuf = await generateAk05Docx(payload);
  return new Response(new Uint8Array(docxBuf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="FR-AK-05-${batchId.slice(0, 8)}.docx"`,
    },
  });
}
