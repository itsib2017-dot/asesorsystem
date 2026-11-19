import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadBatchSimilarityReportData } from "../load-batch-similarity";

const {
  mockGetBatchById,
  mockListPairs,
  mockListAssessees,
  mockListSchemes,
  mockGetConfigWithSource,
  mockListWrittenGradings,
} = vi.hoisted(() => ({
  mockGetBatchById: vi.fn(),
  mockListPairs: vi.fn(),
  mockListAssessees: vi.fn(),
  mockListSchemes: vi.fn(),
  mockGetConfigWithSource: vi.fn(),
  mockListWrittenGradings: vi.fn(),
}));

vi.mock("@/repositories/batches.repository", () => ({
  getBatchById: mockGetBatchById,
}));
vi.mock("@/repositories/assessees.repository", () => ({
  listAssesseesByBatch: mockListAssessees,
}));
vi.mock("@/repositories/assessment.repository", () => ({
  listSimilarityPairsByBatch: mockListPairs,
  listWrittenGradingsForBatch: mockListWrittenGradings,
}));
vi.mock("@/repositories/schemes.repository", () => ({
  listSchemes: mockListSchemes,
}));
vi.mock("@/lib/config/get-config", () => ({
  getConfigWithSource: mockGetConfigWithSource,
}));

describe("loadBatchSimilarityReportData (T9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBatchById.mockResolvedValue({
      id: "batch-1",
      lspId: "lsp-1",
      schemeId: "scheme-1",
      name: "Batch Uji 1",
    });
    mockListSchemes.mockResolvedValue([
      { id: "scheme-1", code: "AK3U", name: "Ahli K3 Umum" },
    ]);
    mockListAssessees.mockResolvedValue([
      { id: "a1", displayName: "Peserta Bersih" },
      { id: "a2", displayName: "Peserta Flagged" },
      { id: "a3", displayName: "Peserta Belum" },
    ]);
    mockListPairs.mockResolvedValue([
      {
        assesseeAId: "a2",
        assesseeBId: "a4",
        jaccardScore: 0.72,
        tfidfCosine: 0.81,
        sharedSpans: ["contoh frasa"],
        verdict: "near",
      },
    ]);
    mockListWrittenGradings.mockResolvedValue([
      {
        assesseeId: "a1",
        itemVerdicts: [{ questionNo: 1, verdict: "Benar", explanation: "Tepat" }],
        errorSummary: [],
        plagiarismReport: { status: "Bersih", reasoning: "Jawaban orisinal." },
      },
    ]);
  });

  it("marks thresholds as uncalibrated when unconfirmed is not false and populates written summaries", async () => {
    mockGetConfigWithSource.mockResolvedValue({
      value: {
        exact: 0.85,
        near: 0.65,
        partial: 0.45,
        unconfirmed: true,
      },
      source: "global",
      sourceLabel: "Konfigurasi Global (app_config)",
    });

    const data = await loadBatchSimilarityReportData("u1", "batch-1");
    expect(data).not.toBeNull();
    expect(data!.thresholdsUncalibrated).toBe(true);
    expect(data!.thresholdSource).toBe("global");
    expect(data!.thresholdSourceLabel).toBe("Konfigurasi Global (app_config)");
    expect(data!.combinedMd).toContain("Sementara / Belum Dikalibrasi");
    expect(data!.combinedMd).toContain("Sumber: Konfigurasi Global (app_config)");

    const s1 = data!.assesseeSummaries.find((s) => s.assesseeId === "a1");
    const s2 = data!.assesseeSummaries.find((s) => s.assesseeId === "a2");
    const s3 = data!.assesseeSummaries.find((s) => s.assesseeId === "a3");

    expect(s1?.plagiarismStatus).toBe("Bersih");
    expect(s1?.verdicts).toHaveLength(1);
    expect(s2?.plagiarismStatus).toBe("Waspada");
    expect(s3?.plagiarismStatus).toBe("Belum diperiksa");
  });

  it("marks thresholds as calibrated when unconfirmed is explicitly false", async () => {
    mockGetConfigWithSource.mockResolvedValue({
      value: {
        exact: 0.9,
        near: 0.75,
        partial: 0.5,
        unconfirmed: false,
      },
      source: "lsp",
      sourceLabel: "Konfigurasi Tenant (app_config)",
    });

    const data = await loadBatchSimilarityReportData("u1", "batch-1");
    expect(data!.thresholdsUncalibrated).toBe(false);
    expect(data!.thresholdSource).toBe("lsp");
    expect(data!.combinedMd).not.toContain("Sementara / Belum Dikalibrasi");
    expect(data!.combinedMd).toContain("Sumber: Konfigurasi Tenant (app_config)");
  });
});
