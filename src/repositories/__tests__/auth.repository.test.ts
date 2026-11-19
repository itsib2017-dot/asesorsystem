import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  runRepositoryDualPath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));
vi.mock("@/db", () => ({ runRepositoryDualPath: mocks.runRepositoryDualPath }));

import { getLspNameForUser } from "../auth.repository";

describe("AuthRepository.getLspNameForUser", () => {
  it("returns the LSP name for a member", async () => {
    mocks.runRepositoryDualPath.mockImplementation(
      async ({ supabase }: { supabase: () => Promise<unknown> }) => supabase(),
    );
    mocks.getSupabaseServerClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { name: "LSP Keselamatan Kerja" } }),
          }),
        }),
      }),
    });

    await expect(getLspNameForUser("user-1", "lsp-1")).resolves.toBe(
      "LSP Keselamatan Kerja",
    );
  });

  it("returns null when the LSP row is missing", async () => {
    mocks.runRepositoryDualPath.mockImplementation(
      async ({ supabase }: { supabase: () => Promise<unknown> }) => supabase(),
    );
    mocks.getSupabaseServerClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
      }),
    });

    await expect(getLspNameForUser("user-1", "missing")).resolves.toBeNull();
  });
});
