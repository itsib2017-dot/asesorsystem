import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getUser: vi.fn(),
  resolveAuthorizedLsp: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  writeAuditLog: vi.fn(),
  createOrUpdateScheme: vi.fn(),
  attachSchemeFormBlankoTemplate: vi.fn(),
  getSchemeById: vi.fn(),
  storageUpload: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth/get-session", () => ({
  getUser: mocks.getUser,
}));

vi.mock("@/lib/auth/get-role", () => ({
  resolveAuthorizedLsp: mocks.resolveAuthorizedLsp,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/repositories/schemes.repository", () => ({
  createOrUpdateScheme: mocks.createOrUpdateScheme,
  attachSchemeFormBlankoTemplate: mocks.attachSchemeFormBlankoTemplate,
  getSchemeById: mocks.getSchemeById,
}));

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clearRateLimitBucketsForTest } from "@/lib/security/rate-limit";
import { SchemeRegistrationForm } from "../_components/scheme-registration-form";
import { saveSchemeManifestAction, uploadSchemeFormBlankoAction } from "../actions";

const USER_ID = "e27f3fa3-d2d2-494f-b05c-c97f18446e9f";
const LSP_ID = "b03afb00-9266-467d-823e-44a7830a4077";
const SCHEME_ID = "11111111-1111-4111-8111-111111111111";

