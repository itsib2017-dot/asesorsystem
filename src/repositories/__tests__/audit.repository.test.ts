import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  runRepositoryDualPath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

vi.mock("@/db", () => ({
  isUuid: (v: string | null | undefined) =>
    Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)),
  runRepositoryDualPath: mocks.runRepositoryDualPath,
}));

import { listAuditLogsForUser } from "../audit.repository";

describe("AuditRepository.listAuditLogsForUser (Round 13 Cacat 2 hardening)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runRepositoryDualPath.mockImplementation(
      async (opts: { supabase: () => Promise<unknown> }) => opts.supabase(),
    );
  });

  it("scopes NULL lsp_id rows in SQL, orders deterministically by created_at DESC + id DESC, supports beforeId cursor, and deduplicates by id", async () => {
    const lspId = "b03afb00-9266-467d-823e-44a7830a4077";
    const actorId = "e27f3fa3-d2d2-494f-b05c-c97f18446e9f";

    const eqCalls: Array<[string, unknown]> = [];
    const orCalls: string[] = [];
    const orderCalls: Array<[string, { ascending: boolean }]> = [];
    const ltCalls: Array<[string, unknown]> = [];
    const limitCalls: number[] = [];

    const auditQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn((col: string, opts: { ascending: boolean }) => {
        orderCalls.push([col, opts]);
        return auditQueryBuilder;
      }),
      limit: vi.fn((n: number) => {
        limitCalls.push(n);
        return auditQueryBuilder;
      }),
      or: vi.fn((expr: string) => {
        orCalls.push(expr);
        return auditQueryBuilder;
      }),
      eq: vi.fn((col: string, val: unknown) => {
        eqCalls.push([col, val]);
        return auditQueryBuilder;
      }),
      lt: vi.fn((col: string, val: unknown) => {
        ltCalls.push([col, val]);
        return auditQueryBuilder;
      }),
      then: (resolve: (value: { data: unknown[] }) => unknown) =>
        Promise.resolve(
          resolve({
            data: [
              {
                id: 50,
                lsp_id: lspId,
                actor_id: actorId,
                action: "batch.key_06b.activate.rejected",
                resource: "batches",
                resource_id: "f98e5671-fbcb-42cb-a724-9f69d24f780b",
                after_summary: { fileName: "FR.IA.06B.docx", validationStatus: "encrypted_unreadable" },
                correlation_id: "corr-50",
                created_at: "2026-11-19T10:00:00Z",
              },
              {
                id: 50,
                lsp_id: lspId,
                actor_id: actorId,
                action: "batch.key_06b.activate.rejected",
                resource: "batches",
                resource_id: "f98e5671-fbcb-42cb-a724-9f69d24f780b",
                after_summary: { fileName: "FR.IA.06B.docx", validationStatus: "encrypted_unreadable" },
                correlation_id: "corr-50",
                created_at: "2026-11-19T10:00:00Z",
              },
              {
                id: 49,
                lsp_id: null,
                actor_id: "950f862c-8b9b-4ca0-acc2-c74694f590ba", // Other tenant actor
                action: "signature.upload",
                resource: "signatures",
                resource_id: "sig-other",
                after_summary: null,
                correlation_id: "corr-49",
                created_at: "2026-11-19T09:00:00Z",
              },
            ],
          }),
        ),
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "lsp_memberships") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ assessor_id: actorId }] }),
            }),
          };
        }
        if (table === "assessors") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: actorId, full_name: "Admin Demo" }],
              }),
            }),
          };
        }
        return auditQueryBuilder;
      }),
    };
    mocks.getSupabaseServerClient.mockResolvedValue(mockSupabase);

    const rows = await listAuditLogsForUser(actorId, lspId, 100, 55);

    expect(orCalls).toEqual([`lsp_id.eq.${lspId},and(lsp_id.is.null,actor_id.in.(${actorId}))`]);
    expect(orderCalls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(ltCalls).toEqual([["id", 55]]);
    expect(limitCalls).toEqual([100]);
    expect(eqCalls).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 50,
      actorName: "Admin Demo",
      action: "batch.key_06b.activate.rejected",
    });
  });
});
