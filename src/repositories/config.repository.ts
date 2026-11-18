import { and, eq } from "drizzle-orm";
import { hasDatabaseUrl, getDb } from "@/db";
import { appConfig } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ConfigKey, ConfigMap, GetConfigOptions } from "@/lib/config/types";

export async function findConfigValue<K extends ConfigKey>(
  key: K,
  options?: GetConfigOptions,
): Promise<ConfigMap[K] | null> {
  if (hasDatabaseUrl()) {
    const db = getDb();
    const conditions = [eq(appConfig.key, key)];
    if (options?.scope) conditions.push(eq(appConfig.scope, options.scope));
    if (options?.lspId) conditions.push(eq(appConfig.lspId, options.lspId));
    if (options?.schemeId) conditions.push(eq(appConfig.schemeId, options.schemeId));

    const rows = await db
      .select({ value: appConfig.value })
      .from(appConfig)
      .where(and(...conditions))
      .limit(1);

    const first = rows[0];
    return first ? (first.value as ConfigMap[K]) : null;
  }

  const supabase = await getSupabaseServerClient();
  let query = supabase.from("app_config").select("value").eq("key", key);
  if (options?.scope) query = query.eq("scope", options.scope);
  if (options?.lspId) query = query.eq("lsp_id", options.lspId);
  if (options?.schemeId) query = query.eq("scheme_id", options.schemeId);

  const { data, error } = await query.maybeSingle();
  if (error || !data?.value) return null;
  return data.value as ConfigMap[K];
}
