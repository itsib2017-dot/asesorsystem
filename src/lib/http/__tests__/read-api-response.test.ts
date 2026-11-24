import { describe, expect, it } from "vitest";
import { readApiResponse } from "../read-api-response";

describe("readApiResponse", () => {
  it("parses valid JSON success envelopes", async () => {
    const res = new Response(
      JSON.stringify({ ok: true, data: { job_id: "job-123", status: "pending" } }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );

    const out = await readApiResponse<{ job_id: string; status: string }>(res);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.status).toBe(202);
      expect(out.data).toEqual({ job_id: "job-123", status: "pending" });
    }
  });

  it("formats structured JSON error envelopes with details and request_id", async () => {
    const res = new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "UNPROCESSABLE",
          message: "Analisis ditunda — bahan belum lengkap.",
          details: [{ field: "candidate_profile", issue: "Dokumen wajib belum tersedia: CV" }],
          request_id: "req-abc-1",
        },
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );

    const out = await readApiResponse(res);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(422);
      expect(out.code).toBe("UNPROCESSABLE");
      expect(out.requestId).toBe("req-abc-1");
      expect(out.message).toContain("Analisis ditunda — bahan belum lengkap.");
      expect(out.message).toContain("Dokumen wajib belum tersedia: CV");
      expect(out.message).toContain("(ID: req-abc-1)");
    }
  });

  it("preserves full Vercel 504 plain-text error messages without truncated SyntaxError", async () => {
    const vercel504Body =
      "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT\n\nsfo1::vr5f7-1795500154382-39a4f9310c55";
    const res = new Response(vercel504Body, {
      status: 504,
      statusText: "Gateway Timeout",
      headers: { "Content-Type": "text/plain" },
    });

    const out = await readApiResponse(res, "Gagal menjalankan analisis DIT.");
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(504);
      expect(out.message).toContain("HTTP 504 Gateway Timeout");
      expect(out.message).toContain("An error occurred with your deployment");
      expect(out.message).toContain("FUNCTION_INVOCATION_TIMEOUT");
      expect(out.message).toContain("sfo1::vr5f7-1795500154382-39a4f9310c55");
      expect(out.message).not.toContain("Unexpected token");
    }
  });

  it("strips HTML tags cleanly on 502 HTML gateway pages while preserving text", async () => {
    const html502 =
      "<html><head><style>body{color:red}</style><script>alert(1)</script></head><body><h1>502 Bad Gateway</h1><p>Upstream worker unreachable.</p></body></html>";
    const res = new Response(html502, {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "Content-Type": "text/html" },
    });

    const out = await readApiResponse(res);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(502);
      expect(out.message).toContain("502 Bad Gateway");
      expect(out.message).toContain("Upstream worker unreachable.");
      expect(out.message).not.toContain("alert(1)");
      expect(out.message).not.toContain("color:red");
    }
  });

  it("handles empty non-JSON error responses with fallback message", async () => {
    const res = new Response("", { status: 500, statusText: "Internal Server Error" });
    const out = await readApiResponse(res, "Gagal menjalankan analisis DIT.");
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(500);
      expect(out.message).toContain("HTTP 500 Internal Server Error");
      expect(out.message).toContain("Gagal menjalankan analisis DIT.");
    }
  });
});
