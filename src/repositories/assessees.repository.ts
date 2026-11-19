import { eq, desc, inArray } from "drizzle-orm";
import { hasDatabaseUrl, isUuid, runRepositoryDualPath, withRlsTransaction } from "@/db";
import {
  assessees,
  assesseeDecisionOverrides,
  decisions,
  ditAnalyses,
  driveFiles,
  interviewAssessments,
  nameJuryVerdicts,
  writtenGradings,
} from "@/db/schema";
import { findBestMatchingCandidate } from "@/lib/names";
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
  if (!isUuid(batchId)) return [];
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
  if (!isUuid(assesseeId)) return null;
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

export async function saveNameJuryVerdictAndOcr(params: {
  userId: string;
  lspId: string;
  assesseeId: string;
  ktpNameOcr?: string;
  verdict: "match" | "mismatch_resolved" | "needs_human";
  proposedCertificateName: string | null;
  reasoning: string;
  evidence: unknown;
  ocrConfidence: number;
  model: string;
  promptVersion: string;
}): Promise<void> {
  const now = new Date();
  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssesseesRepository.saveNameJuryVerdict",
    drizzle: async (tx) => {
      if (params.ktpNameOcr !== undefined) {
        await tx
          .update(assessees)
          .set({
            ktpNameOcr: params.ktpNameOcr,
            updatedAt: now,
          })
          .where(eq(assessees.id, params.assesseeId));
      }

      await tx.insert(nameJuryVerdicts).values({
        lspId: params.lspId,
        assesseeId: params.assesseeId,
        verdict: params.verdict,
        proposedCertificateName: params.proposedCertificateName,
        reasoning: params.reasoning,
        evidence: params.evidence,
        ocrConfidence: params.ocrConfidence.toFixed(4),
        model: params.model,
        promptVersion: params.promptVersion,
      });
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      if (params.ktpNameOcr !== undefined) {
        await supabase
          .from("assessees")
          .update({
            ktp_name_ocr: params.ktpNameOcr,
            updated_at: now.toISOString(),
          })
          .eq("id", params.assesseeId);
      }

      await supabase.from("name_jury_verdicts").insert({
        lsp_id: params.lspId,
        assessee_id: params.assesseeId,
        verdict: params.verdict,
        proposed_certificate_name: params.proposedCertificateName,
        reasoning: params.reasoning,
        evidence: params.evidence,
        ocr_confidence: params.ocrConfidence,
        model: params.model,
        prompt_version: params.promptVersion,
      });
    },
  });
}

function findMatchingAssessee(
  candidateName: string,
  pool: AssesseeRecord[],
): AssesseeRecord | undefined {
  return findBestMatchingCandidate(candidateName, pool);
}

