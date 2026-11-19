import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");

describe("triage server page render safety", () => {
  it("does not pass inline event handlers from the Server Component", () => {
    // Next.js production build rejects client-component props that are event
    // handlers. This regressed once and produced HTTP 500 on batches with
    // assessees (Vercel log: "Event handlers cannot be passed to Client
    // Component props").
    expect(pageSource).not.toMatch(/onSubmit=/);
    expect(pageSource).not.toMatch(/onClick=/);
  });

  it("delegates assessee row actions to the dedicated Client Component", () => {
    expect(pageSource).toContain("<AssesseeActions");
  });

  it("does not call toLowerCase on possibly-null file fields", () => {
    expect(pageSource).not.toMatch(/f\.docType\.toLowerCase\(/);
    expect(pageSource).not.toMatch(/f\.fileName\.toLowerCase\(/);
    expect(pageSource).not.toMatch(/f\.drivePath\.toLowerCase\(/);
  });
});
