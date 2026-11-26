import JSZip from "jszip";
import { isUuid } from "@/db";
import { resolveAk05BatchRows } from "@/lib/ak05/rollup";
import {
  deriveOfficialChannelVerdicts,
  resolveAssesseeOverallDecision,
  type UnitDecisionLike,
} from "@/lib/ak05/decision-rules";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getUser } from "@/lib/auth/get-session";
import { apiError } from "@/lib/errors";
import {
  buildAk02Payload,
  buildIa04aPayload,
  buildIa04bPayload,
  buildIa06cPayload,
  extractSchemeMeta,
  resolveSchemeUnitsList,
  type RawDecisionRow,
} from "@/lib/forms/assessee-forms";
import { formatSchemeInstructionsText, selectDitInputFiles } from "@/lib/forms/dit-inputs";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import {
  getAk05ReportForBatch,
  getAssesseeDecisionOverride,
  getLatestDitAnalysis,
  getLatestInterviewAssessment,
  getLatestWrittenGrading,
  listDecisionsForAssessee,
} from "@/repositories/assessment.repository";
import { getAssessorProfile } from "@/repositories/auth.repository";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { listSchemes } from "@/repositories/schemes.repository";
import { getActiveSignature } from "@/repositories/signatures.repository";
import {
  generateAk02Docx,
  generateAk05Docx,
  generateAk05Pdf,
  generateIa04aDocx,
  generateIa04bDocx,
  generateIa06cDocx,
  resolveSchemeTemplateBuffer,
} from "@/services/export";

export const maxDuration = 300;

