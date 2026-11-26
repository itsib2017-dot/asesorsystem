export interface AssesseeReadinessInput {
  hasActiveSignature: boolean;
  isNameConfirmed: boolean;
  decidedUnitCount: number;
  totalSchemeUnits: number;
  hasSaved04b: boolean;
  hasSaved06c: boolean;
  hasInterview: boolean;
}

export interface AssesseeExportReadiness {
  isReady: boolean;
  missing: string[];
  optionalPending: string[];
  summaryLine: string;
}

/**
 * Computes a concise one-line pre-export readiness summary for an assessee:
 * blocks only on mandatory prerequisites (`missing`), while surfacing optional
 * unsaved channel forms (`optionalPending`) cleanly.
 */
export function buildAssesseeExportReadiness(
  input: AssesseeReadinessInput,
): AssesseeExportReadiness {
  const missing: string[] = [];
  if (!input.hasActiveSignature) {
    missing.push("Tanda tangan asesor belum diunggah");
  }
  if (!input.isNameConfirmed) {
    missing.push("Konfirmasi nama KTP belum selesai");
  }
  if (input.totalSchemeUnits > 0 && input.decidedUnitCount < input.totalSchemeUnits) {
    const remaining = input.totalSchemeUnits - input.decidedUnitCount;
    missing.push(`${remaining}/${input.totalSchemeUnits} unit FR.AK.02 belum diputus`);
  }

  const optionalPending: string[] = [];
  if (!input.hasSaved04b) optionalPending.push("FR.IA.04B belum disimpan");
  if (!input.hasSaved06c) optionalPending.push("FR.IA.06C belum disimpan");
  if (!input.hasInterview) optionalPending.push("FR.IA.09 belum dinilai");

  const isReady = missing.length === 0;
  let summaryLine: string;
  if (isReady && optionalPending.length === 0) {
    summaryLine = "Siap ekspor: semua prasyarat wajib dan formulir instrumen lengkap.";
  } else if (isReady) {
    summaryLine = `Siap ekspor dokumen inti · Opsional belum disimpan: ${optionalPending.join(", ")}.`;
  } else {
    summaryLine = `Belum lengkap sebelum ekspor: ${missing.join(" · ")}${
      optionalPending.length > 0 ? ` (Opsional: ${optionalPending.join(", ")})` : ""
    }.`;
  }

  return {
    isReady,
    missing,
    optionalPending,
    summaryLine,
  };
}
