import { getAssessorProfile } from "@/repositories/auth.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import { getBatchById } from "@/repositories/batches.repository";
import { getAssesseeById } from "@/repositories/assessees.repository";
import { extractSchemeMeta } from "@/lib/forms/assessee-forms";

export async function loadAssesseeCommonFormMeta(params: {
  userId: string;
  userEmail?: string | null;
  batchId: string;
  assesseeId: string;
}) {
  const [batch, assessee] = await Promise.all([
    getBatchById(params.userId, params.batchId),
    getAssesseeById(params.userId, params.assesseeId),
  ]);

  if (!batch || !assessee || assessee.batchId !== batch.id) {
    return null;
  }

  const [profile, schemes, signature] = await Promise.all([
    getAssessorProfile(params.userId),
    listSchemes(params.userId, batch.lspId),
    getActiveSignature(params.userId),
  ]);

  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;
  const { schemeTitle, schemeNumber } = extractSchemeMeta(scheme);
  const assessorName =
    (profile?.fullName as string) ||
    (profile?.full_name as string) ||
    params.userEmail ||
    "Asesor";
  const assessorRegNo =
    (profile?.regNoMet as string) || (profile?.reg_no_met as string) || "-";
  const assessmentDate = batch.assessmentDate ?? "";

  return {
    batch,
    assessee,
    scheme,
    schemeTitle,
    schemeNumber,
    assessorName,
    assessorRegNo,
    assessmentDate,
    hasActiveSignature: Boolean(signature),
    signatureUrl: signature?.signedUrl,
    isNameConfirmed: Boolean(assessee.certificateNameConfirmed),
    officialAssesseeName: assessee.certificateNameConfirmed || assessee.displayName,
  };
}
