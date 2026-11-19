import { beforeEach, describe, expect, it, vi } from "vitest";
import { getConfigWithSource } from "../get-config";

const { mockSupabaseFrom, mockHasDatabaseUrl } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockHasDatabaseUrl: vi.fn(() => false),
}));

vi.mock("@/db", () => ({
  hasDatabaseUrl: mockHasDatabaseUrl,
  getDb: vi.fn(),
  runRepositoryDualPath: async (opts: {
    drizzle: (db: unknown) => Promise<unknown>;
    supabase: () => Promise<unknown>;
  }) => (mockHasDatabaseUrl() ? opts.drizzle(vi.fn()) : opts.supabase()),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    from: mockSupabaseFrom,
  })),
}));

function buildSelectChain(rows: unknown[]) {
  const eqChain = {
    eq: vi.fn().mockImplementation(() => eqChain),
    then: (resolve: (val: unknown) => void) => resolve({ data: rows, error: null }),
  };
  return {
    select: vi.fn(() => eqChain),
  };
}

describe("Hierarchical app_config resolution (Cacat 4 / D21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasDatabaseUrl.mockReturnValue(false);
  });

  it("falls back to global app_config row when lspId is passed and tenant has no override", async () => {
    mockSupabaseFrom.mockReturnValue(
      buildSelectChain([
        {
          scope: "global",
          lsp_id: null,
          scheme_id: null,
          value: { exact: 0.85, near: 0.65, partial: 0.45, unconfirmed: true },
        },
      ]),
    );

    const res = await getConfigWithSource("similarity.flag_thresholds", {
      lspId: "lsp-tenant-1",
      schemeId: "scheme-ak3u",
    });

    expect(res.source).toBe("global");
    expect(res.sourceLabel).toBe("Konfigurasi Global (app_config)");
    expect(res.value).toEqual({
      exact: 0.85,
      near: 0.65,
      partial: 0.45,
      unconfirmed: true,
    });
  });

  it("prioritizes scheme > lsp > global when multiple scopes exist", async () => {
    mockSupabaseFrom.mockReturnValue(
      buildSelectChain([
        {
          scope: "global",
          lsp_id: null,
          scheme_id: null,
          value: { exact: 0.85, near: 0.65, partial: 0.45, unconfirmed: true },
        },
        {
          scope: "lsp",
          lsp_id: "lsp-1",
          scheme_id: null,
          value: { exact: 0.88, near: 0.68, partial: 0.48, unconfirmed: false },
        },
        {
          scope: "scheme",
          lsp_id: "lsp-1",
          scheme_id: "scheme-1",
          value: { exact: 0.92, near: 0.72, partial: 0.52, unconfirmed: false },
        },
      ]),
    );

    const schemeHit = await getConfigWithSource("similarity.flag_thresholds", {
      lspId: "lsp-1",
      schemeId: "scheme-1",
    });
    expect(schemeHit.source).toBe("scheme");
    expect(schemeHit.sourceLabel).toBe("Konfigurasi Skema (app_config)");
    expect(schemeHit.value?.exact).toBe(0.92);

    const lspHit = await getConfigWithSource("similarity.flag_thresholds", {
      lspId: "lsp-1",
      schemeId: "scheme-other",
    });
    expect(lspHit.source).toBe("lsp");
    expect(lspHit.sourceLabel).toBe("Konfigurasi Tenant (app_config)");
    expect(lspHit.value?.exact).toBe(0.88);
  });

  it("returns default source when no app_config rows match", async () => {
    mockSupabaseFrom.mockReturnValue(buildSelectChain([]));

    const res = await getConfigWithSource("similarity.flag_thresholds", {
      lspId: "lsp-1",
    });
    expect(res.source).toBe("default");
    expect(res.sourceLabel).toBe("Default Aplikasi");
    expect(res.value).toBeNull();
  });
});
