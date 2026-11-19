/**
 * Normalizes camelCase (Drizzle) and snake_case (Supabase REST) record lookups
 * without duplicating fallback chains across forms, rollups, and decision rules.
 */
export function readField<T = unknown>(
  row: Record<string, unknown> | null | undefined,
  camel: string,
  snake: string,
): T | undefined {
  if (!row) return undefined;
  return (row[camel] ?? row[snake]) as T | undefined;
}

export function readStringField(
  row: Record<string, unknown> | null | undefined,
  camel: string,
  snake: string,
): string {
  const val = readField(row, camel, snake);
  return typeof val === "string" ? val.trim() : "";
}

export function readArrayField(
  row: Record<string, unknown> | null | undefined,
  camel: string,
  snake: string,
): Array<Record<string, unknown>> {
  const val = readField(row, camel, snake);
  return Array.isArray(val) ? (val as Array<Record<string, unknown>>) : [];
}
