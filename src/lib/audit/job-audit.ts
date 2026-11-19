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

const PREFERRED_AUDIT_SUMMARY_KEYS = [
  "name",
  "code",
  "type",
  "status",
  "scannedFiles",
  "discoveredAssessees",
  "prunedDuplicateAssessees",
  "renamedAssesseesCount",
  "unextractableFiles",
  "rosterChangeSummary",
  "fileName",
  "source",
  "validationStatus",
  "substantiveWords",
  "rejectionReason",
  "deactivatedFileId",
  "attempts",
  "batchId",
  "provider",
  "model",
  "mimeType",
  "error",
] as const;

/**
 * Formats structured audit summary metadata into a deterministic single-line overview,
 * surfacing 06B key validation metrics and rejection reasons alongside job metadata.
 */
export function formatAuditSummary(summary: Record<string, unknown> | null): string {
  if (!summary) return "-";
  const parts: string[] = [];
  for (const key of PREFERRED_AUDIT_SUMMARY_KEYS) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== "") {
      parts.push(`${key}: ${String(summary[key])}`);
    }
  }
  if (parts.length > 0) return parts.join(" · ");
  const entries = Object.entries(summary).slice(0, 3);
  return entries.length > 0
    ? entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")
    : "-";
}
