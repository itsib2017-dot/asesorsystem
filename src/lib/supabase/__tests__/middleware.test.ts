import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "../middleware";

describe("updateSession fail-closed behavior", () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    if (origKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
  });

  it("redirects protected routes to /login when Supabase env vars are missing", async () => {
    for (const path of ["/", "/dashboard", "/settings/provider"]) {
      const req = new NextRequest(`https://assessor-zeta.vercel.app${path}`);
      const res = await updateSession(req);
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/login");
    }
  });

  it("allows /login and /api/health to pass without redirect loop", async () => {
    for (const path of ["/login", "/api/health"]) {
      const req = new NextRequest(`https://assessor-zeta.vercel.app${path}`);
      const res = await updateSession(req);
      expect(res.status).toBe(200);
    }
  });
});
