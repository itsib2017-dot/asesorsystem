import { describe, expect, it } from "vitest";
import { selectDitInputFiles } from "../dit-inputs";

describe("Shared DIT Input Selector (T6)", () => {
  it("resolves 04a -> shared batch 04a -> 04b + dit_form -> cv with portofolio fallback consistently", () => {
    const assesseeFiles = [
      { id: "04b-1", assesseeId: "a1", fileName: "Presentasi_DIT.pptx", docType: "04b" },
      { id: "df-old", assesseeId: "a1", fileName: "1. Form IBPR.pdf", docType: "dit_form", driveModifiedTime: "2026-11-10T00:00:00Z" },
      { id: "df-new", assesseeId: "a1", fileName: "1. Form IBPR_Revisi.pdf", docType: "dit_form", driveModifiedTime: "2026-11-18T00:00:00Z" },
      { id: "porto", assesseeId: "a1", fileName: "Portofolio.pdf", docType: "portofolio" },
    ];
    const batchFiles = [
      ...assesseeFiles,
      { id: "batch-04a", assesseeId: null, fileName: "FR.IA.04A_Shared.docx", docType: "04a" },
    ];

    const res = selectDitInputFiles(assesseeFiles, batchFiles);
    expect(res.frIa04aSource).toBe("batch");
    expect(res.used04aFiles.map((f) => f.id)).toEqual(["batch-04a"]);
    expect(res.combinedDitFiles.map((f) => f.id)).toEqual(["04b-1", "df-new"]);
    expect(res.usedCvFile?.id).toBe("porto");
  });
});
