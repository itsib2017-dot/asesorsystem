import { eq, desc } from "drizzle-orm";
import { hasDatabaseUrl, withRlsTransaction } from "@/db";
import { assessees, nameJuryVerdicts } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface AssesseeRecord {
  id: string;
  lspId: string;
  batchId: string;
  assignedAssessorId: string | null;
  displayName: string;
  pseudonym: string | null;
  nikMasked: string | null;
  ktpNameOcr: string | null;
  apl01Name: string | null;
  suratTugasName: string | null;
  ijazahName: string | null;
  certificateNameConfirmed: string | null;
  certificateNameConfirmedAt: string | null;
  completenessStatus: string;
  status: string;
}

export async function listAssesseesByBatch(
  userId: string,
  batchId: string,
): Promise<AssesseeRecord[]> {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx.select().from(assessees).where(eq(assessees.batchId, batchId)),
    );
    return rows.map((r) => ({
      id: r.id,
      lspId: r.lspId,
      batchId: r.batchId,
      assignedAssessorId: r.assignedAssessorId,
      displayName: r.displayName,
      pseudonym: r.pseudonym,
      nikMasked: r.nikMasked,
      ktpNameOcr: r.ktpNameOcr,
      apl01Name: r.apl01Name,
      suratTugasName: r.suratTugasName,
      ijazahName: r.ijazahName,
      certificateNameConfirmed: r.certificateNameConfirmed,
      certificateNameConfirmedAt: r.certificateNameConfirmedAt?.toISOString() ?? null,
      completenessStatus: r.completenessStatus,
      status: r.status,
    }));
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("assessees").select("*").eq("batch_id", batchId);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    lspId: r.lsp_id as string,
    batchId: r.batch_id as string,
    assignedAssessorId: (r.assigned_assessor_id as string | null) ?? null,
    displayName: r.display_name as string,
    pseudonym: (r.pseudonym as string | null) ?? null,
    nikMasked: (r.nik_masked as string | null) ?? null,
    ktpNameOcr: (r.ktp_name_ocr as string | null) ?? null,
    apl01Name: (r.apl01_name as string | null) ?? null,
    suratTugasName: (r.surat_tugas_name as string | null) ?? null,
    ijazahName: (r.ijazah_name as string | null) ?? null,
    certificateNameConfirmed: (r.certificate_name_confirmed as string | null) ?? null,
    certificateNameConfirmedAt: (r.certificate_name_confirmed_at as string | null) ?? null,
    completenessStatus: r.completeness_status as string,
    status: r.status as string,
  }));
}

export async function getAssesseeById(
  userId: string,
  assesseeId: string,
): Promise<AssesseeRecord | null> {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx.select().from(assessees).where(eq(assessees.id, assesseeId)).limit(1),
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      lspId: r.lspId,
      batchId: r.batchId,
      assignedAssessorId: r.assignedAssessorId,
      displayName: r.displayName,
      pseudonym: r.pseudonym,
      nikMasked: r.nikMasked,
      ktpNameOcr: r.ktpNameOcr,
      apl01Name: r.apl01Name,
      suratTugasName: r.suratTugasName,
      ijazahName: r.ijazahName,
      certificateNameConfirmed: r.certificateNameConfirmed,
      certificateNameConfirmedAt: r.certificateNameConfirmedAt?.toISOString() ?? null,
      completenessStatus: r.completenessStatus,
      status: r.status,
    };
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("assessees").select("*").eq("id", assesseeId).maybeSingle();
  if (!data) return null;

  return {
    id: data.id as string,
    lspId: data.lsp_id as string,
    batchId: data.batch_id as string,
    assignedAssessorId: (data.assigned_assessor_id as string | null) ?? null,
    displayName: data.display_name as string,
    pseudonym: (data.pseudonym as string | null) ?? null,
    nikMasked: (data.nik_masked as string | null) ?? null,
    ktpNameOcr: (data.ktp_name_ocr as string | null) ?? null,
    apl01Name: (data.apl01_name as string | null) ?? null,
    suratTugasName: (data.surat_tugas_name as string | null) ?? null,
    ijazahName: (data.ijazah_name as string | null) ?? null,
    certificateNameConfirmed: (data.certificate_name_confirmed as string | null) ?? null,
    certificateNameConfirmedAt: (data.certificate_name_confirmed_at as string | null) ?? null,
    completenessStatus: data.completeness_status as string,
    status: data.status as string,
  };
}

export async function confirmCertificateName(params: {
  userId: string;
  assesseeId: string;
  confirmedName: string;
  juryVerdictId?: string;
  overrideReason?: string;
}) {
  const now = new Date();
  if (hasDatabaseUrl()) {
    await withRlsTransaction(params.userId, async (tx) => {
      await tx
        .update(assessees)
        .set({
          certificateNameConfirmed: params.confirmedName,
          certificateNameConfirmedBy: params.userId,
          certificateNameConfirmedAt: now,
        })
        .where(eq(assessees.id, params.assesseeId));

      if (params.juryVerdictId) {
        await tx
          .update(nameJuryVerdicts)
          .set({
            confirmedBy: params.userId,
            confirmedAt: now,
            overrideReason: params.overrideReason ?? null,
          })
          .where(eq(nameJuryVerdicts.id, params.juryVerdictId));
      }
    });
    return;
  }

  const supabase = await getSupabaseServerClient();
  await supabase
    .from("assessees")
    .update({
      certificate_name_confirmed: params.confirmedName,
      certificate_name_confirmed_by: params.userId,
      certificate_name_confirmed_at: now.toISOString(),
    })
    .eq("id", params.assesseeId);

  if (params.juryVerdictId) {
    await supabase
      .from("name_jury_verdicts")
      .update({
        confirmed_by: params.userId,
        confirmed_at: now.toISOString(),
        override_reason: params.overrideReason ?? null,
      })
      .eq("id", params.juryVerdictId);
  }
}

export async function getLatestNameJuryVerdict(
  userId: string,
  assesseeId: string,
) {
  if (hasDatabaseUrl()) {
    const rows = await withRlsTransaction(userId, (tx) =>
      tx
        .select()
        .from(nameJuryVerdicts)
        .where(eq(nameJuryVerdicts.assesseeId, assesseeId))
        .orderBy(desc(nameJuryVerdicts.createdAt))
        .limit(1),
    );
    return rows[0] ?? null;
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("name_jury_verdicts")
    .select("*")
    .eq("assessee_id", assesseeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
