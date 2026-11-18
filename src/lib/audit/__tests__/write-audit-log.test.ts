import { describe, it, expect, vi } from "vitest";
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
