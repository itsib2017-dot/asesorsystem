import {
  computeNameSimilarity,
  isInitialAbbreviationMatch,
  normalisePersonName,
} from "@/lib/names";
import { buildNameJuryPrompt, NAME_JURY_PROMPT_META } from "@/ai/prompts/name-jury.v1";
import { nameJurySchema, type NameJuryOutput } from "@/ai/schemas";
import { generateStructured, type RuntimeLlmConfig } from "@/ai/llm";

export interface DeterministicNameComparison {
  ktpName: string;
  apl01Similarity: number;
  suratTugasSimilarity: number;
  ijazahSimilarity: number;
  allExactMatch: boolean;
  canResolveToKtp: boolean;
}

/**
 * Deterministic pre-jury comparison (ADR-0005).
 * KTP spelling is ALWAYS authoritative (D6).
 */
export function compareNameSourcesDeterministic(sources: {
  ktpOcr: string;
  apl01: string;
  suratTugas: string;
  ijazah: string;
}): DeterministicNameComparison {
  const ktpNorm = normalisePersonName(sources.ktpOcr);
  const aplNorm = normalisePersonName(sources.apl01);
  const stNorm = normalisePersonName(sources.suratTugas);
  const ijNorm = normalisePersonName(sources.ijazah);

  const aplSim = computeNameSimilarity(sources.ktpOcr, sources.apl01);
  const stSim = computeNameSimilarity(sources.ktpOcr, sources.suratTugas);
  const ijSim = computeNameSimilarity(sources.ktpOcr, sources.ijazah);

  const allExactMatch =
    ktpNorm.length > 0 &&
    ktpNorm === aplNorm &&
    ktpNorm === stNorm &&
    ktpNorm === ijNorm;

  const canResolveToKtp =
    ktpNorm.length > 0 &&
    (aplSim >= 0.85 || isInitialAbbreviationMatch(sources.ktpOcr, sources.apl01)) &&
    (stSim >= 0.7 || isInitialAbbreviationMatch(sources.ktpOcr, sources.suratTugas)) &&
    (ijSim >= 0.85 || isInitialAbbreviationMatch(sources.ktpOcr, sources.ijazah));

  return {
    ktpName: sources.ktpOcr.trim(),
    apl01Similarity: aplSim,
    suratTugasSimilarity: stSim,
    ijazahSimilarity: ijSim,
    allExactMatch,
    canResolveToKtp,
  };
}

export async function runNameJury(params: {
  nameKtpOcr: string;
  nameApl01: string;
  nameSuratTugas: string;
  nameIjazah: string;
  ocrConfidence: number;
  ocrConfidenceFloor: number;
  llmConfig?: RuntimeLlmConfig;
  correlationId?: string;
}): Promise<{ promptVersion: string; result: NameJuryOutput }> {
  // Enforce Rule 30 confidence floor deterministically before calling any LLM
  if (
    params.ocrConfidence < params.ocrConfidenceFloor ||
    !params.nameKtpOcr.trim()
  ) {
    return {
      promptVersion: NAME_JURY_PROMPT_META.version,
      result: {
        verdict: "needs_human",
        proposed_certificate_name: null,
        reasoning:
          "Tingkat keyakinan OCR KTP berada di bawah ambang minimum atau teks KTP kosong. Diperlukan pemeriksaan manual asesor terhadap foto KTP asli (usulan nama tidak dapat dibuat secara otomatis).",
        evidence: [
          { source: "ktp_ocr", span: params.nameKtpOcr || "(kosong)" },
          { source: "apl01", span: params.nameApl01 },
          { source: "surat_tugas", span: params.nameSuratTugas },
          { source: "ijazah", span: params.nameIjazah },
        ],
        ocr_confidence: params.ocrConfidence,
      },
    };
  }

  const det = compareNameSourcesDeterministic({
    ktpOcr: params.nameKtpOcr,
    apl01: params.nameApl01,
    suratTugas: params.nameSuratTugas,
    ijazah: params.nameIjazah,
  });

  if (!params.llmConfig) {
    // Deterministic fallback when no LLM runtime config is supplied
    if (det.allExactMatch) {
      return {
        promptVersion: NAME_JURY_PROMPT_META.version,
        result: {
          verdict: "match",
          proposed_certificate_name: null,
          reasoning:
            "Seluruh empat dokumen (KTP, APL.01, Surat Tugas, Ijazah) memiliki ejaan nama yang cocok secara konsisten — perlu konfirmasi asesor.",
          evidence: [
            { source: "ktp_ocr", span: params.nameKtpOcr },
            { source: "apl01", span: params.nameApl01 },
            { source: "surat_tugas", span: params.nameSuratTugas },
            { source: "ijazah", span: params.nameIjazah },
          ],
          ocr_confidence: params.ocrConfidence,
        },
      };
    }

    if (det.canResolveToKtp) {
      return {
        promptVersion: NAME_JURY_PROMPT_META.version,
        result: {
          verdict: "mismatch_resolved",
          proposed_certificate_name: params.nameKtpOcr.trim(),
          reasoning: `Terdapat variasi penulisan/singkatan pada dokumen pendukung. Mengacu pada KTP sebagai otoritas utama (D6), usulan nama sertifikat: "${params.nameKtpOcr.trim()}" — perlu konfirmasi asesor.`,
          evidence: [
            { source: "ktp_ocr", span: params.nameKtpOcr },
            { source: "apl01", span: params.nameApl01 },
            { source: "surat_tugas", span: params.nameSuratTugas },
            { source: "ijazah", span: params.nameIjazah },
          ],
          ocr_confidence: params.ocrConfidence,
        },
      };
    }

    return {
      promptVersion: NAME_JURY_PROMPT_META.version,
      result: {
        verdict: "needs_human",
        proposed_certificate_name: null,
        reasoning:
          "Perbedaan nama antar sumber melebihi batas kemiripan deterministik. Diperlukan peninjauan dan pengetikan manual oleh asesor.",
        evidence: [
          { source: "ktp_ocr", span: params.nameKtpOcr },
          { source: "apl01", span: params.nameApl01 },
          { source: "surat_tugas", span: params.nameSuratTugas },
          { source: "ijazah", span: params.nameIjazah },
        ],
        ocr_confidence: params.ocrConfidence,
      },
    };
  }

  const prompt = buildNameJuryPrompt({
    name_ktp_ocr: params.nameKtpOcr,
    name_apl01: params.nameApl01,
    name_surat_tugas: params.nameSuratTugas,
    name_ijazah: params.nameIjazah,
    ocr_confidence: params.ocrConfidence,
    ocr_confidence_floor: params.ocrConfidenceFloor,
  });

  const aiResult = await generateStructured({
    config: params.llmConfig,
    schema: nameJurySchema,
    prompt,
    deterministic: true,
    correlationId: params.correlationId,
  });

  if (!aiResult.ok) {
    return {
      promptVersion: NAME_JURY_PROMPT_META.version,
      result: {
        verdict: "needs_human",
        proposed_certificate_name: null,
        reasoning: `Evaluasi AI gagal (${aiResult.error}). Diperlukan verifikasi manual oleh asesor.`,
        evidence: [
          { source: "ktp_ocr", span: params.nameKtpOcr },
          { source: "apl01", span: params.nameApl01 },
          { source: "surat_tugas", span: params.nameSuratTugas },
          { source: "ijazah", span: params.nameIjazah },
        ],
        ocr_confidence: params.ocrConfidence,
      },
    };
  }

  return {
    promptVersion: NAME_JURY_PROMPT_META.version,
    result: aiResult.output,
  };
}