export async function upsertAssesseesForBatch(params: {
  userId: string;
  lspId: string;
  batchId: string;
  names: string[];
}): Promise<AssesseeRecord[]> {
  if (!isUuid(params.batchId) || params.names.length === 0) {
    return listAssesseesByBatch(params.userId, params.batchId);
  }

  const existing = await listAssesseesByBatch(params.userId, params.batchId);
  const pool = [...existing];
  const toInsert: Array<{ displayName: string; pseudonym: string }> = [];

  for (const rawName of params.names) {
    const cleaned = rawName.trim();
    if (!cleaned) continue;
    const match = findMatchingAssessee(cleaned, pool);
    if (match) continue;

    const seq = pool.length + toInsert.length + 1;
    const pseudonym = `ASESI-${String(seq).padStart(3, "0")}`;
    toInsert.push({ displayName: cleaned, pseudonym });
    pool.push({
      id: `pending-${seq}`,
      lspId: params.lspId,
      batchId: params.batchId,
      assignedAssessorId: params.userId,
      displayName: cleaned,
      pseudonym,
      nikMasked: null,
      ktpNameOcr: null,
      apl01Name: cleaned,
      suratTugasName: null,
      ijazahName: null,
      certificateNameConfirmed: null,
      certificateNameConfirmedAt: null,
      completenessStatus: "incomplete",
      status: "pending",
    });
  }

  if (toInsert.length === 0) {
    return existing;
  }

  if (hasDatabaseUrl()) {
    await withRlsTransaction(params.userId, async (tx) => {
      await tx.insert(assessees).values(
        toInsert.map((item) => ({
          lspId: params.lspId,
          batchId: params.batchId,
          assignedAssessorId: params.userId,
          displayName: item.displayName,
          apl01Name: item.displayName,
          pseudonym: item.pseudonym,
          completenessStatus: "incomplete",
          status: "pending",
        })),
      );
    });
    return listAssesseesByBatch(params.userId, params.batchId);
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("assessees").insert(
    toInsert.map((item) => ({
      lsp_id: params.lspId,
      batch_id: params.batchId,
      assigned_assessor_id: params.userId,
      display_name: item.displayName,
      apl01_name: item.displayName,
      pseudonym: item.pseudonym,
      completeness_status: "incomplete",
      status: "pending",
    })),
  );

  if (error) {
    console.warn("[AssesseesRepository Warning] insert assessees error:", error.message);
  }

  return listAssesseesByBatch(params.userId, params.batchId);
}

/**
 * Safely removes zero-file unconfirmed duplicate/folder-named assessee records after files
 * have been reassigned to canonical assessees (never removes confirmed names or records
 * carrying decisions, AI runs, written gradings, or interview assessments).
 */
export async function pruneOrphanedDuplicateAssessees(params: {
  userId: string;
  batchId: string;
}): Promise<string[]> {
  if (!isUuid(params.batchId)) return [];

  const allAssessees = await listAssesseesByBatch(params.userId, params.batchId);
  const unconfirmed = allAssessees.filter((a) => !a.certificateNameConfirmed);
  if (unconfirmed.length === 0) return [];

  const candidateIds = unconfirmed.map((a) => a.id);

  return runRepositoryDualPath({
    userId: params.userId,
    label: "AssesseesRepository.pruneOrphanedDuplicateAssessees",
    drizzle: async (tx) => {
      const [files, decs, dits, writtens, interviews, overrides] = await Promise.all([
        tx
          .select({ assesseeId: driveFiles.assesseeId })
          .from(driveFiles)
          .where(eq(driveFiles.batchId, params.batchId)),
        tx
          .select({ assesseeId: decisions.assesseeId })
          .from(decisions)
          .where(inArray(decisions.assesseeId, candidateIds)),
        tx
          .select({ assesseeId: ditAnalyses.assesseeId })
          .from(ditAnalyses)
          .where(inArray(ditAnalyses.assesseeId, candidateIds)),
        tx
          .select({ assesseeId: writtenGradings.assesseeId })
          .from(writtenGradings)
          .where(inArray(writtenGradings.assesseeId, candidateIds)),
        tx
          .select({ assesseeId: interviewAssessments.assesseeId })
          .from(interviewAssessments)
          .where(inArray(interviewAssessments.assesseeId, candidateIds)),
        tx
          .select({ assesseeId: assesseeDecisionOverrides.assesseeId })
          .from(assesseeDecisionOverrides)
          .where(inArray(assesseeDecisionOverrides.assesseeId, candidateIds)),
      ]);

      const protectedIds = new Set<string>();
      for (const r of files) if (r.assesseeId) protectedIds.add(r.assesseeId);
      for (const r of decs) protectedIds.add(r.assesseeId);
      for (const r of dits) protectedIds.add(r.assesseeId);
      for (const r of writtens) protectedIds.add(r.assesseeId);
      for (const r of interviews) protectedIds.add(r.assesseeId);
      for (const r of overrides) protectedIds.add(r.assesseeId);

      const deletable = unconfirmed.filter((a) => !protectedIds.has(a.id));
      if (deletable.length === 0) return [];

      await tx
        .delete(assessees)
        .where(inArray(assessees.id, deletable.map((a) => a.id)));
      return deletable.map((a) => a.displayName);
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const [
        { data: files },
        { data: decs },
        { data: dits },
        { data: writtens },
        { data: interviews },
        { data: overrides },
      ] = await Promise.all([
        supabase.from("drive_files").select("assessee_id").eq("batch_id", params.batchId),
        supabase.from("decisions").select("assessee_id").in("assessee_id", candidateIds),
        supabase.from("dit_analyses").select("assessee_id").in("assessee_id", candidateIds),
        supabase.from("written_gradings").select("assessee_id").in("assessee_id", candidateIds),
        supabase.from("interview_assessments").select("assessee_id").in("assessee_id", candidateIds),
        supabase
          .from("assessee_decision_overrides")
          .select("assessee_id")
          .in("assessee_id", candidateIds),
      ]);

      const protectedIds = new Set<string>();
      for (const r of files ?? []) if (r.assessee_id) protectedIds.add(String(r.assessee_id));
      for (const r of decs ?? []) if (r.assessee_id) protectedIds.add(String(r.assessee_id));
      for (const r of dits ?? []) if (r.assessee_id) protectedIds.add(String(r.assessee_id));
      for (const r of writtens ?? []) if (r.assessee_id) protectedIds.add(String(r.assessee_id));
      for (const r of interviews ?? []) if (r.assessee_id) protectedIds.add(String(r.assessee_id));
      for (const r of overrides ?? []) if (r.assessee_id) protectedIds.add(String(r.assessee_id));

      const deletable = unconfirmed.filter((a) => !protectedIds.has(a.id));
      if (deletable.length === 0) return [];

      const { error: delError } = await supabase
        .from("assessees")
        .delete()
        .in("id", deletable.map((a) => a.id));
      if (delError) {
        console.warn("[AssesseesRepository Warning] prune duplicates skipped:", delError.message);
        return [];
      }
      return deletable.map((a) => a.displayName);
    },
  });
}
