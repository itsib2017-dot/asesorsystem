import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

export interface BatchWorkflowStepItem {
  step: number;
  label: string;
  href: string;
}

export const BATCH_WORKFLOW_STEPS = [
  { step: 1, label: "1. Buat Batch" },
  { step: 2, label: "2. Surat Tugas" },
  { step: 3, label: "3. Pindai & Triage" },
  { step: 4, label: "4. Roster Asesi" },
  { step: 5, label: "5. Analisis DIT" },
  { step: 6, label: "6. Penilaian 04B" },
  { step: 7, label: "7. Wawancara (09)" },
  { step: 8, label: "8. Laporan AK.05" },
  { step: 9, label: "9. Ekspor" },
] as const;

export function buildBatchWorkflowSteps(
  batchId: string,
  assesseeId?: string,
): BatchWorkflowStepItem[] {
  const rosterFallback = `/batches/${batchId}/triage#roster`;
  return [
    { step: 1, label: BATCH_WORKFLOW_STEPS[0].label, href: "/batches" },
    { step: 2, label: BATCH_WORKFLOW_STEPS[1].label, href: `/batches/${batchId}#surat-tugas` },
    { step: 3, label: BATCH_WORKFLOW_STEPS[2].label, href: `/batches/${batchId}/triage` },
    { step: 4, label: BATCH_WORKFLOW_STEPS[3].label, href: rosterFallback },
    {
      step: 5,
      label: BATCH_WORKFLOW_STEPS[4].label,
      href: assesseeId
        ? `/batches/${batchId}/assessees/${assesseeId}/dit`
        : rosterFallback,
    },
    {
      step: 6,
      label: BATCH_WORKFLOW_STEPS[5].label,
      href: assesseeId
        ? `/batches/${batchId}/assessees/${assesseeId}/dit#form-04b`
        : rosterFallback,
    },
    {
      step: 7,
      label: BATCH_WORKFLOW_STEPS[6].label,
      href: assesseeId
        ? `/batches/${batchId}/assessees/${assesseeId}/interview`
        : rosterFallback,
    },
    { step: 8, label: BATCH_WORKFLOW_STEPS[7].label, href: `/batches/${batchId}/ak05` },
    { step: 9, label: BATCH_WORKFLOW_STEPS[8].label, href: `/batches/${batchId}/ak05#ekspor` },
  ];
}

interface BatchWorkflowStepperProps {
  batchId: string;
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  assesseeId?: string;
}

export function BatchWorkflowStepper({
  batchId,
  currentStep,
  assesseeId,
}: BatchWorkflowStepperProps) {
  const steps = buildBatchWorkflowSteps(batchId, assesseeId);

  return (
    <nav
      aria-label="Alur Kerja Asesmen"
      data-testid="batch-workflow-stepper"
      className="glass-card rounded-2xl p-3 border border-slate-200 overflow-x-auto"
    >
      <ol className="flex flex-wrap items-center gap-1.5 min-w-0">
        {steps.map((item) => {
          const isCompleted = item.step < currentStep;
          const isActive = item.step === currentStep;
          return (
            <li key={item.step} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive ? "step" : undefined}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-colors ${
                  isActive
                    ? "bg-teal-700 border-teal-700 text-white shadow-sm font-semibold"
                    : isCompleted
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {isCompleted && <Check className="w-3 h-3 shrink-0" />}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
