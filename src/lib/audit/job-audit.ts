import { isUuid } from "@/db";

export interface AuditLinkableRow {
  resource: string;
  resourceId: string | null;
  afterSummary: Record<string, unknown> | null;
}

/**
 * Resolves a safe internal navigation path for an audit log row when the target
 * resource has a dedicated detail view (`batches` or `jobs` -> ingest job page).
 */
export function resolveAuditResourceHref(row: AuditLinkableRow): string | null {
  if (!row.resourceId || !isUuid(row.resourceId)) {
    return null;
  }

  if (row.resource === "batches") {
    return `/batches/${row.resourceId}`;
  }

  if (row.resource === "jobs") {
    const rawBatchId = row.afterSummary?.batchId;
    if (typeof rawBatchId === "string" && isUuid(rawBatchId)) {
      return `/batches/${rawBatchId}/ingest/${row.resourceId}`;
    }
  }

  return null;
}
