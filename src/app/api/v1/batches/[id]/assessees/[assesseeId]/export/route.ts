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
  getAssesseeDecisionOverride,
  getLatestDitAnalysis,
  getLatestInterviewAssessment,
  getLatestWrittenGrading,
  listDecisionsForAssessee,
} from "@/repositories/assessment.repository";
import {
  generateAk02Docx,
  generateIa04aDocx,
  generateIa04bDocx,
  generateIa06cDocx,
  resolveSchemeTemplateBuffer,
  validateExportFormat,
  type ExportFormat,
} from "@/services/export";
import {
  deriveOfficialChannelVerdicts,
  resolveAssesseeOverallDecision,
  type UnitDecisionLike,
} from "@/lib/ak05/decision-rules";
import {
  buildAk02Payload,
  buildIa04aPayload,
  buildIa04bPayload,
  buildIa06cPayload,
  extractSchemeMeta,
  resolveSchemeUnitsList,
  type RawDecisionRow,
} from "@/lib/forms/assessee-forms";

type AssesseeFormType = "ak02" | "ia04a" | "ia04b" | "ia06";

const FORM_FILENAMES: Record<AssesseeFormType, string> = {
  ak02: "FR-AK-02",
  ia04a: "FR-IA-04A",
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

  if (!["ak02", "ia04a", "ia04b", "ia06"].includes(form)) {
    return apiError("VALIDATION_ERROR", "Parameter form tidak valid (ak02, ia04a, ia04b, ia06).");
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

  const [
    profile,
    schemes,
    decisions,
    decisionOverride,
    ditAnalysis,
    writtenGrading,
    interviewAssessment,
  ] = await Promise.all([
    getAssessorProfile(user.id),
    listSchemes(user.id, batch.lspId),
    listDecisionsForAssessee(user.id, assesseeId),
    getAssesseeDecisionOverride(user.id, assesseeId),
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
  const assessmentDate = batch.assessmentDate ?? "";
  const signatureMimeType =
    signature.mimeType === "image/jpeg" ? ("image/jpeg" as const) : ("image/png" as const);
  const rawDecisions = decisions as unknown as RawDecisionRow[];

  const downloadFromStorage = async (storagePath: string) => {
    if (!storagePath.startsWith(`${batch.lspId}/`)) return undefined;
    const { data: tplBlob } = await supabase.storage
      .from("scheme-blankos")
      .download(storagePath);
    return tplBlob ? Buffer.from(await tplBlob.arrayBuffer()) : undefined;
  };

  let docxBuf: Buffer;
  const resolvedOverall = resolveAssesseeOverallDecision({
    unitDecisions: rawDecisions as unknown as UnitDecisionLike[],
    totalSchemeUnits: resolveSchemeUnitsList(scheme).length,
    manualOverride: decisionOverride,
    channelVerdicts: deriveOfficialChannelVerdicts({
      ditAnalysis: ditAnalysis as Record<string, unknown> | null,
      writtenGrading: writtenGrading as Record<string, unknown> | null,
      interviewAssessment: interviewAssessment as Record<string, unknown> | null,
    }),
  });
  if (form === "ak02") {
    const templateBuffer = await resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["ak02", "fr.ak.02", "frak02"],
      instrumentRoles: ["keputusan"],
      defaultAk3uFileName: "FR.AK.02.REKAMAN_ASESMEN.docx",
      downloadFromStorage,
    });
    docxBuf = await generateAk02Docx({
      ...buildAk02Payload({
        scheme,
        schemeTitle,
        schemeNumber,
        tukType: batch.tukType,
        assessorName,
        assessorRegNo,
        assesseeName: assessee.certificateNameConfirmed,
        assessmentDate,
        decisions: rawDecisions,
        manualOverride: decisionOverride,
        resolvedOverall,
        hasDit: Boolean(ditAnalysis),
        hasWritten: Boolean(writtenGrading),
        hasInterview: Boolean(interviewAssessment),
        signaturePngBytes: signatureBytes,
        signatureMimeType,
      }),
      templateBuffer,
    });
  } else if (form === "ia04b") {
    const templateBuffer = await resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["04b", "ia04b", "fr.ia.04b", "fria04b"],
      instrumentRoles: ["presentation"],
      defaultAk3uFileName: "FR.IA.04B.PENILAIAN_PROYEK_SINGKAT.docx",
      downloadFromStorage,
    });
    docxBuf = await generateIa04bDocx({
      ...buildIa04bPayload({
        scheme,
        schemeTitle,
        schemeNumber,
        tukType: batch.tukType,
        assessorName,
        assessorRegNo,
        assesseeName: assessee.certificateNameConfirmed,
        assessmentDate,
        ditAnalysis: ditAnalysis as Record<string, unknown> | null,
        decisions: rawDecisions,
        manualOverride: decisionOverride,
        signaturePngBytes: signatureBytes,
        signatureMimeType,
      }),
      templateBuffer,
    });
  } else if (form === "ia04a") {
    const templateBuffer = await resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["ia04a", "04a", "fr.ia.04a", "fria04a"],
      defaultAk3uFileName: "FR.IA.04A.DIT.docx",
      downloadFromStorage,
    });
    docxBuf = await generateIa04aDocx({
      ...buildIa04aPayload({
        schemeTitle,
        schemeNumber,
        tukType: batch.tukType,
        assessorName,
        assessorRegNo,
        assesseeName: assessee.certificateNameConfirmed,
        assessmentDate,
        ditAnalysis: ditAnalysis as Record<string, unknown> | null,
      }),
      templateBuffer,
    });
  } else {
    const templateBuffer = await resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["06c", "ia06c", "ia06", "fr.ia.06c"],
      instrumentRoles: ["written_jawaban"],
      defaultAk3uFileName: "FR.IA.06C.LEMBAR_JAWABAN_TERTULIS.docx",
      downloadFromStorage,
    });
    docxBuf = await generateIa06cDocx({
      ...buildIa06cPayload({
        scheme,
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
      templateBuffer,
    });
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
