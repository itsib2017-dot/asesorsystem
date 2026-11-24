export interface ApiErrorDetail {
  field?: string;
  issue?: string;
}

export interface ApiEnvelope<TData = unknown> {
  ok?: boolean;
  data?: TData;
  error?: {
    code?: string;
    message?: string;
    details?: ApiErrorDetail[];
    request_id?: string;
  };
}

export type ReadApiResponseResult<TData = unknown> =
  | {
      ok: true;
      status: number;
      data: TData | undefined;
      rawBody: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
      code?: string;
      requestId?: string;
      rawBody: string;
    };

const MAX_NON_JSON_ERROR_CHARS = 2000;

function sanitizeNonJsonBody(rawBody: string): string {
  const withoutScriptsOrStyles = rawBody
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutTags = withoutScriptsOrStyles.replace(/<[^>]+>/g, " ");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_NON_JSON_ERROR_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_NON_JSON_ERROR_CHARS)}…`;
}

function buildJsonErrorMessage(parsed: ApiEnvelope<unknown>, fallback: string): string {
  const baseMessage = parsed.error?.message?.trim() || fallback;
  const detailText = Array.isArray(parsed.error?.details)
    ? parsed.error.details
        .map((d) => d?.issue?.trim())
        .filter((issue): issue is string => Boolean(issue))
        .join("; ")
    : "";
  const requestId = parsed.error?.request_id?.trim();

  const parts = [baseMessage];
  if (detailText) parts.push(detailText);
  if (requestId) parts.push(`(ID: ${requestId})`);
  return parts.join(" ");
}

/**
 * Safely parses JSON API responses and preserves full platform plain-text/HTML
 * error bodies (e.g. Vercel 504 FUNCTION_INVOCATION_TIMEOUT or 502 Bad Gateway)
 * without throwing truncated V8 `SyntaxError: Unexpected token ...` errors.
 */
export async function readApiResponse<TData = unknown>(
  res: Response,
  fallbackErrorMessage = "Permintaan ke server gagal.",
): Promise<ReadApiResponseResult<TData>> {
  let rawBody = "";
  let parsed: ApiEnvelope<TData> | null = null;

  if (typeof res.text === "function") {
    rawBody = await res.text();
    if (rawBody.trim().length > 0) {
      try {
        const candidate: unknown = JSON.parse(rawBody);
        if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
          parsed = candidate as ApiEnvelope<TData>;
        }
      } catch {
        parsed = null;
      }
    }
  } else if (typeof res.json === "function") {
    try {
      const candidate: unknown = await res.json();
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        parsed = candidate as ApiEnvelope<TData>;
      }
      rawBody = JSON.stringify(candidate ?? "");
    } catch {
      parsed = null;
    }
  }

  if (parsed) {
    if (res.ok && parsed.ok !== false) {
      return {
        ok: true,
        status: res.status,
        data: parsed.data,
        rawBody,
      };
    }

    return {
      ok: false,
      status: res.status,
      message: buildJsonErrorMessage(parsed, fallbackErrorMessage),
      code: parsed.error?.code,
      requestId: parsed.error?.request_id,
      rawBody,
    };
  }

  const statusSuffix = res.statusText ? ` ${res.statusText}` : "";
  const cleanedText = sanitizeNonJsonBody(rawBody);
  const message = `Server mengembalikan respons non-JSON (HTTP ${res.status}${statusSuffix}): ${cleanedText || fallbackErrorMessage}`;

  return {
    ok: false,
    status: res.status,
    message,
    rawBody,
  };
}
