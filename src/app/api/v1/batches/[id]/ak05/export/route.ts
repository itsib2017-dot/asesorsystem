import { isUuid } from "@/db";
import { getUser } from "@/lib/auth/get-session";
import { apiError } from "@/lib/errors";
import {
  generateAk05Docx,
  generateAk05Pdf,
  resolveSchemeTemplateBuffer,
  validateExportFormat,
  type ExportFormat,
} from "@/services/export";
import { getBatchById } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { getAssessorProfile } from "@/repositories/auth.repository";
import { getAk05ReportForBatch } from "@/repositories/assessment.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { resolveAk05BatchRows } from "@/lib/ak05/rollup";
import {
  extractSchemeMeta,
  resolveSchemeUnitsList,
} from "@/lib/forms/assessee-forms";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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
  const rawAssesseeId = url.searchParams.get("assesseeId")?.trim() ?? "";
  if (rawAssesseeId && !isUuid(rawAssesseeId)) {
    return apiError("VALIDATION_ERROR", "Parameter assesseeId tidak valid.");
  }
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

  const singleAssessee = rawAssesseeId
    ? assessees.find((a) => a.id === rawAssesseeId) ?? null
    : null;
  if (rawAssesseeId && !singleAssessee) {
    return apiError("NOT_FOUND", "Asesi tidak ditemukan pada batch ini.");
  }

  const targetAssessees = singleAssessee ? [singleAssessee] : assessees;
  const unconfirmed = targetAssessees.filter((a) => !a.certificateNameConfirmed);
  if (unconfirmed.length > 0) {
    return apiError(
      "UNPROCESSABLE",
      singleAssessee
        ? "Ekspor AK.05 diblokir: nama sertifikat asesi ini belum dikonfirmasi (otoritas KTP)."
        : `Ekspor diblokir: ${unconfirmed.length} asesi belum memiliki konfirmasi nama sertifikat. Gunakan ekspor AK.05 per asesi untuk asesi yang sudah dikonfirmasi.`,
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

  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;
  const { schemeTitle, schemeNumber } = extractSchemeMeta(scheme);
  const schemeUnits = resolveSchemeUnitsList(scheme);

  const templateBuffer = await resolveSchemeTemplateBuffer({
    scheme,
    formKeys: ["ak05", "fr.ak.05", "frak05"],
    instrumentRoles: ["laporan"],
    defaultAk3uFileName: "FR.AK.05.LAPORAN_ASESMEN.docx",
    downloadFromStorage: async (storagePath) => {
      if (!storagePath.startsWith(`${batch.lspId}/`)) return undefined;
      const supabase = await getSupabaseServerClient();
      const { data: tplBlob } = await supabase.storage
        .from("scheme-blankos")
        .download(storagePath);
      return tplBlob ? Buffer.from(await tplBlob.arrayBuffer()) : undefined;
    },
  });

  const rollupRows = await resolveAk05BatchRows(user.id, batchId, targetAssessees, {
    totalSchemeUnits: schemeUnits.length,
  });

  const payload = {
    schemeCode: scheme?.code ?? "SKEMA",
    schemeTitle,
    schemeNumber,
    tukName: batch.tukName ?? "-",
    tukType: (batch.tukType as "sewaktu" | "tempat_kerja" | "mandiri") ?? "sewaktu",
    assessorName: (profile?.fullName as string) || (profile?.full_name as string) || user.email || "Asesor",
    assessorRegNo: (profile?.regNoMet as string) || (profile?.reg_no_met as string) || "-",
    assessmentDate: batch.assessmentDate ?? "",
    rows: rollupRows.map((r) => ({
      no: r.no,
      assesseeName: r.assesseeName,
      recommendation: r.recommendation,
      keterangan: r.keterangan,
    })),
    notesPositiveNegative: String(
      report?.notes_positive_negative ?? report?.notesPositiveNegative ?? "-",
    ),
    notesRejection: String(report?.notes_rejection ?? report?.notesRejection ?? "-"),
    notesImprovement: String(report?.notes_improvement ?? report?.notesImprovement ?? "-"),
    signaturePngBytes: signatureBytes,
    signatureMimeType:
      signature.mimeType === "image/jpeg" ? ("image/jpeg" as const) : ("image/png" as const),
    templateBuffer,
  };

  const fileSlug = singleAssessee
    ? `FR-AK-05-${batchId.slice(0, 8)}-${(singleAssessee.pseudonym || singleAssessee.id.slice(0, 8)).replace(/[^A-Za-z0-9_-]/g, "")}`
    : `FR-AK-05-${batchId.slice(0, 8)}`;

  if (format === "pdf") {
    const pdfBuf = await generateAk05Pdf(payload);
    return new Response(new Uint8Array(pdfBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileSlug}.pdf"`,
      },
    });
  }

  const docxBuf = await generateAk05Docx(payload);
  return new Response(new Uint8Array(docxBuf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileSlug}.docx"`,
    },
  });
}
