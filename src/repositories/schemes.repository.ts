import { and, asc, eq } from "drizzle-orm";
import { runRepositoryDualPath } from "@/db";
import { schemes, schemeFormManifests } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface SchemeKelompokSpec {
  kpIndex: number;
  title: string;
  isGenericFallback?: boolean;
  units: Array<{ no: number; code: string; title: string }>;
  aspects: Array<{
    kpIndex: number;
    no: number;
    unitCode: string;
    unitTitle: string;
    lingkup: string;
    question: string;
    kukRef: string;
  }>;
}

export interface SchemeWrittenQuestionSpec {
  no: number;
  unitCode?: string;
  question: string;
  kukRef?: string;
}

export interface SchemeInterviewQuestionSpec {
  no: number;
  unitCode?: string;
  question: string;
}

export interface SchemeBrandingConfig {
  leftLogoUrl?: string;
  leftLogoAlt?: string;
  rightLogoUrl?: string;
  rightLogoAlt?: string;
}

export interface SchemeManifestConfig {
  questionCounts: {
    official04bCount: number;
    written06aCount: number;
    questionBankCount: number;
  };
  decisionRule: string;
  decisionRuleRef: string;
  prerequisites: string[];
  registrationRequirements: string[];
  units: Array<{ code: string; title: string }>;
  kelompokPekerjaan?: SchemeKelompokSpec[];
  writtenQuestions?: SchemeWrittenQuestionSpec[];
  interviewQuestions?: SchemeInterviewQuestionSpec[];
  docColumns?: string[];
  branding?: SchemeBrandingConfig;
  formSuffixMapping: {
    soal: string;
    kunci: string;
    jawaban: string;
  };
}

export interface SchemeFormManifestEntry {
  id: string;
  formKey: string;
  formName: string;
  filePatterns: string[];
  required: boolean;
  instrumentRole: string;
  sortOrder: number;
  templateStoragePath: string | null;
  templateFileName: string | null;
  templateMimeType: string | null;
  templateSha256: string | null;
  templateVersion: number;
  templateUploadedAt: string | null;
  templateUploadedBy: string | null;
}

export interface SchemeFormManifestInput {
  formKey: string;
  formName?: string;
  filePatterns: string[];
  required: boolean;
  instrumentRole: string;
  sortOrder: number;
  templateStoragePath?: string | null;
  templateFileName?: string | null;
  templateMimeType?: string | null;
  templateSha256?: string | null;
  templateVersion?: number;
  templateUploadedAt?: string | null;
  templateUploadedBy?: string | null;
}

export interface SchemeRecord {
  id: string;
  lspId: string;
  code: string;
  name: string;
  manifest: SchemeManifestConfig;
  version: number;
  forms: SchemeFormManifestEntry[];
}

function mapDrizzleFormRow(f: typeof schemeFormManifests.$inferSelect): SchemeFormManifestEntry {
  return {
    id: f.id,
    formKey: f.formKey,
    formName: f.formName ?? "",
    filePatterns: f.filePatterns,
    required: f.required,
    instrumentRole: f.instrumentRole,
    sortOrder: f.sortOrder,
    templateStoragePath: f.templateStoragePath ?? null,
    templateFileName: f.templateFileName ?? null,
    templateMimeType: f.templateMimeType ?? null,
    templateSha256: f.templateSha256 ?? null,
    templateVersion: f.templateVersion ?? 0,
    templateUploadedAt: f.templateUploadedAt ? f.templateUploadedAt.toISOString() : null,
    templateUploadedBy: f.templateUploadedBy ?? null,
  };
}

function mapSupabaseFormRow(f: Record<string, unknown>): SchemeFormManifestEntry {
  return {
    id: String(f.id),
    formKey: String(f.form_key),
    formName: typeof f.form_name === "string" ? f.form_name : "",
    filePatterns: Array.isArray(f.file_patterns) ? (f.file_patterns as string[]) : [],
    required: Boolean(f.required),
    instrumentRole: String(f.instrument_role),
    sortOrder: Number(f.sort_order ?? 0),
    templateStoragePath:
      typeof f.template_storage_path === "string" ? f.template_storage_path : null,
    templateFileName: typeof f.template_file_name === "string" ? f.template_file_name : null,
    templateMimeType: typeof f.template_mime_type === "string" ? f.template_mime_type : null,
    templateSha256: typeof f.template_sha256 === "string" ? f.template_sha256 : null,
    templateVersion: Number(f.template_version ?? 0),
    templateUploadedAt:
      typeof f.template_uploaded_at === "string" ? f.template_uploaded_at : null,
    templateUploadedBy:
      typeof f.template_uploaded_by === "string" ? f.template_uploaded_by : null,
  };
}

