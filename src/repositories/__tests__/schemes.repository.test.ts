import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const mocks = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  runRepositoryDualPath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

vi.mock("@/db", () => ({
  runRepositoryDualPath: mocks.runRepositoryDualPath,
}));

import {
  attachSchemeFormBlankoTemplate,
  createOrUpdateScheme,
  deleteSchemeFormEntry,
  getSchemeById,
  listSchemes,
  type SchemeManifestConfig,
} from "../schemes.repository";
import {
  formatInterviewQuestionsToText,
  formatKelompokTo04bText,
  formatWrittenQuestionsToText,
  parse04bQuestionsToKelompok,
  parseInterviewQuestionsLines,
  parseUnitsLines,
  parseWrittenQuestionsLines,
  validateBrandingLogoUrl,
  validateDocxBlankoBuffer,
} from "@/lib/forms/scheme-manifest-parser";

const SAMPLE_MANIFEST: SchemeManifestConfig = {
  questionCounts: {
    official04bCount: 2,
    written06aCount: 3,
    questionBankCount: 3,
  },
  decisionRule: "VATM",
  decisionRuleRef: "SKKNI Manajemen Proyek TIK",
  prerequisites: ["S1 TIK"],
  registrationRequirements: ["KTP", "CV", "Portofolio"],
  units: [
    { code: "J.620900.001.02", title: "Menyusun Perencanaan Proyek TIK" },
    { code: "J.620900.002.02", title: "Mengelola Jadwal dan Anggaran Proyek TIK" },
  ],
  formSuffixMapping: {
    soal: "06A",
    kunci: "06B",
    jawaban: "06C",
  },
};

