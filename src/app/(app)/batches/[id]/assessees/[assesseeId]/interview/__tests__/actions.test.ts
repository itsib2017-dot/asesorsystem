import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  resolveAuthorizedLsp: vi.fn(),
  checkRateLimit: vi.fn(),
  getBatchById: vi.fn(),
  getAssesseeById: vi.fn(),
  listSchemes: vi.fn(),
  getLspNameForUser: vi.fn(),
  getLatestProviderConfigForAssessor: vi.fn(),
  listDriveFilesForBatch: vi.fn(),
  getLatestDitAnalysis: vi.fn(),
  decryptSecret: vi.fn(),
  runInterviewPipeline: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  writeAuditLog: vi.fn(),
  saveInterviewAssessment: vi.fn(),
  upsertUnitDecision: vi.fn(),
  syncAssesseeVatmRecommendations: vi.fn(),
}));

vi.mock("@/lib/auth/get-session", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/auth/get-role", () => ({ resolveAuthorizedLsp: mocks.resolveAuthorizedLsp }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mocks.getBatchById,
  listDriveFilesForBatch: mocks.listDriveFilesForBatch,
}));
vi.mock("@/repositories/assessees.repository", () => ({
  getAssesseeById: mocks.getAssesseeById,
}));
vi.mock("@/repositories/schemes.repository", () => ({
  listSchemes: mocks.listSchemes,
}));
vi.mock("@/repositories/auth.repository", () => ({
  getLspNameForUser: mocks.getLspNameForUser,
}));
vi.mock("@/repositories/provider.repository", () => ({
  getLatestProviderConfigForAssessor: mocks.getLatestProviderConfigForAssessor,
}));
vi.mock("@/repositories/assessment.repository", () => ({
  getLatestDitAnalysis: mocks.getLatestDitAnalysis,
  saveInterviewAssessment: mocks.saveInterviewAssessment,
  upsertUnitDecision: mocks.upsertUnitDecision,
}));
vi.mock("@/lib/crypto/encryption", () => ({
  decryptSecret: mocks.decryptSecret,
}));
vi.mock("@/services/interview", () => ({
  runInterviewPipeline: mocks.runInterviewPipeline,
}));
vi.mock("@/lib/forms/sync-vatm-decisions", () => ({
  resolveUnitsForScheme: (scheme: { manifest?: { units?: Array<{ code: string; title: string }> } }) =>
    scheme.manifest?.units ?? [{ code: "U-01", title: "Unit Uji 1" }],
  syncAssesseeVatmRecommendations: mocks.syncAssesseeVatmRecommendations,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));
vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

import { generateInterviewQuestionsAction } from "../actions";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LSP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BATCH_ID = "33333333-3333-4333-8333-333333333333";
const ASSESSEE_ID = "22222222-2222-4222-8222-222222222222";
const SCHEME_ID = "44444444-4444-4444-8444-444444444444";

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: USER_ID });
  mocks.resolveAuthorizedLsp.mockResolvedValue({ allowed: true, lspId: LSP_ID, role: "assessor" });
  mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.getBatchById.mockResolvedValue({ id: BATCH_ID, lspId: LSP_ID, schemeId: SCHEME_ID });
  mocks.getAssesseeById.mockResolvedValue({
    id: ASSESSEE_ID,
    batchId: BATCH_ID,
    lspId: LSP_ID,
    pseudonym: "ASESI-001",
    displayName: "Rahasia Kartika Wijaya",
    apl01Name: "Rahasia Kartika Wijaya",
    ktpNameOcr: "RAHASIA KARTIKA WIJAYA",
    suratTugasName: "Rahasia Kartika",
    ijazahName: "Kartika Wijaya",
    certificateNameConfirmed: "Rahasia Kartika Wijaya",
  });
  mocks.listSchemes.mockResolvedValue([
    {
      id: SCHEME_ID,
      code: "SKM-TEST",
      name: "Skema Pengujian",
      manifest: {
        decisionRuleRef: "SKKNI 2024",
        units: [{ code: "U-01", title: "Unit Uji 1" }],
        interviewQuestions: [
          { no: 1, unitCode: "U-01", question: "Contoh pertanyaan dasar?" },
        ],
      },
    },
  ]);
  mocks.getLspNameForUser.mockResolvedValue("LSP Penguji");
  mocks.getLatestProviderConfigForAssessor.mockResolvedValue({
    provider: "openai",
    encryptedApiKey: "enc-key",
    baseUrl: null,
    encryptedGatewayToken: null,
    model: "gpt-test",
    temperature: 0,
    maxTokens: 1500,
  });
  mocks.decryptSecret.mockReturnValue("plain-api-key");
  mocks.listDriveFilesForBatch.mockResolvedValue([
    {
      assesseeId: ASSESSEE_ID,
      docType: "cv",
      extractedText:
        "Nama: Rahasia Kartika Wijaya, NIK 3171010101900001, Supervisor Tambang di Kutai.",
    },
    {
      assesseeId: ASSESSEE_ID,
      docType: "04b",
      extractedText: "Presentasi Kartika Wijaya tentang pengendalian bahaya pit.",
    },
    {
      assesseeId: ASSESSEE_ID,
      docType: "09",
      extractedText: "Draft FR.IA.09 untuk Rahasia Kartika Wijaya.",
    },
  ]);
  mocks.getLatestDitAnalysis.mockResolvedValue({
    readiness: { readiness_pct: 80, recommendation: "Kompeten" },
    gapQuestions: [{ dimension: "CMS", question: "Bagaimana respons darurat?" }],
  });
  mocks.getSupabaseServerClient.mockResolvedValue({});
  mocks.writeAuditLog.mockResolvedValue("corr-1");
  mocks.runInterviewPipeline.mockResolvedValue({
    ok: true,
    promptVersion: "v1.1.0",
    output: {
      interviewQuestions: [
        {
          no: 1,
          unitCode: "U-01",
          dimension: "CMS",
          question: "Ceritakan situasi darurat pit yang Anda tangani (STAR).",
        },
      ],
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateInterviewQuestionsAction", () => {
  it("denies unauthenticated users and unauthorized roles", async () => {
    mocks.getUser.mockResolvedValue(null);

    const unauth = await generateInterviewQuestionsAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );
    expect(unauth.ok).toBe(false);
    expect(unauth.error).toContain("Unauthorized");

    mocks.getUser.mockResolvedValue({ id: USER_ID });
    mocks.resolveAuthorizedLsp.mockResolvedValue({ allowed: false, lspId: LSP_ID, role: "tuk_admin" });
    const denied = await generateInterviewQuestionsAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain("tidak berwenang");
  });

  it("blocks when rate limit is exceeded", async () => {
    mocks.checkRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 42 });

    const res = await generateInterviewQuestionsAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("42 detik");
    expect(mocks.runInterviewPipeline).not.toHaveBeenCalled();
  });

  it("scrubs candidate real names and NIK before calling LLM and returns question dimensions", async () => {

    const res = await generateInterviewQuestionsAction(
      makeFormData({ batchId: BATCH_ID, assesseeId: ASSESSEE_ID }),
    );

    expect(res.ok).toBe(true);
    expect(res.questions).toEqual([
      {
        no: 1,
        question: "Ceritakan situasi darurat pit yang Anda tangani (STAR).",
        answerSummary: "",
        achieved: null,
        unitCode: "U-01",
        dimension: "CMS",
      },
    ]);

    expect(mocks.runInterviewPipeline).toHaveBeenCalledTimes(1);
    const pipelineArg = mocks.runInterviewPipeline.mock.calls[0]?.[0] as {
      pseudonym: string;
      candidateProfileSummary: string;
      fr09Text: string;
    };
    expect(pipelineArg.pseudonym).toBe("ASESI-001");
    expect(pipelineArg.candidateProfileSummary).toContain("ASESI-001");
    expect(pipelineArg.candidateProfileSummary).toContain("Supervisor Tambang di Kutai");
    for (const leakedToken of ["Rahasia", "Kartika", "Wijaya", "3171010101900001"]) {
      expect(pipelineArg.candidateProfileSummary).not.toContain(leakedToken);
      expect(pipelineArg.fr09Text).not.toContain(leakedToken);
    }
  });
});
