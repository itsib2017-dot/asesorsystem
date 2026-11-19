"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { requireLspRole } from "@/lib/auth/get-role";
import { getUser } from "@/lib/auth/get-session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteAssesseeForBatch,
  getAssesseeById,
  listAssesseesByBatch,
  upsertAssesseesForBatch,
  updateAssesseeDisplayName,
} from "@/repositories/assessees.repository";
import { getBatchById } from "@/repositories/batches.repository";
import { extractGoogleSheetId } from "@/services/drive";
import { parseKelompokAsesiCsv } from "@/services/drive";

const RosterBatchIdSchema = z.object({
  batchId: z.string().uuid("Parameter batchId tidak valid."),
});

const AddAssesseeSchema = RosterBatchIdSchema.extend({
  displayName: z
    .string()
    .trim()
    .min(2, "Nama asesi minimal 2 karakter.")
    .max(200, "Nama asesi maksimal 200 karakter."),
});

const UpdateAssesseeSchema = AddAssesseeSchema.extend({
  assesseeId: z.string().uuid("Parameter asesseeId tidak valid."),
});

const DeleteAssesseeSchema = RosterBatchIdSchema.extend({
  assesseeId: z.string().uuid("Parameter asesseeId tidak valid."),
});

const ImportRosterSchema = RosterBatchIdSchema.extend({
  kelompokSheetUrl: z
    .string()
    .url("Tautan Google Sheet tidak valid.")
    .min(1, "Tautan Google Sheet wajib diisi."),
});

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Returns true when the caller may manage the roster of the given batch.
 * - lsp_admin / tuk_admin: any batch in their LSP
 * - assessor: any batch in their LSP (RBAC enforced at repository layer too)
 *
 * Batch-level assessor assignment is enforced at the RLS/repository layer;
 * this function checks LSP membership which is the gateway check.
 */
async function canManageBatchRoster(
  userId: string,
  batchLspId: string,
): Promise<{ allowed: boolean; role: string | null }> {
  const roleCheck = await requireLspRole(batchLspId, userId, [
    "lsp_admin",
    "tuk_admin",
    "assessor",
  ]);
  return {
    allowed: roleCheck.allowed,
    role: roleCheck.role ?? null,
  };
}

export async function addAssesseeAction(formData: FormData): Promise<{
  ok: boolean;
  assesseeId?: string;
  displayName?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const rate = checkRateLimit(`roster:add:${user.id}`, 30, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak percobaan tambah asesi. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsed = AddAssesseeSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Parameter tidak valid.",
    };
  }
  const { batchId, displayName } = parsed.data;

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const authz = await canManageBatchRoster(user.id, batch.lspId);
  if (!authz.allowed) {
    return {
      ok: false,
      error:
        "Akses ditolak: hanya Asesor yang terdaftar pada batch ini atau Admin LSP/TUK yang dapat menambah asesi.",
    };
  }

  const existing = await listAssesseesByBatch(user.id, batchId);
  const normalized = normalizeName(displayName);
  if (existing.some((a) => normalizeName(a.displayName).toLowerCase() === normalized.toLowerCase())) {
    return {
      ok: false,
      error: `Asesi dengan nama "${normalized}" sudah ada di batch ini.`,
    };
  }

  const result = await upsertAssesseesForBatch({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    names: [normalized],
    existingPool: existing,
  });

  const added = result.find((a) => normalizeName(a.displayName).toLowerCase() === normalized.toLowerCase());

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "batch.roster.add",
        resource: "batches",
        resource_id: batchId,
        after_summary: {
          batchId,
          assesseeId: added?.id ?? null,
          displayName: normalized,
          addedBy: authz.role,
        },
      },
      supabase,
    );
  } catch {
    // Non-fatal: audit log failure must not block roster change.
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  return {
    ok: true,
    assesseeId: added?.id ?? undefined,
    displayName: normalized,
  };
}

export async function updateAssesseeAction(formData: FormData): Promise<{
  ok: boolean;
  assesseeId?: string;
  displayName?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const rate = checkRateLimit(`roster:update:${user.id}`, 30, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak percobaan ubah asesi. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsed = UpdateAssesseeSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Parameter tidak valid.",
    };
  }
  const { batchId, assesseeId, displayName } = parsed.data;

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const authz = await canManageBatchRoster(user.id, batch.lspId);
  if (!authz.allowed) {
    return {
      ok: false,
      error:
        "Akses ditolak: hanya Asesor yang terdaftar pada batch ini atau Admin LSP/TUK yang dapat mengubah asesi.",
    };
  }

  const assessee = await getAssesseeById(user.id, assesseeId);
  if (!assessee || assessee.batchId !== batchId) {
    return { ok: false, error: "Asesi tidak ditemukan pada batch ini." };
  }
  if (assessee.certificateNameConfirmed) {
    return {
      ok: false,
      error: "Nama asesi yang sertifikatnya sudah dikonfirmasi tidak dapat diubah melalui pengelolaan roster.",
    };
  }

  const existing = await listAssesseesByBatch(user.id, batchId);
  const normalized = normalizeName(displayName);
  if (
    existing.some(
      (a) => a.id !== assesseeId && normalizeName(a.displayName).toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      error: `Asesi dengan nama "${normalized}" sudah ada di batch ini.`,
    };
  }

  await updateAssesseeDisplayName({
    userId: user.id,
    assesseeId: assessee.id,
    displayName: normalized,
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "batch.roster.update",
        resource: "batches",
        resource_id: batchId,
        after_summary: {
          batchId,
          assesseeId: assessee.id,
          fromName: assessee.displayName,
          toName: normalized,
          updatedBy: authz.role,
        },
      },
      supabase,
    );
  } catch {
    // Non-fatal.
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  return { ok: true, assesseeId: assessee.id, displayName: normalized };
}