describe("SchemesRepository & Blanko Registry CRUD (Round 14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runRepositoryDualPath.mockImplementation(
      async (opts: { supabase: () => Promise<unknown> }) => opts.supabase(),
    );
  });

  it("lists and sorts per-scheme form manifests with versioned blanko template metadata", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "sch-ict-1",
                lsp_id: "lsp-1",
                code: "ICT-PM",
                name: "Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)",
                version: 2,
                manifest: SAMPLE_MANIFEST,
                scheme_form_manifests: [
                  {
                    id: "f-2",
                    form_key: "ak02",
                    form_name: "FR.AK.02 — Rekaman Asesmen ICT PM",
                    file_patterns: ["ak02", "rekaman asesmen"],
                    required: true,
                    instrument_role: "keputusan",
                    sort_order: 2,
                    template_storage_path: "lsp-1/sch-ict-1/ak02/v1-FR.AK.02.docx",
                    template_file_name: "FR.AK.02.docx",
                    template_mime_type:
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    template_sha256: "abc123sha256",
                    template_version: 1,
                    template_uploaded_at: "2026-11-19T12:00:00Z",
                    template_uploaded_by: "user-1",
                  },
                  {
                    id: "f-1",
                    form_key: "muk_portofolio",
                    form_name: "MUK Verifikasi Portofolio",
                    file_patterns: ["verifikasi portofolio", "project charter"],
                    required: true,
                    instrument_role: "portofolio",
                    sort_order: 1,
                    template_storage_path: null,
                    template_file_name: null,
                    template_mime_type: null,
                    template_sha256: null,
                    template_version: 0,
                    template_uploaded_at: null,
                    template_uploaded_by: null,
                  },
                ],
              },
            ],
          }),
        }),
      })),
    };
    mocks.getSupabaseServerClient.mockResolvedValue(mockSupabase);

    const rows = await listSchemes("user-1", "lsp-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe("ICT-PM");
    expect(rows[0]?.forms.map((f) => f.formKey)).toEqual(["muk_portofolio", "ak02"]);
    expect(rows[0]?.forms[1]).toMatchObject({
      formKey: "ak02",
      formName: "FR.AK.02 — Rekaman Asesmen ICT PM",
      templateFileName: "FR.AK.02.docx",
      templateVersion: 1,
      templateSha256: "abc123sha256",
    });
  });

  it("preserves existing uploaded blanko template metadata when createOrUpdateScheme updates form rules", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "schemes") {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "sch-ict-1" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "f-ak02",
                  form_key: "ak02",
                  form_name: "FR.AK.02 Lama",
                  file_patterns: ["ak02"],
                  required: true,
                  instrument_role: "keputusan",
                  sort_order: 1,
                  template_storage_path: "lsp-1/sch-ict-1/ak02/v2-AK02-ICT.docx",
                  template_file_name: "AK02-ICT.docx",
                  template_mime_type:
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  template_sha256: "def456sha",
                  template_version: 2,
                  template_uploaded_at: "2026-11-19T12:10:00Z",
                  template_uploaded_by: "user-1",
                },
              ],
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn((rows: Array<Record<string, unknown>>) => {
            insertedRows = rows;
            return Promise.resolve({ error: null });
          }),
        };
      }),
    };
    mocks.getSupabaseServerClient.mockResolvedValue(mockSupabase);

    const res = await createOrUpdateScheme({
      userId: "user-1",
      lspId: "lsp-1",
      code: "ICT-PM",
      name: "Okupasi ICT Project Manager",
      manifest: SAMPLE_MANIFEST,
      forms: [
        {
          formKey: "ak02",
          formName: "FR.AK.02 — Rekaman Asesmen ICT PM (Diperbarui)",
          filePatterns: ["ak02", "rekaman ict"],
          required: true,
          instrumentRole: "keputusan",
          sortOrder: 1,
        },
        {
          formKey: "berita_acara",
          formName: "Berita Acara & Daftar Hadir",
          filePatterns: ["berita acara", "daftar hadir"],
          required: true,
          instrumentRole: "administrasi",
          sortOrder: 2,
        },
      ],
    });

    expect(res).toEqual({ ok: true, schemeId: "sch-ict-1" });
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows[0]).toMatchObject({
      form_key: "ak02",
      form_name: "FR.AK.02 — Rekaman Asesmen ICT PM (Diperbarui)",
      file_patterns: ["ak02", "rekaman ict"],
      template_storage_path: "lsp-1/sch-ict-1/ak02/v2-AK02-ICT.docx",
      template_file_name: "AK02-ICT.docx",
      template_version: 2,
      template_sha256: "def456sha",
    });
    expect(insertedRows[1]).toMatchObject({
      form_key: "berita_acara",
      template_storage_path: null,
      template_version: 0,
    });
  });

  it("increments templateVersion and records SHA-256 on attachSchemeFormBlankoTemplate, and supports getSchemeById & deleteSchemeFormEntry", async () => {
    let updatedPayload: Record<string, unknown> | null = null;
    let deletedKey: string | null = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "schemes") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "sch-ict-1",
                    lsp_id: "lsp-1",
                    code: "ICT-PM",
                    name: "ICT Project Manager",
                    version: 1,
                    manifest: SAMPLE_MANIFEST,
                    scheme_form_manifests: [],
                  },
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "row-04b", template_version: 1 },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: vi.fn((payload: Record<string, unknown>) => {
            updatedPayload = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn((_col: string, val: string) => {
                  deletedKey = val;
                  return Promise.resolve({ error: null });
                }),
              }),
            }),
          })),
        };
      }),
    };
    mocks.getSupabaseServerClient.mockResolvedValue(mockSupabase);

    const attached = await attachSchemeFormBlankoTemplate({
      userId: "user-1",
      lspId: "lsp-1",
      schemeId: "sch-ict-1",
      formKey: "04b",
      formName: "FR.IA.04B — ICT PM",
      storagePath: "lsp-1/sch-ict-1/04b/v2-FR.IA.04B.docx",
      fileName: "FR.IA.04B.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sha256: "sha256-v2",
    });

    expect(attached).toEqual({ ok: true, templateVersion: 2 });
    expect(updatedPayload).toMatchObject({
      form_name: "FR.IA.04B — ICT PM",
      template_storage_path: "lsp-1/sch-ict-1/04b/v2-FR.IA.04B.docx",
      template_file_name: "FR.IA.04B.docx",
      template_sha256: "sha256-v2",
      template_version: 2,
      template_uploaded_by: "user-1",
    });

    const single = await getSchemeById("user-1", "sch-ict-1");
    expect(single?.code).toBe("ICT-PM");

    const del = await deleteSchemeFormEntry({
      userId: "user-1",
      lspId: "lsp-1",
      schemeId: "sch-ict-1",
      formKey: "04b",
    });
    expect(del).toEqual({ ok: true });
    expect(deletedKey).toBe("04b");
  });

  it("validates .docx blanko magic bytes & word/document.xml structure and round-trips 04B/06A/09 questions", async () => {
    const badRes = await validateDocxBlankoBuffer(Buffer.from("not-a-docx"), "fake.docx");
    expect(badRes.valid).toBe(false);

    const zipWithoutDocXml = new JSZip();
    zipWithoutDocXml.file("hello.txt", "world");
    const emptyZipBuf = await zipWithoutDocXml.generateAsync({ type: "nodebuffer" });
    const missingDocRes = await validateDocxBlankoBuffer(emptyZipBuf, "missing.docx");
    expect(missingDocRes.valid).toBe(false);

    const validZip = new JSZip();
    validZip.file("word/document.xml", "<w:document><w:body><w:p/></w:body></w:document>");
    const validBuf = await validZip.generateAsync({ type: "nodebuffer" });
    const okRes = await validateDocxBlankoBuffer(validBuf, "../FR.AK.02 ICT PM.docx");
    expect(okRes.valid).toBe(true);
    if (okRes.valid) {
      expect(okRes.safeFileName).toBe("FR.AK.02_ICT_PM.docx");
      expect(okRes.sha256).toHaveLength(64);
    }

    const units = parseUnitsLines(
      "J.620900.001.02 | Menyusun Perencanaan Proyek TIK\nJ.620900.002.02 | Mengelola Jadwal Proyek TIK",
    );
    expect(units).toHaveLength(2);

    const raw04b = [
      "1 | J.620900.001.02 | Penyusunan Project Charter | Bagaimana menurunkan sasaran ke Project Charter? | 1.1 Project Charter disusun.",
      "2 | J.620900.002.02 | Estimasi Critical Path | Bagaimana menentukan jalur kritis? | 2.1 Jadwal disusun.",
    ].join("\n");
    const kps = parse04bQuestionsToKelompok(raw04b, units);
    expect(kps).toHaveLength(2);
    expect(kps[0]?.isGenericFallback).toBe(false);
    expect(kps[0]?.aspects[0]?.question).toContain("Project Charter");
    expect(formatKelompokTo04bText(kps)).toBe(raw04b);

    const raw06a = "J.620900.001.02 | Jelaskan komponen Project Charter.";
    const parsed06a = parseWrittenQuestionsLines(raw06a);
    expect(parsed06a).toEqual([
      { no: 1, unitCode: "J.620900.001.02", question: "Jelaskan komponen Project Charter." },
    ]);
    expect(formatWrittenQuestionsToText(parsed06a)).toBe(raw06a);

    const raw09 = "J.620900.002.02 | Bagaimana mengatasi keterlambatan jadwal?";
    const parsed09 = parseInterviewQuestionsLines(raw09);
    expect(parsed09).toEqual([
      { no: 1, unitCode: "J.620900.002.02", question: "Bagaimana mengatasi keterlambatan jadwal?" },
    ]);
    expect(formatInterviewQuestionsToText(parsed09)).toBe(raw09);

    expect(validateBrandingLogoUrl("/logos/lsp-tik.png")).toEqual({
      valid: true,
      value: "/logos/lsp-tik.png",
    });
    expect(validateBrandingLogoUrl("/../secret.png").valid).toBe(false);
    expect(validateBrandingLogoUrl("http://127.0.0.1/logo.png").valid).toBe(false);
  });
});
