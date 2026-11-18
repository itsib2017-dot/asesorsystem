import { describe, it, expect } from "vitest";
import { evaluateSimilarityPair } from "../similarity";

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
});
