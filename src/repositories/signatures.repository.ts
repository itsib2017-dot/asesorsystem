import { desc, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { runRepositoryDualPath } from "@/db";
import { signatures } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit/write-audit-log";

export interface SignatureVersion {
  id: string;
  assessorId: string;
  storagePath: string;
  sha256: string;
  mimeType: string;
  isActive: boolean;
  createdAt: string;
  signedUrl?: string;
}

export async function listAssessorSignatures(
  assessorId: string,
): Promise<SignatureVersion[]> {
  const supabase = await getSupabaseServerClient();

  const rows = await runRepositoryDualPath({
    userId: assessorId,
    label: "SignaturesRepository.listSignatures",
    drizzle: async (tx) => {
      const dbRows = await tx
        .select()
        .from(signatures)
        .where(eq(signatures.assessorId, assessorId))
        .orderBy(desc(signatures.createdAt));
      return dbRows.map((r) => ({
        id: r.id,
        assessorId: r.assessorId,
        storagePath: r.storagePath,
        sha256: r.sha256,
        mimeType: r.mimeType,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    supabase: async () => {
      const { data } = await supabase
        .from("signatures")
        .select("*")
        .eq("assessor_id", assessorId)
        .order("created_at", { ascending: false });

      return (data ?? []).map((r) => ({
        id: r.id as string,
        assessorId: r.assessor_id as string,
        storagePath: r.storage_path as string,
        sha256: r.sha256 as string,
        mimeType: r.mime_type as string,
        isActive: Boolean(r.is_active),
        createdAt: r.created_at as string,
      }));
    },
  });

  // Generate short-lived signed URLs (5 mins) for active/historical preview
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(row.storagePath, 300);
      return {
        ...row,
        signedUrl: data?.signedUrl,
      };
    }),
  );

  return enriched;
}

export async function uploadAssessorSignature(params: {
  assessorId: string;
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg";
}): Promise<{ ok: true; signature: SignatureVersion } | { ok: false; error: string }> {
  const supabase = await getSupabaseServerClient();
  const ext = params.mimeType === "image/png" ? "png" : "jpg";
  const versionId = randomUUID();
  const storagePath = `${params.assessorId}/${versionId}.${ext}`;
  const sha256 = createHash("sha256").update(params.buffer).digest("hex");

  // 1. Upload to private Storage bucket 'signatures'
  const { error: uploadError } = await supabase.storage
    .from("signatures")
    .upload(storagePath, params.buffer, {
      contentType: params.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: `Gagal mengunggah file tanda tangan: ${uploadError.message}` };
  }

  // 2. Deactivate old signatures and insert new versioned signature record via dual-path DB helper
  const dbOutcome = await runRepositoryDualPath<
    { ok: true; createdAt: string } | { ok: false; error: string }
  >({
    userId: params.assessorId,
    label: "SignaturesRepository.uploadSignature",
    drizzle: async (tx) => {
      await tx
        .update(signatures)
        .set({ isActive: false, supersededBy: versionId })
        .where(eq(signatures.assessorId, params.assessorId));

      await tx.insert(signatures).values({
        id: versionId,
        assessorId: params.assessorId,
        storagePath,
        sha256,
        mimeType: params.mimeType,
        isActive: true,
      });
      return { ok: true, createdAt: new Date().toISOString() };
    },
    supabase: async () => {
      await supabase
        .from("signatures")
        .update({ is_active: false, superseded_by: versionId })
        .eq("assessor_id", params.assessorId);

      const { data, error: dbErr } = await supabase
        .from("signatures")
        .insert({
          id: versionId,
          assessor_id: params.assessorId,
          storage_path: storagePath,
          sha256,
          mime_type: params.mimeType,
          is_active: true,
        })
        .select("created_at")
        .single();

      if (dbErr) {
        return { ok: false, error: `Gagal menyimpan metadata tanda tangan: ${dbErr.message}` };
      }
      return {
        ok: true,
        createdAt: (data?.created_at as string | undefined) ?? new Date().toISOString(),
      };
    },
  });

  if (!dbOutcome.ok) {
    return dbOutcome;
  }
  const createdAt = dbOutcome.createdAt;

  await writeAuditLog(
    {
      actor_id: params.assessorId,
      action: "signature.upload",
      resource: "signatures",
      resource_id: versionId,
      after_summary: { sha256, mimeType: params.mimeType },
    },
    supabase,
  );

  const { data: signed } = await supabase.storage
    .from("signatures")
    .createSignedUrl(storagePath, 300);

  return {
    ok: true,
    signature: {
      id: versionId,
      assessorId: params.assessorId,
      storagePath,
      sha256,
      mimeType: params.mimeType,
      isActive: true,
      createdAt,
      signedUrl: signed?.signedUrl,
    },
  };
}

export async function getActiveSignature(
  assessorId: string,
): Promise<SignatureVersion | null> {
  const list = await listAssessorSignatures(assessorId);
  return list.find((s) => s.isActive) ?? null;
}