async function makeValidDocxFile(name = "FR.AK.02_ICT_PM.docx"): Promise<File> {
  const zip = new JSZip();
  zip.file("word/document.xml", "<w:document><w:body><w:p/></w:body></w:document>");
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return new File([new Uint8Array(buf)], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

describe("saveSchemeManifestAction & uploadSchemeFormBlankoAction (Round 14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitBucketsForTest();
    mocks.getUser.mockResolvedValue({ id: USER_ID });
    mocks.resolveAuthorizedLsp.mockResolvedValue({
      allowed: true,
      lspId: LSP_ID,
      role: "lsp_admin",
    });
    mocks.storageUpload.mockResolvedValue({ error: null });
    mocks.getSupabaseServerClient.mockResolvedValue({
      storage: {
        from: () => ({
          upload: mocks.storageUpload,
        }),
      },
    });
    mocks.writeAuditLog.mockResolvedValue("corr-scheme-1");
    mocks.createOrUpdateScheme.mockResolvedValue({
      ok: true,
      schemeId: SCHEME_ID,
    });
    mocks.attachSchemeFormBlankoTemplate.mockResolvedValue({
      ok: true,
      templateVersion: 1,
    });
  });

  it("saves custom scheme manifest, dynamic form registry, 04B/06A/09 questions, and inline .docx blanko without hardcoding 5 AK3U forms", async () => {
    const fd = new FormData();
    fd.set("code", "ict-pm");
    fd.set("name", "Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)");
    fd.set("official04bCount", "2");
    fd.set("written06aCount", "2");
    fd.set("questionBankCount", "2");
    fd.set("decisionRule", "VATM");
    fd.set("decisionRuleRef", "SKKNI Manajemen Proyek TIK");
    fd.set(
      "unitsText",
      "J.620900.001.02 | Menyusun Perencanaan Proyek TIK\nJ.620900.002.02 | Mengelola Jadwal Proyek TIK",
    );
    fd.set(
      "official04bQuestionsText",
      "1 | J.620900.001.02 | Project Charter | Bagaimana menurunkan sasaran ke Project Charter? | 1.1 Project Charter disusun.",
    );
    fd.set(
      "written06aQuestionsText",
      "J.620900.001.02 | Jelaskan komponen Project Charter.",
    );
    fd.set(
      "interview09QuestionsText",
      "J.620900.002.02 | Bagaimana mengatasi keterlambatan jadwal?",
    );
    fd.set(
      "formsJson",
      JSON.stringify([
        {
          formKey: "muk_portofolio",
          formName: "MUK Verifikasi Portofolio Proyek TIK",
          instrumentRole: "portofolio",
          required: true,
          sortOrder: 1,
          filePatterns: ["verifikasi portofolio", "project charter"],
        },
        {
          formKey: "ak02",
          formName: "FR.AK.02 — Rekaman Asesmen ICT PM",
          instrumentRole: "keputusan",
          required: true,
          sortOrder: 2,
          filePatterns: ["ak02", "rekaman asesmen"],
        },
      ]),
    );
    fd.set("blankoFile_ak02", await makeValidDocxFile("FR.AK.02_ICT_PM.docx"));

    const res = await saveSchemeManifestAction(fd);

    expect(res.ok).toBe(true);
    expect(res.uploaded).toEqual(["ak02 v1"]);
    expect(mocks.createOrUpdateScheme).toHaveBeenCalledTimes(1);
    const callArg = mocks.createOrUpdateScheme.mock.calls[0]?.[0];
    expect(callArg.code).toBe("ICT-PM");
    expect(callArg.forms).toHaveLength(2);
    expect(callArg.forms.map((f: { formKey: string }) => f.formKey)).toEqual([
      "muk_portofolio",
      "ak02",
    ]);
    expect(callArg.manifest.kelompokPekerjaan?.[0]?.aspects[0]?.question).toContain(
      "Project Charter",
    );
    expect(callArg.manifest.writtenQuestions).toHaveLength(1);
    expect(callArg.manifest.interviewQuestions).toHaveLength(1);
    expect(mocks.storageUpload).toHaveBeenCalledTimes(1);
    expect(mocks.attachSchemeFormBlankoTemplate).toHaveBeenCalledTimes(1);
  });

  it("validates ownership and .docx integrity in uploadSchemeFormBlankoAction and rejects non-admin or cross-LSP IDOR", async () => {
    mocks.getSchemeById.mockResolvedValueOnce({
      id: SCHEME_ID,
      lspId: "99999999-9999-4999-8999-999999999999", // Other tenant
      code: "ICT-PM",
      name: "ICT Project Manager",
      version: 1,
      manifest: {},
      forms: [],
    });

    const idorFd = new FormData();
    idorFd.set("schemeId", SCHEME_ID);
    idorFd.set("formKey", "ak02");
    idorFd.set("file", await makeValidDocxFile());
    const idorRes = await uploadSchemeFormBlankoAction(idorFd);
    expect(idorRes.ok).toBe(false);
    expect(idorRes.error).toBe("Skema tidak ditemukan.");
    expect(mocks.storageUpload).not.toHaveBeenCalled();

    mocks.getSchemeById.mockResolvedValueOnce({
      id: SCHEME_ID,
      lspId: LSP_ID,
      code: "ICT-PM",
      name: "ICT Project Manager",
      version: 1,
      manifest: {},
      forms: [{ id: "f1", formKey: "ak02", formName: "FR.AK.02 ICT" }],
    });
    mocks.attachSchemeFormBlankoTemplate.mockResolvedValueOnce({
      ok: true,
      templateVersion: 2,
    });

    const okFd = new FormData();
    okFd.set("schemeId", SCHEME_ID);
    okFd.set("formKey", "ak02");
    okFd.set("file", await makeValidDocxFile("FR.AK.02_v2.docx"));
    const okRes = await uploadSchemeFormBlankoAction(okFd);
    expect(okRes.ok).toBe(true);
    expect(okRes.uploaded).toEqual(["ak02 v2"]);
  });

  it("renders SchemeRegistrationForm with existing scheme cards, versioned blanko badges, and registry controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(SchemeRegistrationForm, {
        existingSchemes: [
          {
            id: SCHEME_ID,
            lspId: LSP_ID,
            code: "ICT-PM",
            name: "Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)",
            version: 1,
            manifest: {
              questionCounts: {
                official04bCount: 4,
                written06aCount: 5,
                questionBankCount: 5,
              },
              decisionRule: "VATM",
              decisionRuleRef: "SKKNI TIK",
              prerequisites: [],
              registrationRequirements: [],
              units: [{ code: "J.620900.001.02", title: "Menyusun Perencanaan Proyek TIK" }],
              formSuffixMapping: { soal: "06A", kunci: "06B", jawaban: "06C" },
            },
            forms: [
              {
                id: "f-ak02",
                formKey: "ak02",
                formName: "FR.AK.02 — ICT PM",
                filePatterns: ["ak02"],
                required: true,
                instrumentRole: "keputusan",
                sortOrder: 1,
                templateStoragePath: `${LSP_ID}/${SCHEME_ID}/ak02/v1-FR.AK.02.docx`,
                templateFileName: "FR.AK.02.docx",
                templateMimeType:
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                templateSha256: "abcdef123456",
                templateVersion: 1,
                templateUploadedAt: "2026-11-19T12:00:00Z",
                templateUploadedBy: USER_ID,
              },
            ],
          },
        ],
      }),
    );

    expect(html).toContain('data-testid="scheme-card-ICT-PM"');
    expect(html).toContain('data-testid="edit-scheme-ICT-PM"');
    expect(html).toContain("ak02 · v1");
    expect(html).toContain('data-testid="add-scheme-form-row-btn"');
    expect(html).toContain('data-testid="official-04b-questions-textarea"');
    expect(html).toContain('data-testid="written-06a-questions-textarea"');
    expect(html).toContain('data-testid="interview-09-questions-textarea"');
  });
});
