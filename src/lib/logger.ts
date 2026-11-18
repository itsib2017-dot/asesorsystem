import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

const REDACT_KEYS = new Set([
  "password",
  "apiKey",
  "api_key",
  "encrypted_api_key",
  "gatewayToken",
  "gateway_token",
  "token",
  "secret",
  "nik",
  "ktp",
  "keyPassword",
  "06bPassword",
]);

function redactString(input: string): string {
  // Mask 16-digit Indonesian NIK patterns
  let out = input.replace(/\b\d{16}\b/g, "[REDACTED_NIK]");
  // Mask bearer / sk- style keys
  out = out.replace(/(sk-[a-zA-Z0-9_-]{8,}|AIza[0-9A-Za-z_-]{16,})/g, "[REDACTED_KEY]");
  return out;
}

export function redactObject(obj: unknown): unknown {
  if (typeof obj === "string") return redactString(obj);
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (obj && typeof obj === "object") {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (REDACT_KEYS.has(k)) {
        clean[k] = "[REDACTED]";
      } else {
        clean[k] = redactObject(v);
      }
    }
    return clean;
  }
  return obj;
}

export interface LogContext {
  correlation_id?: string;
  tenant_id?: string;
  user_id?: string;
  action: string;
  resource?: string;
  outcome: "success" | "failure" | "denied" | "started";
  duration_ms?: number;
  meta?: Record<string, unknown>;
}

export function logEvent(level: LogLevel, ctx: LogContext): string {
  const correlationId = ctx.correlation_id || randomUUID();
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "asesor-kompetensi",
    correlation_id: correlationId,
    tenant_id: ctx.tenant_id ?? null,
    user_id: ctx.user_id ?? null,
    action: ctx.action,
    resource: ctx.resource ?? null,
    outcome: ctx.outcome,
    duration_ms: ctx.duration_ms ?? null,
    meta: ctx.meta ? redactObject(ctx.meta) : undefined,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
  return correlationId;
}
