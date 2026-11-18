import { findConfigValue } from "@/repositories/config.repository";
import type { ConfigKey, ConfigMap, GetConfigOptions } from "./types";

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
