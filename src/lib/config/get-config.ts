import { findConfigValue, findConfigWithSource } from "@/repositories/config.repository";
import {
  CONFIG_SOURCE_LABELS,
  type ConfigKey,
  type ConfigMap,
  type ConfigResolutionSource,
  type GetConfigOptions,
} from "./types";

export interface ConfigWithSourceResult<K extends ConfigKey> {
  value: ConfigMap[K] | null;
  source: ConfigResolutionSource;
  sourceLabel: string;
}

/**
 * Reads typed configuration from public.app_config via repository layer (D21)
 * with explicit resolution precedence (`scheme -> lsp -> global -> default`).
 */
export async function getConfigWithSource<K extends ConfigKey>(
  key: K,
  options?: GetConfigOptions,
): Promise<ConfigWithSourceResult<K>> {
  try {
    const resolved = await findConfigWithSource(key, options);
    if (resolved) {
      return {
        value: resolved.value,
        source: resolved.source,
        sourceLabel: CONFIG_SOURCE_LABELS[resolved.source],
      };
    }
  } catch (err) {
    console.warn(`[getConfig Warning]: Error loading config key ${key}:`, err);
  }

  return {
    value: null,
    source: "default",
    sourceLabel: CONFIG_SOURCE_LABELS.default,
  };
}

/**
 * Reads typed configuration from public.app_config via repository layer (D21).
 * Never hardcodes scheme-specific numbers (such as AK3U unit/question counts) in source.
 */
export async function getConfig<K extends ConfigKey>(
  key: K,
  options?: GetConfigOptions,
): Promise<ConfigMap[K] | null> {
  try {
    const dbValue = await findConfigValue(key, options);
    if (dbValue !== null) {
      return dbValue;
    }
  } catch (err) {
    console.warn(`[getConfig Warning]: Error loading config key ${key}:`, err);
  }

  return null;
}
