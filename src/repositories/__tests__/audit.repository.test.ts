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

import { listAuditLogsForResource, listAuditLogsForUser } from "../audit.repository";

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

  it("executes Drizzle path of listAuditLogsForUser with beforeId, SQL tenant scope, deterministic dual orderBy, and id deduplication", async () => {
    const lspId = "b03afb00-9266-467d-823e-44a7830a4077";
    const actorId = "e27f3fa3-d2d2-494f-b05c-c97f18446e9f";
    const createdAt = new Date("2026-11-19T10:15:00Z");

    const orderByArgs: unknown[][] = [];
    const whereArgs: unknown[] = [];
    const limitArgs: number[] = [];

    const txSelect = vi
      .fn()
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ assessorId: actorId }]),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: actorId, fullName: "Admin Drizzle" }]),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn((cond: unknown) => {
            whereArgs.push(cond);
            return {
              orderBy: vi.fn((...args: unknown[]) => {
                orderByArgs.push(args);
                return {
                  limit: vi.fn(async (n: number) => {
                    limitArgs.push(n);
                    return [
                      {
                        id: 72,
                        lspId,
                        actorId,
                        action: "batch.key_06b.activate.rejected",
                        resource: "batches",
                        resourceId: "f98e5671-fbcb-42cb-a724-9f69d24f780b",
                        afterSummary: { fileName: "FR.IA.06B.docx", substantiveWords: 0 },
                        correlationId: "corr-72",
                        createdAt,
                      },
                      {
                        id: 72,
                        lspId,
                        actorId,
                        action: "batch.key_06b.activate.rejected",
                        resource: "batches",
                        resourceId: "f98e5671-fbcb-42cb-a724-9f69d24f780b",
                        afterSummary: { fileName: "FR.IA.06B.docx", substantiveWords: 0 },
                        correlationId: "corr-72",
                        createdAt,
                      },
                    ];
                  }),
                };
              }),
            };
          }),
        }),
      }));

    mocks.runRepositoryDualPath.mockImplementationOnce(
      async (opts: { drizzle: (tx: { select: typeof txSelect }) => Promise<unknown> }) =>
        opts.drizzle({ select: txSelect }),
    );

    const rows = await listAuditLogsForUser(actorId, lspId, 50, 80);

    expect(whereArgs).toHaveLength(1);
    expect(orderByArgs).toHaveLength(1);
    expect(orderByArgs[0]).toHaveLength(2);
    expect(limitArgs).toEqual([50]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 72,
      actorName: "Admin Drizzle",
      createdAt: createdAt.toISOString(),
    });
  });

  it("scopes and orders listAuditLogsForResource deterministically and deduplicates by id", async () => {
    const lspId = "b03afb00-9266-467d-823e-44a7830a4077";
    const actorId = "e27f3fa3-d2d2-494f-b05c-c97f18446e9f";
    const jobId = "82988849-c68b-4447-9f8b-07ec816784be";

    const orCalls: string[] = [];
    const orderCalls: Array<[string, { ascending: boolean }]> = [];

    const resourceQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn((col: string, opts: { ascending: boolean }) => {
        orderCalls.push([col, opts]);
        return resourceQueryBuilder;
      }),
      limit: vi.fn().mockReturnThis(),
      or: vi.fn((expr: string) => {
        orCalls.push(expr);
        return resourceQueryBuilder;
      }),
      then: (resolve: (value: { data: unknown[] }) => unknown) =>
        Promise.resolve(
          resolve({
            data: [
              {
                id: 99,
                lsp_id: lspId,
                actor_id: actorId,
                action: "job.drive_scan.failed",
                resource: "jobs",
                resource_id: jobId,
                after_summary: { status: "failed" },
                correlation_id: jobId,
                created_at: "2026-11-19T11:00:00Z",
              },
              {
                id: 99,
                lsp_id: lspId,
                actor_id: actorId,
                action: "job.drive_scan.failed",
                resource: "jobs",
                resource_id: jobId,
                after_summary: { status: "failed" },
                correlation_id: jobId,
                created_at: "2026-11-19T11:00:00Z",
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
                data: [{ id: actorId, full_name: "Admin Resource" }],
              }),
            }),
          };
        }
        return resourceQueryBuilder;
      }),
    };
    mocks.getSupabaseServerClient.mockResolvedValue(mockSupabase);

    const rows = await listAuditLogsForResource(actorId, lspId, "jobs", jobId, 30);

    expect(orCalls).toEqual([`lsp_id.eq.${lspId},and(lsp_id.is.null,actor_id.in.(${actorId}))`]);
    expect(orderCalls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 99,
      actorName: "Admin Resource",
      action: "job.drive_scan.failed",
    });
  });
});