function slugifyArchivePart(raw: string, fallback: string, maxLen = 40): string {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLen);
  return cleaned || fallback;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const { id: batchId } = await context.params;
  if (!isUuid(batchId)) {
    return apiError("VALIDATION_ERROR", "Parameter ID batch tidak valid.");
  }

  const rl = checkRateLimit(`export-pack:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(
      "RATE_LIMITED",
      `Terlalu banyak permintaan paket ZIP. Coba lagi dalam ${rl.retryAfterSeconds} detik.`,
    );
  }

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return apiError("NOT_FOUND", "Batch tidak ditemukan.");
  }

  const signature = await getActiveSignature(user.id);
  if (!signature) {
    return apiError(
      "NO_ACTIVE_SIGNATURE",
      "Tanda tangan belum diunggah. Unggah tanda tangan di Pengaturan → Profil sebelum mengekspor paket batch.",
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

  const [assessees, profile, schemes, report, batchFiles] = await Promise.all([
    listAssesseesByBatch(user.id, batchId),
    getAssessorProfile(user.id),
    listSchemes(user.id, batch.lspId),
    getAk05ReportForBatch(user.id, batchId),
    listDriveFilesForBatch(user.id, batchId),
  ]);

  const scheme = schemes.find((s) => s.id === batch.schemeId) ?? null;
  const { schemeTitle, schemeNumber } = extractSchemeMeta(scheme);
  const schemeUnits = resolveSchemeUnitsList(scheme);
  const assessorName =
    (profile?.fullName as string) || (profile?.full_name as string) || user.email || "Asesor";
  const assessorRegNo =
    (profile?.regNoMet as string) || (profile?.reg_no_met as string) || "-";
  const assessmentDate = batch.assessmentDate ?? "";
  const signatureMimeType =
    signature.mimeType === "image/jpeg" ? ("image/jpeg" as const) : ("image/png" as const);

  const downloadFromStorage = async (storagePath: string) => {
    if (!storagePath.startsWith(`${batch.lspId}/`)) return undefined;
    const { data: tplBlob } = await supabase.storage
      .from("scheme-blankos")
      .download(storagePath);
    return tplBlob ? Buffer.from(await tplBlob.arrayBuffer()) : undefined;
  };

  const [tplAk05, tplAk02, tpl04a, tpl04b, tpl06c] = await Promise.all([
    resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["ak05", "fr.ak.05", "frak05"],
      instrumentRoles: ["laporan"],
      defaultAk3uFileName: "FR.AK.05.LAPORAN_ASESMEN.docx",
      downloadFromStorage,
    }),
    resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["ak02", "fr.ak.02", "frak02"],
      instrumentRoles: ["keputusan"],
      defaultAk3uFileName: "FR.AK.02.REKAMAN_ASESMEN.docx",
      downloadFromStorage,
    }),
    resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["ia04a", "04a", "fr.ia.04a", "fria04a"],
      defaultAk3uFileName: "FR.IA.04A.DIT.docx",
      downloadFromStorage,
    }),
    resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["04b", "ia04b", "fr.ia.04b", "fria04b"],
      instrumentRoles: ["presentation"],
      defaultAk3uFileName: "FR.IA.04B.PENILAIAN_PROYEK_SINGKAT.docx",
      downloadFromStorage,
    }),
    resolveSchemeTemplateBuffer({
      scheme,
      formKeys: ["06c", "ia06c", "ia06", "fr.ia.06c"],
      instrumentRoles: ["written_jawaban"],
      defaultAk3uFileName: "FR.IA.06C.LEMBAR_JAWABAN_TERTULIS.docx",
      downloadFromStorage,
    }),
  ]);

  const confirmedAssessees = assessees.filter((a) => Boolean(a.certificateNameConfirmed));
  const skippedUnconfirmed = assessees.filter((a) => !a.certificateNameConfirmed);

  const zip = new JSZip();
  const includedLines: string[] = [];

  if (confirmedAssessees.length > 0) {
    const rollupRows = await resolveAk05BatchRows(
      user.id,
      batchId,
      confirmedAssessees,
      { totalSchemeUnits: schemeUnits.length },
    );

    const ak05Payload = {
      schemeCode: scheme?.code ?? "SKEMA",
      schemeTitle,
      schemeNumber,
      tukName: batch.tukName ?? "-",
      tukType: (batch.tukType as "sewaktu" | "tempat_kerja" | "mandiri") ?? "sewaktu",
      assessorName,
      assessorRegNo,
      assessmentDate,
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
      signatureMimeType,
      templateBuffer: tplAk05,
    };

    const [ak05Pdf, ak05Docx] = await Promise.all([
      generateAk05Pdf(ak05Payload),
      generateAk05Docx(ak05Payload),
    ]);
    zip.file("00-FR-AK-05-Laporan-Asesmen.pdf", ak05Pdf);
    zip.file("00-FR-AK-05-Laporan-Asesmen.docx", ak05Docx);

    const recById = new Map(rollupRows.map((r) => [r.assesseeId, r.recommendation]));

    for (let idx = 0; idx < confirmedAssessees.length; idx++) {
      const assessee = confirmedAssessees[idx]!;
      const confirmedName = assessee.certificateNameConfirmed!;
      const [
        decisions,
        decisionOverride,
        ditAnalysis,
        writtenGrading,
        interviewAssessment,
      ] = await Promise.all([
        listDecisionsForAssessee(user.id, assessee.id),
        getAssesseeDecisionOverride(user.id, assessee.id),
        getLatestDitAnalysis(user.id, assessee.id),
        getLatestWrittenGrading(user.id, assessee.id),
        getLatestInterviewAssessment(user.id, assessee.id),
      ]);

      const rawDecisions = decisions as unknown as RawDecisionRow[];
      const resolvedOverall = resolveAssesseeOverallDecision({
        unitDecisions: rawDecisions as unknown as UnitDecisionLike[],
        totalSchemeUnits: schemeUnits.length,
        manualOverride: decisionOverride,
        channelVerdicts: deriveOfficialChannelVerdicts({
          ditAnalysis: ditAnalysis as Record<string, unknown> | null,
          writtenGrading: writtenGrading as Record<string, unknown> | null,
          interviewAssessment: interviewAssessment as Record<string, unknown> | null,
        }),
      });

      const assesseeFiles = batchFiles.filter((f) => f.assesseeId === assessee.id);
      const hasDitForms = assesseeFiles.some(
        (f) => f.docType === "dit_form" || f.docType === "04b",
      );
      const selected04a = selectDitInputFiles(assesseeFiles, batchFiles);
      const extracted04aText =
        selected04a.used04aFiles
          .map((f) => f.extractedText?.trim())
          .filter(Boolean)
          .join("\n\n") || formatSchemeInstructionsText(scheme);

      const [ak02Buf, ia04aBuf, ia04bBuf, ia06cBuf] = await Promise.all([
        generateAk02Docx({
          ...buildAk02Payload({
            scheme,
            schemeTitle,
            schemeNumber,
            tukType: batch.tukType,
            assessorName,
            assessorRegNo,
            assesseeName: confirmedName,
            assessmentDate,
            decisions: rawDecisions,
            manualOverride: decisionOverride,
            resolvedOverall,
            hasDit: Boolean(ditAnalysis),
            hasDitForms,
            hasWritten: Boolean(writtenGrading),
            hasInterview: Boolean(interviewAssessment),
            signaturePngBytes: signatureBytes,
            signatureMimeType,
          }),
          templateBuffer: tplAk02,
        }),
        generateIa04aDocx({
          ...buildIa04aPayload({
            schemeTitle,
            schemeNumber,
            tukType: batch.tukType,
            assessorName,
            assessorRegNo,
            assesseeName: confirmedName,
            assessmentDate,
            ditAnalysis: ditAnalysis as Record<string, unknown> | null,
            extracted04aText,
          }),
          templateBuffer: tpl04a,
        }),
        generateIa04bDocx({
          ...buildIa04bPayload({
            scheme,
            schemeTitle,
            schemeNumber,
            tukType: batch.tukType,
            assessorName,
            assessorRegNo,
            assesseeName: confirmedName,
            assessmentDate,
            ditAnalysis: ditAnalysis as Record<string, unknown> | null,
            decisions: rawDecisions,
            manualOverride: decisionOverride,
            signaturePngBytes: signatureBytes,
            signatureMimeType,
          }),
          templateBuffer: tpl04b,
        }),
        generateIa06cDocx({
          ...buildIa06cPayload({
            scheme,
            schemeTitle,
            schemeNumber,
            tukType: batch.tukType,
            assessorName,
            assessorRegNo,
            assesseeName: confirmedName,
            assessmentDate,
            writtenGrading: writtenGrading as Record<string, unknown> | null,
            signaturePngBytes: signatureBytes,
            signatureMimeType,
          }),
          templateBuffer: tpl06c,
        }),
      ]);

      const folderPrefix = `${String(idx + 1).padStart(2, "0")}-${slugifyArchivePart(confirmedName, assessee.id.slice(0, 8))}`;
      zip.file(`${folderPrefix}/FR-AK-02.docx`, ak02Buf);
      zip.file(`${folderPrefix}/FR-IA-04A.docx`, ia04aBuf);
      zip.file(`${folderPrefix}/FR-IA-04B.docx`, ia04bBuf);
      zip.file(`${folderPrefix}/FR-IA-06C.docx`, ia06cBuf);

      const rec = recById.get(assessee.id) ?? "-";
      includedLines.push(
        `- ${confirmedName} (Folder: ${folderPrefix}/, Putusan: ${rec})`,
      );
    }
  }

  const readmeLines = [
    "CATATAN KELENGKAPAN PAKET EKSPOR BATCH ASESMEN",
    "==============================================",
    `Batch: ${batch.name} (${batch.id})`,
    `Skema: ${scheme ? `${scheme.code} — ${scheme.name}` : "-"}`,
    `TUK: ${batch.tukName || "-"} (${batch.tukType || "sewaktu"})`,
    `Tanggal Asesmen: ${assessmentDate || "-"}`,
    `Asesor: ${assessorName} (${assessorRegNo})`,
    "",
    `Asesi Termasuk dalam Paket (${confirmedAssessees.length}):`,
    ...(includedLines.length > 0
      ? includedLines
      : ["- Tidak ada asesi dengan konfirmasi nama sertifikat."]),
    "",
    `Asesi Dilewati karena Nama Sertifikat Belum Dikonfirmasi (${skippedUnconfirmed.length}):`,
    ...(skippedUnconfirmed.length > 0
      ? skippedUnconfirmed.map(
          (a) =>
            `- ${a.displayName} (Alasan: nama sertifikat KTP belum dikonfirmasi; tidak diekspor atau diisi otomatis)`,
        )
      : ["- Tidak ada."]),
    "",
    "Catatan Prinsip Kejujuran Asesmen:",
    "- Putusan unit, FR.IA.04B, FR.IA.06C, dan status BK tidak pernah diisi otomatis oleh AI tanpa konfirmasi asesor.",
    "- Formulir administrasi MUK manual lain (Daftar Hadir, Berita Acara, FR.AK.01/06/07, FR.APL.02) disiapkan terpisah sesuai format LSP.",
  ];
  zip.file("CATATAN_KELENGKAPAN.txt", readmeLines.join("\n"));

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  await writeAuditLog(
    {
      lsp_id: batch.lspId,
      actor_id: user.id,
      action: "export.batch_pack",
      resource: "batches",
      resource_id: batch.id,
      after_summary: {
        batchId: batch.id,
        includedCount: confirmedAssessees.length,
        skippedCount: skippedUnconfirmed.length,
      },
    },
    supabase,
  );

  const safeBatchSlug = slugifyArchivePart(batch.name, batch.id.slice(0, 8), 48);
  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="Paket-Asesmen-${safeBatchSlug}.zip"`,
    },
  });
}
