import { z } from "zod";
import { getUser } from "@/lib/auth/get-session";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { apiError, apiSuccess } from "@/lib/errors";
import { createBatchRecord, listBatchesForUser } from "@/repositories/batches.repository";
import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { enqueueJob } from "@/worker/queue";

const createBatchSchema = z.object({
  schemeId: z.string().uuid({ message: "Skema sertifikasi wajib dipilih." }),
  name: z.string().min(3, { message: "Nama batch minimal 3 karakter." }),
  tukName: z.string().optional(),
  tukType: z.enum(["sewaktu", "tempat_kerja", "mandiri"]).default("sewaktu"),
  driveFolderUrl: z.string().url({ message: "Link Google Drive harus valid." }),
  kelompokSheetUrl: z.string().optional(),
});

export async function GET() {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sesi tidak valid.");
  }

  const batches = await listBatchesForUser(user.id);
  return apiSuccess(batches);
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
    driveFolderUrl: parsed.data.driveFolderUrl,
    kelompokSheetUrl: parsed.data.kelompokSheetUrl,
  });

  if (!result.ok) {
    return apiError("UNPROCESSABLE", result.error);
  }

  const scanJob = await enqueueJob({
    userId: user.id,
    type: "drive_scan",
    payload: {
      batchId: result.batchId,
      driveFolderUrl: parsed.data.driveFolderUrl,
    },
  });

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