export async function listSchemes(userId: string, lspId?: string): Promise<SchemeRecord[]> {
  return runRepositoryDualPath({
    userId,
    label: "SchemesRepository.listSchemes",
    drizzle: async (tx) => {
      const schemeRows = lspId
        ? await tx.select().from(schemes).where(eq(schemes.lspId, lspId))
        : await tx.select().from(schemes);

      const results: SchemeRecord[] = [];
      for (const s of schemeRows) {
        const forms = await tx
          .select()
          .from(schemeFormManifests)
          .where(eq(schemeFormManifests.schemeId, s.id))
          .orderBy(asc(schemeFormManifests.sortOrder));

        results.push({
          id: s.id,
          lspId: s.lspId,
          code: s.code,
          name: s.name,
          manifest: s.manifest as SchemeManifestConfig,
          version: s.version,
          forms: forms.map(mapDrizzleFormRow),
        });
      }
      return results;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      let query = supabase.from("schemes").select("*, scheme_form_manifests(*)");
      if (lspId) query = query.eq("lsp_id", lspId);
      const { data } = await query;

      return (data ?? []).map((s) => ({
        id: s.id as string,
        lspId: s.lsp_id as string,
        code: s.code as string,
        name: s.name as string,
        manifest: (s.manifest ?? {}) as SchemeManifestConfig,
        version: Number(s.version ?? 1),
        forms: Array.isArray(s.scheme_form_manifests)
          ? (s.scheme_form_manifests as Array<Record<string, unknown>>)
              .map((f) => mapSupabaseFormRow(f))
              .sort((a, b) => a.sortOrder - b.sortOrder)
          : [],
      }));
    },
  });
}

export async function getSchemeById(
  userId: string,
  schemeId: string,
): Promise<SchemeRecord | null> {
  return runRepositoryDualPath({
    userId,
    label: "SchemesRepository.getSchemeById",
    drizzle: async (tx) => {
      const [s] = await tx.select().from(schemes).where(eq(schemes.id, schemeId)).limit(1);
      if (!s) return null;
      const forms = await tx
        .select()
        .from(schemeFormManifests)
        .where(eq(schemeFormManifests.schemeId, s.id))
        .orderBy(asc(schemeFormManifests.sortOrder));
      return {
        id: s.id,
        lspId: s.lspId,
        code: s.code,
        name: s.name,
        manifest: s.manifest as SchemeManifestConfig,
        version: s.version,
        forms: forms.map(mapDrizzleFormRow),
      };
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data: s } = await supabase
        .from("schemes")
        .select("*, scheme_form_manifests(*)")
        .eq("id", schemeId)
        .maybeSingle();
      if (!s) return null;
      return {
        id: s.id as string,
        lspId: s.lsp_id as string,
        code: s.code as string,
        name: s.name as string,
        manifest: (s.manifest ?? {}) as SchemeManifestConfig,
        version: Number(s.version ?? 1),
        forms: Array.isArray(s.scheme_form_manifests)
          ? (s.scheme_form_manifests as Array<Record<string, unknown>>)
              .map((f) => mapSupabaseFormRow(f))
              .sort((a, b) => a.sortOrder - b.sortOrder)
          : [],
      };
    },
  });
}

