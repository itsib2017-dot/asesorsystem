import { and, eq } from "drizzle-orm";
import { runRepositoryDualPath } from "@/db";
import { appConfig } from "@/db/schema";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ConfigKey,
  ConfigMap,
  ConfigResolutionSource,
  GetConfigOptions,
} from "@/lib/config/types";

interface ConfigRowLike {
  scope?: string | null;
  lspId?: string | null;
  lsp_id?: string | null;
  schemeId?: string | null;
  scheme_id?: string | null;
  value?: unknown;
}

export interface ResolvedConfigRecord<K extends ConfigKey> {
  value: ConfigMap[K];
  source: Exclude<ConfigResolutionSource, "default">;
}

function selectConfigByPrecedence<K extends ConfigKey>(
  rows: ConfigRowLike[],
  options?: GetConfigOptions,
): ResolvedConfigRecord<K> | null {
  if (rows.length === 0) return null;

  if (options?.scope) {
    const exact = rows.find((r) => {
      const rLsp = r.lspId ?? r.lsp_id ?? null;
      const rScheme = r.schemeId ?? r.scheme_id ?? null;
      if (r.scope !== options.scope) return false;
      if (options.lspId && rLsp !== options.lspId) return false;
      if (options.schemeId && rScheme !== options.schemeId) return false;
      return r.value != null;
    });
    if (!exact) return null;
    return {
      value: exact.value as ConfigMap[K],
      source: options.scope,
    };
  }

  if (options?.schemeId) {
    const schemeRow = rows.find((r) => {
      const rLsp = r.lspId ?? r.lsp_id ?? null;
      const rScheme = r.schemeId ?? r.scheme_id ?? null;
      return (
        r.scope === "scheme" &&
        rScheme === options.schemeId &&
        (!options.lspId || !rLsp || rLsp === options.lspId) &&
        r.value != null
      );
    });
    if (schemeRow) {
      return { value: schemeRow.value as ConfigMap[K], source: "scheme" };
    }
  }

  if (options?.lspId) {
    const lspRow = rows.find((r) => {
      const rLsp = r.lspId ?? r.lsp_id ?? null;
      const rScheme = r.schemeId ?? r.scheme_id ?? null;
      return (
        r.scope === "lsp" &&
        rLsp === options.lspId &&
        !rScheme &&
        r.value != null
      );
    });
    if (lspRow) {
      return { value: lspRow.value as ConfigMap[K], source: "lsp" };
    }
  }

  const globalRow = rows.find((r) => {
    const rLsp = r.lspId ?? r.lsp_id ?? null;
    const rScheme = r.schemeId ?? r.scheme_id ?? null;
    return r.scope === "global" && !rLsp && !rScheme && r.value != null;
  });
  if (globalRow) {
    return { value: globalRow.value as ConfigMap[K], source: "global" };
  }

  return null;
}

/**
 * Resolves `app_config` hierarchically: `scheme -> lsp -> global`, unless `options.scope` is explicitly pinned.
 */
export async function findConfigWithSource<K extends ConfigKey>(
  key: K,
  options?: GetConfigOptions,
): Promise<ResolvedConfigRecord<K> | null> {
  return runRepositoryDualPath({
    unscopedPublicRead: true,
    label: "ConfigRepository.findConfigWithSource",
    drizzle: async (db) => {
      const conditions = [eq(appConfig.key, key)];
      if (options?.scope) conditions.push(eq(appConfig.scope, options.scope));

      const rows = await db
        .select({
          scope: appConfig.scope,
          lspId: appConfig.lspId,
          schemeId: appConfig.schemeId,
          value: appConfig.value,
        })
        .from(appConfig)
        .where(and(...conditions));

      return selectConfigByPrecedence<K>(rows, options);
    },
    supabase: async () => {
      const supabase = await getSupabaseServerClient();
      let query = supabase
        .from("app_config")
        .select("scope, lsp_id, scheme_id, value")
        .eq("key", key);
      if (options?.scope) query = query.eq("scope", options.scope);

      const { data, error } = await query;
      if (error || !data) return null;
      return selectConfigByPrecedence<K>(data as ConfigRowLike[], options);
    },
  });
}

export async function findConfigValue<K extends ConfigKey>(
  key: K,
  options?: GetConfigOptions,
): Promise<ConfigMap[K] | null> {
  const resolved = await findConfigWithSource(key, options);
  return resolved ? resolved.value : null;
}
