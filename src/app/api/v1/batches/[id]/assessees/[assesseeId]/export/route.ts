import { getUser } from "@/lib/auth/get-session";
import { apiError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getBatchById } from "@/repositories/batches.repository";
import { getAssesseeById } from "@/repositories/assessees.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { getAssessorProfile } from "@/repositories/auth.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import {
  getLatestDitAnalysis,
  getLatestInterviewAssessment,
  getLatestWrittenGrading,
  listDecisionsForAssessee,
} from "@/repositories/assessment.repository";
import {
  generateAk02Docx,
  generateIa04bDocx,
  generateIa06cDocx,
  validateExportFormat,
  type ExportFormat,
} from "@/services/export";
import {
  buildAk02Payload,
  buildIa04bPayload,
  buildIa06cPayload,
  extractSchemeMeta,
  type RawDecisionRow,
} from "@/lib/forms/assessee-forms";

type AssesseeFormType = "ak02" | "ia04b" | "ia06";

const FORM_FILENAMES: Record<AssesseeFormType, string> = {
  ak02: "FR-AK-02",
  ia04b: "FR-IA-04B",
  ia06: "FR-IA-06C",
};

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; assesseeId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const url = new URL(req.url);
  const form = (url.searchParams.get("form") || "ak02") as AssesseeFormType;
  const format = (url.searchParams.get("format") || "docx") as ExportFormat;

  if (!["ak02", "ia04b", "ia06"].includes(form)) {
    return apiError("VALIDATION_ERROR", "Parameter form tidak valid (ak02, ia04b, ia06).");
  }

  const check = validateExportFormat(form, format);
  if (!check.allowed) {
    return apiError("EXPORT_FORMAT_NOT_ALLOWED", check.reason);
  }

  const { id: batchId, assesseeId } = await context.params;
  const [batch, assessee] = await Promise.all([
    getBatchById(user.id, batchId),
    getAssesseeById(user.id, assesseeId),
  ]);

  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return apiError("NOT_FOUND", "Batch atau asesi tidak ditemukan.");
  }

  if (!assessee.certificateNameConfirmed) {
    return apiError(
      "UNPROCESSABLE",
      "Ekspor dokumen resmi diblokir: nama sertifikat asesi (otoritas KTP) belum dikonfirmasi.",
    );
  }

  const signature = await getActiveSignature(user.id);
  if (!signature) {
    return apiError(
      "NO_ACTIVE_SIGNATURE",
      "Tanda tangan belum diunggah. Unggah tanda tangan di Pengaturan → Profil sebelum mengekspor dokumen.",
    );
  }

  const supabase = await getSupabaseServerClient();
  let signatureBytes: Buffer | undefined;
  try {
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

  const [profile, schemes, decisions, ditAnalysis, writtenGrading, interviewAssessment] = await Promise.all([
    getAssessorProfile(user.id),
    listSchemes(user.id, batch.lspId),
    listDecisionsForAssessee(user.id, assesseeId),
    getLatestDitAnalysis(user.id, assesseeId),
    getLatestWrittenGrading(user.id, assesseeId),
    getLatestInterviewAssessment(user.id, assesseeId),
  ]);

  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;
  const { schemeTitle, schemeNumber } = extractSchemeMeta(scheme);
  const assessorName =
    (profile?.fullName as string) || (profile?.full_name as string) || user.email || "Asesor";
  const assessorRegNo =
    (profile?.regNoMet as string) || (profile?.reg_no_met as string) || "-";
  const assessmentDate = batch.assessmentDate ?? new Date().toISOString().slice(0, 10);
  const signatureMimeType =
    signature.mimeType === "image/jpeg" ? ("image/jpeg" as const) : ("image/png" as const);
  const rawDecisions = decisions as unknown as RawDecisionRow[];

  let docxBuf: Buffer;
  if (form === "ak02") {
    docxBuf = await generateAk02Docx(
      buildAk02Payload({
        schemeTitle,
        schemeNumber,
        tukType: batch.tukType,
        assessorName,
        assessorRegNo,
        assesseeName: assessee.certificateNameConfirmed,
        assessmentDate,
        decisions: rawDecisions,
        hasDit: Boolean(ditAnalysis),
        hasWritten: Boolean(writtenGrading),
        hasInterview: Boolean(interviewAssessment),
        signaturePngBytes: signatureBytes,
        signatureMimeType,
      }),
    );
  } else if (form === "ia04b") {
    docxBuf = await generateIa04bDocx(
      buildIa04bPayload({
        schemeTitle,
        schemeNumber,
        tukType: batch.tukType,
        assessorName,
        assessorRegNo,
        assesseeName: assessee.certificateNameConfirmed,
        assessmentDate,
        ditAnalysis: ditAnalysis as Record<string, unknown> | null,
        decisions: rawDecisions,
        signaturePngBytes: signatureBytes,
        signatureMimeType,
      }),
    );
  } else {
    docxBuf = await generateIa06cDocx(
      buildIa06cPayload({
        schemeTitle,
        schemeNumber,
        tukType: batch.tukType,
        assessorName,
        assessorRegNo,
        assesseeName: assessee.certificateNameConfirmed,
        assessmentDate,
        writtenGrading: writtenGrading as Record<string, unknown> | null,
        signaturePngBytes: signatureBytes,
        signatureMimeType,
      }),
    );
  }

  await writeAuditLog(
    {
      lsp_id: batch.lspId,
      actor_id: user.id,
      action: `export.${form}`,
      resource: "assessees",
      resource_id: assessee.id,
      after_summary: {
        batchId: batch.id,
        form,
        format,
      },
    },
    supabase,
  );

  const safeSlug = assessee.certificateNameConfirmed
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || assessee.id.slice(0, 8);

  return new Response(new Uint8Array(docxBuf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${FORM_FILENAMES[form]}-${safeSlug}.docx"`,
    },
  });
}