export async function createOrUpdateScheme(params: {
  userId: string;
  lspId: string;
  code: string;
  name: string;
  manifest: SchemeManifestConfig;
  forms: SchemeFormManifestInput[];
}): Promise<{ ok: true; schemeId: string } | { ok: false; error: string }> {
  try {
    return await runRepositoryDualPath({
      userId: params.userId,
      label: "SchemesRepository.createOrUpdateScheme",
      drizzle: async (tx) => {
        const [inserted] = await tx
          .insert(schemes)
          .values({
            lspId: params.lspId,
            code: params.code,
            name: params.name,
            manifest: params.manifest,
          })
          .onConflictDoUpdate({
            target: [schemes.lspId, schemes.code],
            set: { name: params.name, manifest: params.manifest },
          })
          .returning({ id: schemes.id });

        const id = inserted?.id;
        if (!id) throw new Error("Failed to upsert scheme");

        const existingForms = await tx
          .select()
          .from(schemeFormManifests)
          .where(eq(schemeFormManifests.schemeId, id));
        const existingByKey = new Map(
          existingForms.map((row) => [row.formKey.toLowerCase(), row]),
        );

        await tx.delete(schemeFormManifests).where(eq(schemeFormManifests.schemeId, id));
        if (params.forms.length > 0) {
          await tx.insert(schemeFormManifests).values(
            params.forms.map((f) => {
              const prev = existingByKey.get(f.formKey.toLowerCase());
              return {
                lspId: params.lspId,
                schemeId: id,
                formKey: f.formKey,
                formName: f.formName?.trim() ?? prev?.formName ?? "",
                filePatterns: f.filePatterns,
                required: f.required,
                instrumentRole: f.instrumentRole,
                sortOrder: f.sortOrder,
                templateStoragePath:
                  f.templateStoragePath !== undefined
                    ? f.templateStoragePath
                    : (prev?.templateStoragePath ?? null),
                templateFileName:
                  f.templateFileName !== undefined
                    ? f.templateFileName
                    : (prev?.templateFileName ?? null),
                templateMimeType:
                  f.templateMimeType !== undefined
                    ? f.templateMimeType
                    : (prev?.templateMimeType ?? null),
                templateSha256:
                  f.templateSha256 !== undefined
                    ? f.templateSha256
                    : (prev?.templateSha256 ?? null),
                templateVersion:
                  f.templateVersion !== undefined
                    ? f.templateVersion
                    : (prev?.templateVersion ?? 0),
                templateUploadedAt:
                  f.templateUploadedAt !== undefined
                    ? f.templateUploadedAt
                      ? new Date(f.templateUploadedAt)
                      : null
                    : (prev?.templateUploadedAt ?? null),
                templateUploadedBy:
                  f.templateUploadedBy !== undefined
                    ? f.templateUploadedBy
                    : (prev?.templateUploadedBy ?? null),
              };
            }),
          );
        }
        return { ok: true, schemeId: id } as const;
      },
      supabase: async () => {
        const supabase = await getSupabaseServerClient();
        const { data: schemeRow, error } = await supabase
          .from("schemes")
          .upsert(
            {
              lsp_id: params.lspId,
              code: params.code,
              name: params.name,
              manifest: params.manifest,
            },
            { onConflict: "lsp_id,code" },
          )
          .select("id")
          .single();

        if (error || !schemeRow) {
          return { ok: false, error: error?.message ?? "Failed to save scheme" } as const;
        }

        const schemeId = schemeRow.id as string;
        const { data: existingForms } = await supabase
          .from("scheme_form_manifests")
          .select("*")
          .eq("scheme_id", schemeId);
        const existingByKey = new Map(
          ((existingForms ?? []) as Array<Record<string, unknown>>).map((row) => [
            String(row.form_key ?? "").toLowerCase(),
            mapSupabaseFormRow(row),
          ]),
        );

        await supabase.from("scheme_form_manifests").delete().eq("scheme_id", schemeId);
        if (params.forms.length > 0) {
          const { error: insertErr } = await supabase.from("scheme_form_manifests").insert(
            params.forms.map((f) => {
              const prev = existingByKey.get(f.formKey.toLowerCase());
              return {
                lsp_id: params.lspId,
                scheme_id: schemeId,
                form_key: f.formKey,
                form_name: f.formName?.trim() ?? prev?.formName ?? "",
                file_patterns: f.filePatterns,
                required: f.required,
                instrument_role: f.instrumentRole,
                sort_order: f.sortOrder,
                template_storage_path:
                  f.templateStoragePath !== undefined
                    ? f.templateStoragePath
                    : (prev?.templateStoragePath ?? null),
                template_file_name:
                  f.templateFileName !== undefined
                    ? f.templateFileName
                    : (prev?.templateFileName ?? null),
                template_mime_type:
                  f.templateMimeType !== undefined
                    ? f.templateMimeType
                    : (prev?.templateMimeType ?? null),
                template_sha256:
                  f.templateSha256 !== undefined
                    ? f.templateSha256
                    : (prev?.templateSha256 ?? null),
                template_version:
                  f.templateVersion !== undefined
                    ? f.templateVersion
                    : (prev?.templateVersion ?? 0),
                template_uploaded_at:
                  f.templateUploadedAt !== undefined
                    ? f.templateUploadedAt
                    : (prev?.templateUploadedAt ?? null),
                template_uploaded_by:
                  f.templateUploadedBy !== undefined
                    ? f.templateUploadedBy
                    : (prev?.templateUploadedBy ?? null),
              };
            }),
          );
          if (insertErr) {
            return { ok: false, error: insertErr.message } as const;
          }
        }

        return { ok: true, schemeId } as const;
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB error" };
  }
}

export async function attachSchemeFormBlankoTemplate(params: {
  userId: string;
  lspId: string;
  schemeId: string;
  formKey: string;
  formName?: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sha256: string;
}): Promise<{ ok: true; templateVersion: number } | { ok: false; error: string }> {
  try {
    return await runRepositoryDualPath({
      userId: params.userId,
      label: "SchemesRepository.attachSchemeFormBlankoTemplate",
      drizzle: async (tx) => {
        const [existing] = await tx
          .select()
          .from(schemeFormManifests)
          .where(
            and(
              eq(schemeFormManifests.schemeId, params.schemeId),
              eq(schemeFormManifests.lspId, params.lspId),
              eq(schemeFormManifests.formKey, params.formKey),
            ),
          )
          .limit(1);

        const nextVersion = (existing?.templateVersion ?? 0) + 1;
        const now = new Date();

        if (existing) {
          await tx
            .update(schemeFormManifests)
            .set({
              ...(params.formName ? { formName: params.formName } : {}),
              templateStoragePath: params.storagePath,
              templateFileName: params.fileName,
              templateMimeType: params.mimeType,
              templateSha256: params.sha256,
              templateVersion: nextVersion,
              templateUploadedAt: now,
              templateUploadedBy: params.userId,
            })
            .where(eq(schemeFormManifests.id, existing.id));
        } else {
          await tx.insert(schemeFormManifests).values({
            lspId: params.lspId,
            schemeId: params.schemeId,
            formKey: params.formKey,
            formName: params.formName?.trim() || params.formKey.toUpperCase(),
            filePatterns: [params.formKey.toLowerCase()],
            required: false,
            instrumentRole: "custom",
            sortOrder: 99,
            templateStoragePath: params.storagePath,
            templateFileName: params.fileName,
            templateMimeType: params.mimeType,
            templateSha256: params.sha256,
            templateVersion: nextVersion,
            templateUploadedAt: now,
            templateUploadedBy: params.userId,
          });
        }

        return { ok: true, templateVersion: nextVersion } as const;
      },
      supabase: async () => {
        const supabase = await getSupabaseServerClient();
        const { data: existing, error: fetchErr } = await supabase
          .from("scheme_form_manifests")
          .select("id, template_version")
          .eq("scheme_id", params.schemeId)
          .eq("lsp_id", params.lspId)
          .eq("form_key", params.formKey)
          .maybeSingle();

        if (fetchErr) {
          return { ok: false, error: fetchErr.message } as const;
        }

        const nextVersion = Number(existing?.template_version ?? 0) + 1;
        const nowIso = new Date().toISOString();

        if (existing?.id) {
          const { error: updErr } = await supabase
            .from("scheme_form_manifests")
            .update({
              ...(params.formName ? { form_name: params.formName } : {}),
              template_storage_path: params.storagePath,
              template_file_name: params.fileName,
              template_mime_type: params.mimeType,
              template_sha256: params.sha256,
              template_version: nextVersion,
              template_uploaded_at: nowIso,
              template_uploaded_by: params.userId,
            })
            .eq("id", existing.id as string);

          if (updErr) return { ok: false, error: updErr.message } as const;
        } else {
          const { error: insErr } = await supabase.from("scheme_form_manifests").insert({
            lsp_id: params.lspId,
            scheme_id: params.schemeId,
            form_key: params.formKey,
            form_name: params.formName?.trim() || params.formKey.toUpperCase(),
            file_patterns: [params.formKey.toLowerCase()],
            required: false,
            instrument_role: "custom",
            sort_order: 99,
            template_storage_path: params.storagePath,
            template_file_name: params.fileName,
            template_mime_type: params.mimeType,
            template_sha256: params.sha256,
            template_version: nextVersion,
            template_uploaded_at: nowIso,
            template_uploaded_by: params.userId,
          });

          if (insErr) return { ok: false, error: insErr.message } as const;
        }

        return { ok: true, templateVersion: nextVersion } as const;
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB error" };
  }
}

export async function deleteSchemeFormEntry(params: {
  userId: string;
  lspId: string;
  schemeId: string;
  formKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await runRepositoryDualPath({
      userId: params.userId,
      label: "SchemesRepository.deleteSchemeFormEntry",
      drizzle: async (tx) => {
        await tx
          .delete(schemeFormManifests)
          .where(
            and(
              eq(schemeFormManifests.schemeId, params.schemeId),
              eq(schemeFormManifests.lspId, params.lspId),
              eq(schemeFormManifests.formKey, params.formKey),
            ),
          );
        return { ok: true } as const;
      },
      supabase: async () => {
        const supabase = await getSupabaseServerClient();
        const { error } = await supabase
          .from("scheme_form_manifests")
          .delete()
          .eq("scheme_id", params.schemeId)
          .eq("lsp_id", params.lspId)
          .eq("form_key", params.formKey);
        if (error) return { ok: false, error: error.message } as const;
        return { ok: true } as const;
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB error" };
  }
}
