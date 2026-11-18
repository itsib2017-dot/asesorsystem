"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/get-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/encryption";
import { validateSafeExternalUrl } from "@/lib/security/ssrf";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import {
  getLatestProviderConfigForAssessor,
  getProviderConfigByProvider,
  upsertProviderConfig,
  type LlmProviderType,
} from "@/repositories/provider.repository";

const providerSettingsSchema = z.object({
  provider: z.enum(["anthropic", "openai-compatible", "gemini"]),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  gatewayToken: z.string().optional(),
  model: z.string().min(1, { message: "Nama model wajib diisi." }),
  temperature: z.coerce.number().min(0).max(2).default(0.9),
  maxTokens: z.coerce.number().int().min(1).max(200000).default(51200),
  thinkingBudget: z.coerce.number().int().min(0).default(0),
  googleDriveApiKey: z.string().optional(),
});

export interface MaskedProviderConfigData {
  provider: LlmProviderType;
  hasApiKey: boolean;
  apiKeyMask: string;
  baseUrl: string;
  hasGatewayToken: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  thinkingBudget: number;
  hasGoogleDriveApiKey: boolean;
}

/**
 * Loads masked provider metadata only (ADR-0003: never returns plaintext secrets to browser after entry).
 */
export async function getProviderConfigAction(): Promise<MaskedProviderConfigData | null> {
  const user = await getUser();
  if (!user) return null;

  const row = await getLatestProviderConfigForAssessor(user.id);
  if (!row) return null;

  let apiKeyMask = "••••••••";
  try {
    const plain = decryptSecret(row.encryptedApiKey);
    apiKeyMask = maskSecret(plain);
  } catch {
    apiKeyMask = "••••••••";
  }

  return {
    provider: row.provider,
    hasApiKey: Boolean(row.encryptedApiKey),
    apiKeyMask,
    baseUrl: row.baseUrl ?? "",
    hasGatewayToken: Boolean(row.encryptedGatewayToken),
    model: row.model,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    thinkingBudget: row.thinkingBudget,
    hasGoogleDriveApiKey: Boolean(row.googleDriveApiKeyEncrypted),
  };
}

export async function saveProviderSettingsAction(formData: FormData) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const raw = {
    provider: formData.get("provider"),
    apiKey: (formData.get("apiKey") as string | null) ?? undefined,
    baseUrl: (formData.get("baseUrl") as string | null) || undefined,
    gatewayToken: (formData.get("gatewayToken") as string | null) || undefined,
    model: formData.get("model"),
    temperature: formData.get("temperature"),
    maxTokens: formData.get("maxTokens"),
    thinkingBudget: formData.get("thinkingBudget"),
    googleDriveApiKey: (formData.get("googleDriveApiKey") as string | null) || undefined,
  };

  const parsed = providerSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { data } = parsed;

  if (data.baseUrl) {
    const urlCheck = validateSafeExternalUrl(data.baseUrl);
    if (!urlCheck.safe) {
      return { success: false, error: `Base URL ditolak: ${urlCheck.reason}` };
    }
  }

  const existing = await getProviderConfigByProvider(user.id, data.provider);

  const rawApiKey = data.apiKey?.trim();
  let encryptedApiKey: string;
  if (rawApiKey) {
    encryptedApiKey = encryptSecret(rawApiKey);
  } else if (existing?.encryptedApiKey) {
    encryptedApiKey = existing.encryptedApiKey;
  } else {
    return { success: false, error: "API Key wajib diisi untuk konfigurasi pertama." };
  }

  const encryptedGatewayToken = data.gatewayToken?.trim()
    ? encryptSecret(data.gatewayToken.trim())
    : existing?.encryptedGatewayToken ?? null;

  const encryptedDriveKey = data.googleDriveApiKey?.trim()
    ? encryptSecret(data.googleDriveApiKey.trim())
    : existing?.googleDriveApiKeyEncrypted ?? null;

  const res = await upsertProviderConfig({
    assessorId: user.id,
    provider: data.provider,
    baseUrl: data.baseUrl?.trim() || null,
    model: data.model.trim(),
    encryptedApiKey,
    encryptedGatewayToken,
    temperature: data.temperature,
    maxTokens: data.maxTokens,
    thinkingBudget: data.thinkingBudget,
    googleDriveApiKeyEncrypted: encryptedDriveKey,
  });

  if (!res.ok) {
    return { success: false, error: `Gagal menyimpan konfigurasi: ${res.error}` };
  }

  const supabase = await getSupabaseServerClient();
  await writeAuditLog(
    {
      actor_id: user.id,
      action: "provider_settings.update",
      resource: "assessor_llm_config",
      after_summary: {
        provider: data.provider,
        model: data.model,
        hasBaseUrl: Boolean(data.baseUrl),
      },
    },
    supabase,
  );

  revalidatePath("/settings/provider");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Konfigurasi provider berhasil disimpan dan dienkripsi AES-256-GCM.",
  };
}

export async function testConnectionAction(formData: FormData) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Unauthorized: Silakan masuk terlebih dahulu." };
  }

  const provider = String(formData.get("provider") ?? "") as LlmProviderType;
  const submittedKey = String(formData.get("apiKey") ?? "").trim();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();

  if (baseUrl) {
    const check = validateSafeExternalUrl(baseUrl);
    if (!check.safe) {
      return { success: false, error: `Base URL ditolak (SSRF): ${check.reason}` };
    }
  }

  // Use newly entered key or decrypt stored key in server memory (never echoed back)
  let apiKey = submittedKey;
  if (!apiKey) {
    const saved = await getProviderConfigByProvider(user.id, provider);
    if (saved?.encryptedApiKey) {
      try {
        apiKey = decryptSecret(saved.encryptedApiKey);
      } catch {
        apiKey = "";
      }
    }
  }

  if (!apiKey) {
    return { success: false, error: "API Key diperlukan untuk uji koneksi." };
  }

  try {
    if (provider === "openai-compatible") {
      const targetUrl = baseUrl
        ? `${baseUrl.replace(/\/+$/, "")}/models`
        : "https://api.openai.com/v1/models";
      const res = await fetch(targetUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return { success: false, error: `Gagal (HTTP ${res.status}): ${res.statusText}` };
      }
      return { success: true, message: "Terhubung — gateway OpenAI-compatible merespons." };
    }

    if (provider === "anthropic") {
      const targetUrl = baseUrl
        ? `${baseUrl.replace(/\/+$/, "")}/v1/models`
        : "https://api.anthropic.com/v1/models";
      const res = await fetch(targetUrl, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, error: "Gagal — API Key Anthropic ditolak (401/403)." };
      }
      return { success: true, message: "Terhubung — endpoint Anthropic dapat diakses." };
    }

    if (provider === "gemini") {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return { success: false, error: `Gagal (HTTP ${res.status}): Kunci Gemini tidak valid.` };
      }
      return { success: true, message: `Terhubung — Gemini API valid (${model || "default"}).` };
    }

    return { success: false, error: "Provider tidak dikenali." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Gagal terhubung: ${msg}` };
  }
}
