import { and, desc, eq } from "drizzle-orm";
import { runRepositoryDualPath } from "@/db";
import { assessorLlmConfig } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type LlmProviderType = "anthropic" | "openai-compatible" | "gemini";

export interface StoredProviderConfigRow {
  provider: LlmProviderType;
  baseUrl: string | null;
  model: string;
  encryptedApiKey: string;
  encryptedGatewayToken: string | null;
  temperature: number;
  maxTokens: number;
  thinkingBudget: number;
  googleDriveApiKeyEncrypted: string | null;
  updatedAt: string;
}

function mapDrizzleProviderRow(
  row: typeof assessorLlmConfig.$inferSelect,
): StoredProviderConfigRow {
  return {
    provider: row.provider as LlmProviderType,
    baseUrl: row.baseUrl,
    model: row.model,
    encryptedApiKey: row.encryptedApiKey,
    encryptedGatewayToken: row.encryptedGatewayToken,
    temperature: Number(row.temperature),
    maxTokens: row.maxTokens,
    thinkingBudget: row.thinkingBudget,
    googleDriveApiKeyEncrypted: row.googleDriveApiKeyEncrypted,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSupabaseProviderRow(
  data: Record<string, unknown>,
): StoredProviderConfigRow {
  return {
    provider: data.provider as LlmProviderType,
    baseUrl: (data.base_url as string | null) ?? null,
    model: data.model as string,
    encryptedApiKey: data.encrypted_api_key as string,
    encryptedGatewayToken: (data.encrypted_gateway_token as string | null) ?? null,
    temperature: Number(data.temperature),
    maxTokens: Number(data.max_tokens),
    thinkingBudget: Number(data.thinking_budget),
    googleDriveApiKeyEncrypted: (data.google_drive_api_key_encrypted as string | null) ?? null,
    updatedAt: data.updated_at as string,
  };
}

export async function getLatestProviderConfigForAssessor(
  assessorId: string,
): Promise<StoredProviderConfigRow | null> {
  return runRepositoryDualPath({
    userId: assessorId,
    label: "ProviderRepository.getLatestConfig",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(assessorLlmConfig)
        .where(eq(assessorLlmConfig.assessorId, assessorId))
        .orderBy(desc(assessorLlmConfig.updatedAt))
        .limit(1);
      return rows[0] ? mapDrizzleProviderRow(rows[0]) : null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("assessor_llm_config")
        .select("*")
        .eq("assessor_id", assessorId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return mapSupabaseProviderRow(data as Record<string, unknown>);
    },
  });
}

export async function getProviderConfigByProvider(
  assessorId: string,
  provider: LlmProviderType,
): Promise<StoredProviderConfigRow | null> {
  return runRepositoryDualPath({
    userId: assessorId,
    label: "ProviderRepository.getConfigByProvider",
    drizzle: async (tx) => {
      const rows = await tx
        .select()
        .from(assessorLlmConfig)
        .where(
          and(
            eq(assessorLlmConfig.assessorId, assessorId),
            eq(assessorLlmConfig.provider, provider),
          ),
        )
        .limit(1);
      return rows[0] ? mapDrizzleProviderRow(rows[0]) : null;
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("assessor_llm_config")
        .select("*")
        .eq("assessor_id", assessorId)
        .eq("provider", provider)
        .maybeSingle();

      if (error || !data) return null;
      return mapSupabaseProviderRow(data as Record<string, unknown>);
    },
  });
}

export async function upsertProviderConfig(params: {
  assessorId: string;
  provider: LlmProviderType;
  baseUrl: string | null;
  model: string;
  encryptedApiKey: string;
  encryptedGatewayToken: string | null;
  temperature: number;
  maxTokens: number;
  thinkingBudget: number;
  googleDriveApiKeyEncrypted: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await runRepositoryDualPath({
      userId: params.assessorId,
      label: "ProviderRepository.upsertConfig",
      drizzle: async (tx) => {
        await tx
          .insert(assessorLlmConfig)
          .values({
            assessorId: params.assessorId,
            provider: params.provider,
            baseUrl: params.baseUrl,
            model: params.model,
            encryptedApiKey: params.encryptedApiKey,
            encryptedGatewayToken: params.encryptedGatewayToken,
            temperature: params.temperature.toFixed(2),
            maxTokens: params.maxTokens,
            thinkingBudget: params.thinkingBudget,
            googleDriveApiKeyEncrypted: params.googleDriveApiKeyEncrypted,
          })
          .onConflictDoUpdate({
            target: [assessorLlmConfig.assessorId, assessorLlmConfig.provider],
            set: {
              baseUrl: params.baseUrl,
              model: params.model,
              encryptedApiKey: params.encryptedApiKey,
              encryptedGatewayToken: params.encryptedGatewayToken,
              temperature: params.temperature.toFixed(2),
              maxTokens: params.maxTokens,
              thinkingBudget: params.thinkingBudget,
              googleDriveApiKeyEncrypted: params.googleDriveApiKeyEncrypted,
              updatedAt: new Date(),
            },
          });
        return { ok: true } as const;
      },
      supabase: async () => {
        const supabase = await getSupabaseServerClient();
        const { error } = await supabase.from("assessor_llm_config").upsert(
          {
            assessor_id: params.assessorId,
            provider: params.provider,
            base_url: params.baseUrl,
            model: params.model,
            encrypted_api_key: params.encryptedApiKey,
            encrypted_gateway_token: params.encryptedGatewayToken,
            temperature: params.temperature,
            max_tokens: params.maxTokens,
            thinking_budget: params.thinkingBudget,
            google_drive_api_key_encrypted: params.googleDriveApiKeyEncrypted,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "assessor_id,provider" },
        );

        if (error) {
          return { ok: false, error: error.message } as const;
        }
        return { ok: true } as const;
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB error" };
  }
}
