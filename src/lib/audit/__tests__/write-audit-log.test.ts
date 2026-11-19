import { describe, it, expect, vi } from "vitest";
import { resolveAuditResourceHref } from "../job-audit";
import { writeAuditLog } from "../write-audit-log";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("writeAuditLog", () => {
  it("successfully inserts an audit log entry with generated correlation_id", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    const mockClient = { from: mockFrom } as unknown as SupabaseClient;

    const correlationId = await writeAuditLog(
      {
        action: "login",
        resource: "session",
        actor_id: "user-123",
      },
      mockClient,
    );

    expect(mockFrom).toHaveBeenCalledWith("audit_log");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login",
        resource: "session",
        actor_id: "user-123",
        correlation_id: correlationId,
      }),
    );
    expect(correlationId).toBeDefined();
  });

  it("resolves lsp_id automatically via lsp_memberships when omitted", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { lsp_id: "lsp-99" } });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn((table: string) =>
      table === "lsp_memberships" ? { select: mockSelect } : { insert: mockInsert },
    );
    const mockClient = { from: mockFrom } as unknown as SupabaseClient;

    await writeAuditLog(
      {
        action: "provider_settings.update",
        resource: "assessor_llm_config",
        actor_id: "user-99",
      },
      mockClient,
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lsp_id: "lsp-99",
        actor_id: "user-99",
        action: "provider_settings.update",
      }),
    );
  });

  it("does not throw if insert returns a database error", async () => {
    const mockInsert = vi.fn().mockResolvedValue({
      error: { message: "database offline" },
    });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    const mockClient = { from: mockFrom } as unknown as SupabaseClient;

    await expect(
      writeAuditLog(
        {
          action: "delete",
          resource: "batch",
        },
        mockClient,
      ),
    ).resolves.not.toThrow();
  });
});

describe("resolveAuditResourceHref", () => {
  it("links batches and jobs with valid UUIDs to their detail/ingest views", () => {
    const batchId = "f98e5671-fbcb-42cb-a724-9f69d24f780b";
    const jobId = "b629abf7-84a2-4ece-b755-0ffe24ef841b";

    expect(
      resolveAuditResourceHref({
        resource: "batches",
        resourceId: batchId,
        afterSummary: null,
      }),
    ).toBe(`/batches/${batchId}`);

    expect(
      resolveAuditResourceHref({
        resource: "jobs",
        resourceId: jobId,
        afterSummary: { batchId, type: "drive_scan", status: "done" },
      }),
    ).toBe(`/batches/${batchId}/ingest/${jobId}`);
  });

  it("returns null for jobs missing a valid batchId or invalid UUIDs", () => {
    expect(
      resolveAuditResourceHref({
        resource: "jobs",
        resourceId: "b629abf7-84a2-4ece-b755-0ffe24ef841b",
        afterSummary: { type: "ocr_ktp" },
      }),
    ).toBeNull();

    expect(
      resolveAuditResourceHref({
        resource: "jobs",
        resourceId: "not-a-uuid",
        afterSummary: { batchId: "f98e5671-fbcb-42cb-a724-9f69d24f780b" },
      }),
    ).toBeNull();
  });
});
