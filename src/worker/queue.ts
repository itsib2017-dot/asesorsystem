import { enqueueJobRecord, getJobRecordById } from "@/repositories/jobs.repository";

export type JobType =
  | "hello"
  | "drive_scan"
  | "extract_file"
  | "ocr_ktp"
  | "dit_analysis"
  | "written_grading"
  | "similarity_run"
  | "ak05_export";

export async function enqueueJob(params: {
  userId: string;
  type: JobType;
  payload: Record<string, unknown>;
}) {
  return enqueueJobRecord({
    createdBy: params.userId,
    type: params.type,
    payload: params.payload,
  });
}

export async function getJobStatus(userId: string, jobId: string) {
  return getJobRecordById(userId, jobId);
}
