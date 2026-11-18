import { getConfig } from "@/lib/config/get-config";
import { buildDitAnalysisSchema } from "@/ai/schemas";
import { buildDitGapAnalysisPrompt, DIT_PROMPT_META } from "@/ai/prompts/dit-gap-analysis.v1";
import { generateStructured, type RuntimeLlmConfig } from "@/ai/llm";

export interface DitGateCheckResult {
  passed: boolean;
  missing: Array<{ input: string; label: string }>;
}

/**
 * Enforces Rule 26: Never analyse incomplete inputs.
 * Checks FR.IA.04A, presentation/transcript, and candidate profile.
 */
export function checkDitCompletenessGate(inputs: {
  frIa04aText?: string | null;
  presentationTranscript?: string | null;
  candidateProfileSummary?: string | null;
}): DitGateCheckResult {
  const missing: Array<{ input: string; label: string }> = [];

  if (!inputs.frIa04aText || inputs.frIa04aText.trim().length < 10) {
    missing.push({
      input: "fr_ia_04a",
      label: "Formulir FR.IA.04A (Daftar Instruksi Terstruktur)",
    });
  }
  if (!inputs.presentationTranscript || inputs.presentationTranscript.trim().length < 10) {
    missing.push({
      input: "presentation_transcript",
      label: "Transkrip / Presentasi Kandidat",
    });
  }
  if (!inputs.candidateProfileSummary || inputs.candidateProfileSummary.trim().length < 10) {
    missing.push({
      input: "candidate_profile",
      label: "Profil Kandidat (CV / Riwayat Kerja)",
    });
  }

  return {
    passed: missing.length === 0,
    missing,
  };
}

export async function runDitPipeline(params: {
  pseudonym: string;
  schemeName: string;
  schemeQuestionCount?: number;
  legalRefs: string[];
  frIa04aText: string;
  presentationTranscript: string;
  candidateProfileSummary: string;
  llmConfig: RuntimeLlmConfig;
  correlationId?: string;
}) {
  const gate = checkDitCompletenessGate({
    frIa04aText: params.frIa04aText,
    presentationTranscript: params.presentationTranscript,
    candidateProfileSummary: params.candidateProfileSummary,
  });

  if (!gate.passed) {
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      reason: "incomplete_inputs" as const,
      missing: gate.missing,
    };
  }

  // Read question bank count from scheme manifest or app_config (D21: never hardcoded)
  const configuredCount =
    params.schemeQuestionCount ??
    (await getConfig("question_bank.count")) ??
    10;

  const schema = buildDitAnalysisSchema(configuredCount);
  const prompt = buildDitGapAnalysisPrompt({
    pseudonym: params.pseudonym,
    schemeName: params.schemeName,
    questionCount: configuredCount,
    legalRefs: params.legalRefs,
    frIa04aText: params.frIa04aText,
    presentationTranscript: params.presentationTranscript,
    candidateProfileSummary: params.candidateProfileSummary,
  });

  const aiResult = await generateStructured({
    config: params.llmConfig,
    schema,
    prompt,
    deterministic: true,
    correlationId: params.correlationId,
  });

  if (!aiResult.ok) {
    return {
      ok: false as const,
      code: "UNPROCESSABLE" as const,
      reason: aiResult.status,
      error: aiResult.error,
    };
  }

  return {
    ok: true as const,
    promptVersion: DIT_PROMPT_META.version,
    output: aiResult.output,
  };
}
