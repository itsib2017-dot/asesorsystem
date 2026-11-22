import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BATCH_WORKFLOW_STEPS,
  BatchWorkflowStepper,
  buildBatchWorkflowSteps,
} from "../batch-workflow-stepper";

describe("BatchWorkflowStepper (T8)", () => {
  it("renders all 9 exact numbered workflow steps and sets aria-current on the active step", () => {
    const html = renderToStaticMarkup(
      React.createElement(BatchWorkflowStepper, {
        batchId: "batch-123",
        currentStep: 6,
        assesseeId: "as-456",
      }),
    );

    const expectedLabels = [
      "1. Buat Batch",
      "2. Surat Tugas",
      "3. Pindai &amp; Triage",
      "4. Roster Asesi",
      "5. Analisis DIT",
      "6. Penilaian 04B",
      "7. Wawancara (09)",
      "8. Laporan AK.05",
      "9. Ekspor",
    ];
    expect(BATCH_WORKFLOW_STEPS).toHaveLength(9);
    for (const label of expectedLabels) {
      expect(html).toContain(label);
    }

    expect(html).toContain('aria-current="step"');
    expect(html).toContain("/batches/batch-123#surat-tugas");
    expect(html).toContain("/batches/batch-123/assessees/as-456/dit#form-04b");
    expect(html).toContain("/batches/batch-123/assessees/as-456/interview");
    expect(html).toContain("/batches/batch-123/ak05#ekspor");
  });

  it("falls back to triage roster anchor for assessee-level steps when no assesseeId is provided", () => {
    const steps = buildBatchWorkflowSteps("batch-xyz");
    const step5 = steps.find((s) => s.step === 5);
    const step6 = steps.find((s) => s.step === 6);
    const step7 = steps.find((s) => s.step === 7);

    expect(step5?.href).toBe("/batches/batch-xyz/triage#roster");
    expect(step6?.href).toBe("/batches/batch-xyz/triage#roster");
    expect(step7?.href).toBe("/batches/batch-xyz/triage#roster");
  });
});
