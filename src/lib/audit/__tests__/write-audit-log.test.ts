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
