import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth/get-session";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { apiError, apiSuccess } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createBatchRecord, listBatchesForUser } from "@/repositories/batches.repository";
import { listJobsForUser } from "@/repositories/jobs.repository";
import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { enqueueJob } from "@/worker/queue";

const createBatchSchema = z.object({
  schemeId: z.string().uuid({ message: "Skema sertifikasi wajib dipilih." }),
  name: z.string().min(3, { message: "Nama batch minimal 3 karakter." }),
  tukName: z.string().optional(),
  tukType: z.enum(["sewaktu", "tempat_kerja", "mandiri"]).default("sewaktu"),
  assessmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal asesmen harus YYYY-MM-DD.")
    .optional()
    .or(z.literal("")),
  driveFolderUrl: z.string().url({ message: "Link Google Drive harus valid." }),
  kelompokSheetUrl: z.string().optional(),
});

export async function GET() {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const [batches, recentJobs] = await Promise.all([
    listBatchesForUser(user.id),
    listJobsForUser(user.id, 100),
  ]);

  const enriched = batches.map((batch) => {
    const latestJob =
      recentJobs.find((j) => String(j.payload?.batchId ?? "") === batch.id) ?? null;
    return {
      ...batch,
      ingestJobId: latestJob?.id ?? null,
      ingestStatus: latestJob?.status ?? null,
      latestJob: latestJob
        ? {
            id: latestJob.id,
            type: latestJob.type,
            status: latestJob.status,
            progress: latestJob.progress,
            error: latestJob.error,
            attempts: latestJob.attempts,
            updatedAt: latestJob.updatedAt,
          }
        : null,
    };
  });

  return apiSuccess(enriched);
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body JSON tidak valid.");
  }

  const parsed = createBatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Input pembuatan batch tidak valid.",
      parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
    );
  }

  // SSRF allow-list check for Drive link
  const driveCheck = validateSafeExternalUrl(parsed.data.driveFolderUrl, [
    "drive.google.com",
    "docs.google.com",
  ]);
  if (!driveCheck.safe) {
    return apiError("VALIDATION_ERROR", driveCheck.reason, [
      { field: "driveFolderUrl", issue: driveCheck.reason },
    ]);
  }

  const authz = await resolveAuthorizedLsp(user.id, [
    "lsp_admin",
    "tuk_admin",
    "assessor",
  ]);
  if (!authz.allowed || !authz.lspId) {
    return apiError("FORBIDDEN", "Akun belum memiliki peran yang berwenang membuat batch.");
  }

  const result = await createBatchRecord({
    userId: user.id,
    lspId: authz.lspId,
    schemeId: parsed.data.schemeId,
    name: parsed.data.name,
    tukName: parsed.data.tukName,
    tukType: parsed.data.tukType,
    assessmentDate: parsed.data.assessmentDate ? parsed.data.assessmentDate : null,
    driveFolderUrl: parsed.data.driveFolderUrl,
    kelompokSheetUrl: parsed.data.kelompokSheetUrl,
  });

  if (!result.ok) {
    return apiError("UNPROCESSABLE", result.error);
  }

  const scanJob = await enqueueJob({
    userId: user.id,
    lspId: authz.lspId,
    type: "drive_scan",
    payload: {
      batchId: result.batchId,
      driveFolderUrl: parsed.data.driveFolderUrl,
    },
  });

  const supabase = await getSupabaseServerClient();
  await writeAuditLog(
    {
      lsp_id: authz.lspId,
      actor_id: user.id,
      action: "batch.create",
      resource: "batches",
      resource_id: result.batchId,
      after_summary: {
        name: parsed.data.name,
        schemeId: parsed.data.schemeId,
        tukType: parsed.data.tukType,
        ingestJobId: scanJob.ok ? scanJob.job.id : null,
      },
    },
    supabase,
  );

  revalidatePath("/batches");
  revalidatePath("/dashboard");

  return apiSuccess(
    {
      batchId: result.batchId,
      ingestJobId: scanJob.ok ? scanJob.job.id : null,
      ingestStatus: scanJob.ok ? scanJob.job.status : null,
    },
    undefined,
    201,
  );
}
