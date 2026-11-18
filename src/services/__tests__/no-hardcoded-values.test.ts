import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "source") continue;
      files.push(...walkFiles(full));
    } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("Static Rules Enforcement (D15 & D21)", () => {
  it("has zero hardcoded 'Kompeten Bersyarat' in source code", () => {
    const srcFiles = walkFiles(path.resolve(process.cwd(), "src"));
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toMatch(/Kompeten Bersyarat/i);
    }
  });

  it("has zero hardcoded literal 13 question-bank count in services or config", () => {
    const targetDirs = [
      path.resolve(process.cwd(), "src/services"),
      path.resolve(process.cwd(), "src/lib/config"),
      path.resolve(process.cwd(), "src/ai"),
    ];
    for (const dir of targetDirs) {
      for (const file of walkFiles(dir)) {
        const content = fs.readFileSync(file, "utf8");
        expect(content).not.toMatch(/questionBankCount\s*[:=]\s*13\b/);
        expect(content).not.toMatch(/"question_bank\.count"\s*:\s*13\b/);
      }
    }
  });
});
