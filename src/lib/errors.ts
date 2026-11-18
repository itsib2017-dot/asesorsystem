import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "OCR_LOW_CONFIDENCE"
  | "NO_ACTIVE_SIGNATURE"
  | "EXPORT_FORMAT_NOT_ALLOWED"
  | "MANIFEST_FILE_MISSING"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

const STATUS_MAP: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  OCR_LOW_CONFIDENCE: 422,
  NO_ACTIVE_SIGNATURE: 422,
  EXPORT_FORMAT_NOT_ALLOWED: 422,
  MANIFEST_FILE_MISSING: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      data,
      meta: {
        request_id: randomUUID(),
        ...meta,
      },
    },
    {
      status,
      headers: { "X-Api-Version": "v1" },
    },
  );
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Array<{ field?: string; issue: string }>,
  requestId?: string,
) {
  const status = STATUS_MAP[code] ?? 500;
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? [],
        request_id: requestId ?? randomUUID(),
      },
    },
    {
      status,
      headers: { "X-Api-Version": "v1" },
    },
  );
}