export async function deleteAssesseeAction(formData: FormData): Promise<{
  ok: boolean;
  assesseeId?: string;
  displayName?: string;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const rate = checkRateLimit(`roster:delete:${user.id}`, 20, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak percobaan hapus asesi. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsed = DeleteAssesseeSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    assesseeId: String(formData.get("assesseeId") ?? "").trim(),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Parameter tidak valid.",
    };
  }
  const { batchId, assesseeId } = parsed.data;

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const authz = await canManageBatchRoster(user.id, batch.lspId);
  if (!authz.allowed) {
    return {
      ok: false,
      error:
        "Akses ditolak: hanya Asesor yang terdaftar pada batch ini atau Admin LSP/TUK yang dapat menghapus asesi.",
    };
  }

  const assessee = await getAssesseeById(user.id, assesseeId);
  if (!assessee || assessee.batchId !== batchId) {
    return { ok: false, error: "Asesi tidak ditemukan pada batch ini." };
  }
  if (assessee.certificateNameConfirmed) {
    return {
      ok: false,
      error: "Tidak dapat menghapus asesi yang nama sertifikatnya sudah dikonfirmasi.",
    };
  }

  const result = await deleteAssesseeForBatch({
    userId: user.id,
    assesseeId: assessee.id,
    batchId: batch.id,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "batch.roster.delete",
        resource: "batches",
        resource_id: batchId,
        after_summary: {
          batchId,
          assesseeId: assessee.id,
          fromName: assessee.displayName,
          deletedBy: authz.role,
        },
      },
      supabase,
    );
  } catch {
    // Non-fatal.
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  return { ok: true, assesseeId: assessee.id, displayName: result.displayName };
}

export async function importRosterFromSheetAction(formData: FormData): Promise<{
  ok: boolean;
  importedCount?: number;
  groups?: Array<{ groupName: string; assesseeNames: string[] }>;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const rate = checkRateLimit(`roster:import:${user.id}`, 10, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      error: `Terlalu banyak percobaan impor roster. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsed = ImportRosterSchema.safeParse({
    batchId: String(formData.get("batchId") ?? "").trim(),
    kelompokSheetUrl: String(formData.get("kelompokSheetUrl") ?? "").trim(),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Parameter tidak valid.",
    };
  }
  const { batchId, kelompokSheetUrl } = parsed.data;

  const batch = await getBatchById(user.id, batchId);
  if (!batch) {
    return { ok: false, error: "Batch tidak ditemukan atau akses ditolak." };
  }

  const authz = await canManageBatchRoster(user.id, batch.lspId);
  if (!authz.allowed) {
    return {
      ok: false,
      error:
        "Akses ditolak: hanya Asesor yang terdaftar pada batch ini atau Admin LSP/TUK yang dapat mengimpor roster.",
    };
  }

  const sheetId = extractGoogleSheetId(kelompokSheetUrl);
  if (!sheetId) {
    return {
      ok: false,
      error: "Tidak dapat mengekstrak ID Google Sheet dari tautan tersebut.",
    };
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  let csvText: string;
  try {
    const res = await fetch(csvUrl, {
      headers: { "User-Agent": "AsesorKompetensi/1.4 (+https://assessor-zeta.vercel.app)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Gagal mengunduh Google Sheet (HTTP ${res.status}). Pastikan tautan diatur ke "Anyone with the link" dan dapat diakses publik.`,
      };
    }
    csvText = await res.text();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal mengunduh Google Sheet.",
    };
  }

  const groups = parseKelompokAsesiCsv(csvText);
  if (groups.length === 0) {
    return {
      ok: false,
      error: "Sheet tidak berisi daftar nama asesi yang valid. Pastikan kolom pertama adalah nama kelompok dan kolom kedua berisi nama-nama asesi.",
    };
  }

  const allNames = groups.flatMap((g) => g.assesseeNames);
  if (allNames.length === 0) {
    return {
      ok: false,
      error: "Sheet tidak berisi nama asesi yang dapat diimpor.",
    };
  }

  const existing = await listAssesseesByBatch(user.id, batchId);
  const newNames = allNames.filter(
    (name) => !existing.some((a) => normalizeName(a.displayName).toLowerCase() === normalizeName(name).toLowerCase()),
  );

  if (newNames.length === 0) {
    return {
      ok: true,
      importedCount: 0,
      groups,
      error: undefined,
    };
  }

  await upsertAssesseesForBatch({
    userId: user.id,
    lspId: batch.lspId,
    batchId: batch.id,
    names: newNames,
    existingPool: existing,
  });

  try {
    const supabase = await getSupabaseServerClient();
    await writeAuditLog(
      {
        lsp_id: batch.lspId,
        actor_id: user.id,
        action: "batch.roster.import",
        resource: "batches",
        resource_id: batchId,
        after_summary: {
          batchId,
          importedCount: newNames.length,
          totalNames: allNames.length,
          groups: groups.map((g) => ({ group: g.groupName, count: g.assesseeNames.length })),
          sheetId,
          importedBy: authz.role,
        },
      },
      supabase,
    );
  } catch {
    // Non-fatal.
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/triage`);
  return {
    ok: true,
    importedCount: newNames.length,
    groups,
  };
}
