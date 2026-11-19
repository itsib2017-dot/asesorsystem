import { eq, asc } from "drizzle-orm";
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
  docColumns?: string[];
  branding?: SchemeBrandingConfig;
  formSuffixMapping: {
    soal: string;
    kunci: string;
    jawaban: string;
  };
}

export interface SchemeRecord {
  id: string;
  lspId: string;
  code: string;
  name: string;
  manifest: SchemeManifestConfig;
  version: number;
  forms: Array<{
    id: string;
    formKey: string;
    filePatterns: string[];
    required: boolean;
    instrumentRole: string;
    sortOrder: number;
  }>;
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
          forms: forms.map((f) => ({
            id: f.id,
            formKey: f.formKey,
            filePatterns: f.filePatterns,
            required: f.required,
            instrumentRole: f.instrumentRole,
            sortOrder: f.sortOrder,
          })),
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
          ? s.scheme_form_manifests.map((f: Record<string, unknown>) => ({
              id: String(f.id),
              formKey: String(f.form_key),
              filePatterns: Array.isArray(f.file_patterns) ? (f.file_patterns as string[]) : [],
              required: Boolean(f.required),
              instrumentRole: String(f.instrument_role),
              sortOrder: Number(f.sort_order ?? 0),
            }))
          : [],
      }));
    },
  });
}

export async function createOrUpdateScheme(params: {
  userId: string;
  lspId: string;
  code: string;
  name: string;
  manifest: SchemeManifestConfig;
  forms: Array<{
    formKey: string;
    filePatterns: string[];
    required: boolean;
    instrumentRole: string;
    sortOrder: number;
  }>;
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

        await tx.delete(schemeFormManifests).where(eq(schemeFormManifests.schemeId, id));
        if (params.forms.length > 0) {
          await tx.insert(schemeFormManifests).values(
            params.forms.map((f) => ({
              lspId: params.lspId,
              schemeId: id,
              formKey: f.formKey,
              filePatterns: f.filePatterns,
              required: f.required,
              instrumentRole: f.instrumentRole,
              sortOrder: f.sortOrder,
            })),
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
        await supabase.from("scheme_form_manifests").delete().eq("scheme_id", schemeId);
        if (params.forms.length > 0) {
          await supabase.from("scheme_form_manifests").insert(
            params.forms.map((f) => ({
              lsp_id: params.lspId,
              scheme_id: schemeId,
              form_key: f.formKey,
              file_patterns: f.filePatterns,
              required: f.required,
              instrument_role: f.instrumentRole,
              sort_order: f.sortOrder,
            })),
          );
        }

        return { ok: true, schemeId } as const;
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB error" };
  }
}
