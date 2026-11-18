import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecute, mockTransaction } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("postgres", () => ({
  default: vi.fn(() => ({})),
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn(() => ({
    transaction: mockTransaction,
  })),
}));

import { hasDatabaseUrl, runRepositoryDualPath } from "../index";

describe("runRepositoryDualPath & hasDatabaseUrl (T13)", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: { execute: typeof mockExecute }) => Promise<unknown>) =>
      cb({ execute: mockExecute }),
    );
    mockExecute.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("uses Supabase REST path directly when ENABLE_DIRECT_DB is not true", async () => {
    delete process.env.ENABLE_DIRECT_DB;
    process.env.DATABASE_URL = "postgresql://postgres:secret@localhost:5432/postgres";
    expect(hasDatabaseUrl()).toBe(false);

    const drizzleFn = vi.fn();
    const supabaseFn = vi.fn().mockResolvedValue(["from-rest"]);

    const res = await runRepositoryDualPath({
      userId: "user-1",
      label: "TestRepo",
      drizzle: drizzleFn,
      supabase: supabaseFn,
    });

    expect(res).toEqual(["from-rest"]);
    expect(drizzleFn).not.toHaveBeenCalled();
    expect(supabaseFn).toHaveBeenCalledTimes(1);
  });

  it("executes Drizzle inside RLS transaction when ENABLE_DIRECT_DB is true and skips REST", async () => {
    process.env.ENABLE_DIRECT_DB = "true";
    process.env.DATABASE_URL = "postgresql://postgres:secret@localhost:5432/postgres";
    expect(hasDatabaseUrl()).toBe(true);

    const drizzleFn = vi.fn().mockResolvedValue(["from-drizzle"]);
    const supabaseFn = vi.fn().mockResolvedValue(["from-rest"]);

    const res = await runRepositoryDualPath({
      userId: "user-rls-123",
      label: "TestRepo",
      drizzle: drizzleFn,
      supabase: supabaseFn,
    });

    expect(res).toEqual(["from-drizzle"]);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(supabaseFn).not.toHaveBeenCalled();
  });

  it("logs warning and falls back to Supabase REST when Drizzle throws", async () => {
    process.env.ENABLE_DIRECT_DB = "true";
    process.env.DATABASE_URL = "postgresql://postgres:secret@localhost:5432/postgres";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await runRepositoryDualPath({
      userId: "user-1",
      label: "TestRepo",
      drizzle: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
      supabase: vi.fn().mockResolvedValue(["fallback-rest"]),
    });

    expect(res).toEqual(["fallback-rest"]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[TestRepo Warning] Direct DB fallback to Supabase REST:",
      "connect ECONNREFUSED",
    );
    warnSpy.mockRestore();
  });

  it("rethrows Drizzle errors when fallbackOnError is false", async () => {
    process.env.ENABLE_DIRECT_DB = "true";
    process.env.DATABASE_URL = "postgresql://postgres:secret@localhost:5432/postgres";

    await expect(
      runRepositoryDualPath({
        userId: "user-1",
        label: "StrictRepo",
        drizzle: vi.fn().mockRejectedValue(new Error("unique violation")),
        supabase: vi.fn().mockResolvedValue(["should-not-run"]),
        fallbackOnError: false,
      }),
    ).rejects.toThrow("unique violation");
  });
});
