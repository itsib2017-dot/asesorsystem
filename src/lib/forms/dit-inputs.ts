import { resolveSchemeKelompokPekerjaan } from "@/lib/forms/assessee-forms";
import type { SchemeRecord } from "@/repositories/schemes.repository";
import {
  deduplicateFilesByLatestRevision,
  pickLatestDriveFile,
  type RevisionComparableFile,
} from "@/services/drive-revisions";

export interface SelectedDitInputFiles<T extends RevisionComparableFile> {
  assessee04a: T[];
  sharedBatch04a: T[];
  used04aFiles: T[];
  frIa04aSource: "assessee" | "batch" | "none";
  used04bFiles: T[];
  usedDitFormFiles: T[];
  combinedDitFiles: T[];
  usedCvFile: T | null;
}

/**
 * Pure IO-free selector shared by both the DIT UI completeness gate and
 * `resolveAssesseeDitInputs` so UI readiness and backend AI extraction always agree.
 */
export function selectDitInputFiles<
  T extends RevisionComparableFile & { assesseeId?: string | null },
>(files: T[], batchFiles?: T[]): SelectedDitInputFiles<T> {
  const assessee04a = deduplicateFilesByLatestRevision(
    files.filter((f) => f.docType === "04a"),
  );
  const sharedBatch04a =
    assessee04a.length === 0 && batchFiles
      ? deduplicateFilesByLatestRevision(
          batchFiles.filter((f) => !f.assesseeId && f.docType === "04a"),
        )
      : [];
  const used04aFiles = assessee04a.length > 0 ? assessee04a : sharedBatch04a;
  const frIa04aSource: "assessee" | "batch" | "none" =
    assessee04a.length > 0 ? "assessee" : sharedBatch04a.length > 0 ? "batch" : "none";

  const used04bFiles = deduplicateFilesByLatestRevision(
    files.filter((f) => f.docType === "04b"),
  );
  const usedDitFormFiles = deduplicateFilesByLatestRevision(
    files.filter((f) => f.docType === "dit_form"),
  );
  const combinedDitFiles = [...used04bFiles, ...usedDitFormFiles];

  const usedCvFile =
    pickLatestDriveFile(files.filter((f) => f.docType === "cv")) ??
    pickLatestDriveFile(files.filter((f) => f.docType === "portofolio"));

  return {
    assessee04a,
    sharedBatch04a,
    used04aFiles,
    frIa04aSource,
    used04bFiles,
    usedDitFormFiles,
    combinedDitFiles,
    usedCvFile,
  };
}

export function formatSchemeInstructionsText(scheme?: SchemeRecord | null): string {
  if (!scheme) return "";
  const kelompok = resolveSchemeKelompokPekerjaan(scheme);
  if (kelompok.length === 0) return "";
  const isGeneric = kelompok.some((kp) => kp.isGenericFallback);
  const lines: string[] = [
    `[Referensi Instruksi Tugas DIT dari Skema: ${scheme.name}]`,
  ];
  if (isGeneric) {
    lines.push(
      "[Catatan Sistem: Pertanyaan menggunakan fallback generik per unit — lengkapi Kelompok Pekerjaan skema resmi bila tersedia]",
    );
  }
  for (const kp of kelompok) {
    lines.push(`\nKelompok Pekerjaan ${kp.kpIndex}: ${kp.title}`);
    for (const u of kp.units) {
      lines.push(`- Unit ${u.code}: ${u.title}`);
    }
    for (const a of kp.aspects) {
      lines.push(
        `  • Aspek ${a.no} (${a.unitCode} — ${a.lingkup}): ${a.question} [KUK: ${a.kukRef}]`,
      );
    }
  }
  return lines.join("\n").trim();
}
