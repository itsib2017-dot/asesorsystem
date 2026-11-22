import { describe, it, expect } from "vitest";
import { evaluateSimilarityPair, renderCombinedWrittenReportMarkdown } from "../similarity";

describe("Layered Similarity Engine Calibration (M4.4)", () => {
  const thresholds = { exact: 0.85, near: 0.65, partial: 0.45 };

  it("separates copy-paste, paraphrase, and unrelated Indonesian K3 answers cleanly", () => {
    const ansBase =
      "Berdasarkan UU No 1 Tahun 1970 tentang Keselamatan Kerja, setiap pengurus wajib melakukan identifikasi bahaya dan pengendalian risiko di tempat kerja melalui prosedur LOTO serta alat pelindung diri yang sesuai standar.";
    const ansCopy =
      "Berdasarkan UU No 1 Tahun 1970 tentang Keselamatan Kerja, setiap pengurus wajib melakukan identifikasi bahaya dan pengendalian risiko di tempat kerja melalui prosedur LOTO serta alat pelindung diri yang sesuai standar.";
    const ansParaphrase =
      "Sesuai amanat UU Nomor 1 Tahun 1970 mengenai keselamatan kerja, pengurus harus mengidentifikasi bahaya di lingkungan kerja dan mengendalikan risiko memakai prosedur penguncian LOTO serta APD standar.";
    const ansUnrelated =
      "Manajemen limbah bahan berbahaya dan beracun memerlukan izin tempat penyimpanan sementara serta pelaporan manifest elektronik secara berkala kepada dinas lingkungan hidup.";

    const copyMetrics = evaluateSimilarityPair(ansBase, ansCopy, thresholds);
    const paraMetrics = evaluateSimilarityPair(ansBase, ansParaphrase, thresholds);
    const unrelatedMetrics = evaluateSimilarityPair(ansBase, ansUnrelated, thresholds);

    expect(copyMetrics.jaccardScore).toBe(1);
    expect(copyMetrics.flagLevel).toBe("exact");
    expect(copyMetrics.qualitativeStatus).toBe("Waspada");

    expect(paraMetrics.tfidfCosine).toBeGreaterThan(unrelatedMetrics.tfidfCosine);
    expect(unrelatedMetrics.flagLevel).toBe("clean");
    expect(unrelatedMetrics.qualitativeStatus).toBe("Bersih");
  });

  it("renders combined max(Jaccard, Cosine) score and rule explanation in markdown report", () => {
    const md = renderCombinedWrittenReportMarkdown({
      batchName: "Batch Uji",
      schemeName: "AK3U",
      thresholds,
      thresholdsUncalibrated: true,
      thresholdSourceLabel: "Default",
      assessees: [],
      flaggedPairs: [
        {
          assesseeAName: "Asesi A",
          assesseeAId: "a1",
          assesseeBName: "Asesi B",
          assesseeBId: "a2",
          jaccardScore: 0.0891,
          tfidfCosine: 0.6332,
          sharedSpans: [],
          verdict: "partial",
        },
      ],
    });

    expect(md).toContain("max(Jaccard, Cosine)");
    expect(md).toContain("Skor Gabungan (max)");
    expect(md).toContain("0.6332");
  });
});
