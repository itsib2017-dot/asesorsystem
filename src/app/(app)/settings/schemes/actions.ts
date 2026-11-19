"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/get-session";
import { resolveAuthorizedLsp } from "@/lib/auth/get-role";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  attachSchemeFormBlankoTemplate,
  createOrUpdateScheme,
  getSchemeById,
  type SchemeManifestConfig,
} from "@/repositories/schemes.repository";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DOCX_MIME_TYPE,
  SchemeFormDraftSchema,
  parse04bQuestionsToKelompok,
  parseInterviewQuestionsLines,
  parseUnitsLines,
  parseWrittenQuestionsLines,
  validateBrandingLogoUrl,
  validateDocxBlankoBuffer,
} from "@/lib/forms/scheme-manifest-parser";

const schemeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, { message: "Kode skema wajib diisi." })
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/, { message: "Kode skema hanya huruf, angka, '.', '_', '-'." }),
  name: z.string().trim().min(3, { message: "Nama skema wajib diisi." }).max(240),
  official04bCount: z.coerce.number().int().min(0).max(500),
  written06aCount: z.coerce.number().int().min(0).max(500),
  questionBankCount: z.coerce.number().int().min(0).max(500),
  decisionRule: z.string().trim().min(1).max(64),
  decisionRuleRef: z.string().trim().min(1).max(400),
  prerequisites: z.string().max(20_000).default(""),
  registrationRequirements: z.string().max(20_000).default(""),
  unitsText: z.string().max(50_000).default(""),
  docColumnsText: z.string().max(2_000).default(""),
  soalSuffix: z.string().trim().min(1).max(16).default("06A"),
  kunciSuffix: z.string().trim().min(1).max(16).default("06B"),
  jawabanSuffix: z.string().trim().min(1).max(16).default("06C"),
  formsJson: z.string().max(100_000).default("[]"),
  official04bQuestionsText: z.string().max(100_000).default(""),
  written06aQuestionsText: z.string().max(100_000).default(""),
  interview09QuestionsText: z.string().max(100_000).default(""),
  leftLogoUrl: z.string().max(1_000).default(""),
  leftLogoAlt: z.string().max(120).default(""),
  rightLogoUrl: z.string().max(1_000).default(""),
  rightLogoAlt: z.string().max(120).default(""),
});

const splitLines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

type ActionResult = { ok: boolean; error?: string; schemeId?: string; uploaded?: string[] };

async function requireAdmin(): Promise<
  { ok: true; userId: string; lspId: string } | { ok: false; error: string }
> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const authz = await resolveAuthorizedLsp(user.id, ["lsp_admin"]);
  if (!authz.allowed || !authz.lspId) {
    return { ok: false, error: "Hanya Admin LSP yang dapat mengubah skema sertifikasi." };
  }
  return { ok: true, userId: user.id, lspId: authz.lspId };
}

async function storeBlanko(params: {
  userId: string;
  lspId: string;
  schemeId: string;
  formKey: string;
  formName?: string;
  file: File;
}): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const check = await validateDocxBlankoBuffer(buffer, params.file.name);
  if (!check.valid) return { ok: false, error: `${params.formKey}: ${check.error}` };

  const supabase = await getSupabaseServerClient();
  const storagePath = `${params.lspId}/${params.schemeId}/${params.formKey}/${Date.now()}-${check.safeFileName}`;
  const { error: upErr } = await supabase.storage
    .from("scheme-blankos")
    .upload(storagePath, buffer, { contentType: DOCX_MIME_TYPE, upsert: false });
  if (upErr) {
    console.error(`[Scheme Blanko Upload Error]: ${upErr.message}`);
    return { ok: false, error: `${params.formKey}: gagal mengunggah blanko ke penyimpanan.` };
  }

  const res = await attachSchemeFormBlankoTemplate({
    userId: params.userId,
    lspId: params.lspId,
    schemeId: params.schemeId,
    formKey: params.formKey,
    formName: params.formName,
    storagePath,
    fileName: check.safeFileName,
    mimeType: DOCX_MIME_TYPE,
    sha256: check.sha256,
  });
  if (!res.ok) return { ok: false, error: `${params.formKey}: ${res.error}` };

  await writeAuditLog(
    {
      lsp_id: params.lspId,
      actor_id: params.userId,
      action: "scheme.blanko.upload",
      resource: "scheme_form_manifests",
      resource_id: params.schemeId,
      after_summary: {
        formKey: params.formKey,
        fileName: check.safeFileName,
        sha256: check.sha256,
        templateVersion: res.templateVersion,
      },
    },
    supabase,
  );
  return { ok: true, version: res.templateVersion };
}

export async function saveSchemeManifestAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const rate = checkRateLimit(`scheme:save:${auth.userId}`, 20, 60_000);
  if (!rate.allowed) {
    return { ok: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${rate.retryAfterSeconds} detik.` };
  }

  const str = (k: string, d = "") => {
    const v = formData.get(k);
    return typeof v === "string" ? v : d;
  };

  const parsed = schemeSchema.safeParse({
    code: str("code"),
    name: str("name"),
    official04bCount: str("official04bCount", "0") || "0",
    written06aCount: str("written06aCount", "0") || "0",
    questionBankCount: str("questionBankCount", "0") || "0",
    decisionRule: str("decisionRule"),
    decisionRuleRef: str("decisionRuleRef"),
    prerequisites: str("prerequisites"),
    registrationRequirements: str("registrationRequirements"),
    unitsText: str("unitsText"),
    docColumnsText: str("docColumnsText"),
    soalSuffix: str("soalSuffix") || "06A",
    kunciSuffix: str("kunciSuffix") || "06B",
    jawabanSuffix: str("jawabanSuffix") || "06C",
    formsJson: str("formsJson", "[]") || "[]",
    official04bQuestionsText: str("official04bQuestionsText"),
    written06aQuestionsText: str("written06aQuestionsText"),
    interview09QuestionsText: str("interview09QuestionsText"),
    leftLogoUrl: str("leftLogoUrl"),
    leftLogoAlt: str("leftLogoAlt"),
    rightLogoUrl: str("rightLogoUrl"),
    rightLogoAlt: str("rightLogoAlt"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  let rawForms: unknown;
  try {
    rawForms = JSON.parse(d.formsJson);
  } catch {
    return { ok: false, error: "Daftar formulir tidak valid (JSON)." };
  }
  const formsParsed = z.array(SchemeFormDraftSchema).max(60).safeParse(rawForms);
  if (!formsParsed.success) {
    return { ok: false, error: formsParsed.error.issues.map((i) => i.message).join(", ") };
  }
  const forms = formsParsed.data;
  const keys = forms.map((f) => f.formKey.toLowerCase());
  if (new Set(keys).size !== keys.length) {
    return { ok: false, error: "Kode formulir tidak boleh duplikat dalam satu skema." };
  }

  const left = validateBrandingLogoUrl(d.leftLogoUrl);
  const right = validateBrandingLogoUrl(d.rightLogoUrl);
  if (!left.valid || !right.valid) {
    return { ok: false, error: left.error ?? right.error ?? "URL logo tidak valid." };
  }

  const normalizedCode = d.code.toUpperCase();
  const units = parseUnitsLines(d.unitsText);
  const kelompok = parse04bQuestionsToKelompok(d.official04bQuestionsText, units);
  const writtenQuestions = parseWrittenQuestionsLines(d.written06aQuestionsText);
  const interviewQuestions = parseInterviewQuestionsLines(d.interview09QuestionsText);
  const docColumns = d.docColumnsText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const manifest: SchemeManifestConfig = {
    questionCounts: {
      official04bCount: d.official04bCount || kelompok.reduce((n, k) => n + k.aspects.length, 0),
      written06aCount: d.written06aCount || writtenQuestions.length,
      questionBankCount: d.questionBankCount,
    },
    decisionRule: d.decisionRule,
    decisionRuleRef: d.decisionRuleRef,
    prerequisites: splitLines(d.prerequisites),
    registrationRequirements: splitLines(d.registrationRequirements),
    units,
    ...(kelompok.length > 0 ? { kelompokPekerjaan: kelompok } : {}),
    ...(writtenQuestions.length > 0 ? { writtenQuestions } : {}),
    ...(interviewQuestions.length > 0 ? { interviewQuestions } : {}),
    ...(docColumns.length > 0 ? { docColumns } : {}),
    branding: {
      ...(left.value ? { leftLogoUrl: left.value } : {}),
      ...(right.value ? { rightLogoUrl: right.value } : {}),
      ...(d.leftLogoAlt.trim() ? { leftLogoAlt: d.leftLogoAlt.trim() } : {}),
      ...(d.rightLogoAlt.trim() ? { rightLogoAlt: d.rightLogoAlt.trim() } : {}),
    },
    formSuffixMapping: { soal: d.soalSuffix, kunci: d.kunciSuffix, jawaban: d.jawabanSuffix },
  };

  const res = await createOrUpdateScheme({
    userId: auth.userId,
    lspId: auth.lspId,
    code: normalizedCode,
    name: d.name,
    manifest,
    forms: forms.map((f) => ({
      formKey: f.formKey,
      formName: f.formName,
      filePatterns: f.filePatterns.map((p) => p.toLowerCase()),
      required: f.required,
      instrumentRole: f.instrumentRole,
      sortOrder: f.sortOrder,
    })),
  });
  if (!res.ok) return { ok: false, error: res.error };

  const supabase = await getSupabaseServerClient();
  await writeAuditLog(
    {
      lsp_id: auth.lspId,
      actor_id: auth.userId,
      action: "scheme.manifest.upsert",
      resource: "schemes",
      resource_id: res.schemeId,
      after_summary: {
        code: normalizedCode,
        name: d.name,
        formCount: forms.length,
        units: units.length,
        questions04b: kelompok.reduce((n, k) => n + k.aspects.length, 0),
        questions06a: writtenQuestions.length,
        questions09: interviewQuestions.length,
      },
    },
    supabase,
  );

  const uploaded: string[] = [];
  const errors: string[] = [];
  for (const f of forms) {
    const file = formData.get(`blankoFile_${f.formKey}`);
    if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
      const up = await storeBlanko({
        userId: auth.userId,
        lspId: auth.lspId,
        schemeId: res.schemeId,
        formKey: f.formKey,
        formName: f.formName,
        file: file as File,
      });
      if (up.ok) uploaded.push(`${f.formKey} v${up.version}`);
      else errors.push(up.error);
    }
  }

  revalidatePath("/settings/schemes");
  revalidatePath("/batches");
  revalidatePath("/dashboard");

  if (errors.length > 0) {
    return {
      ok: false,
      schemeId: res.schemeId,
      uploaded,
      error: `Manifes tersimpan, namun sebagian blanko gagal: ${errors.join("; ")}`,
    };
  }
  return { ok: true, schemeId: res.schemeId, uploaded };
}

export async function uploadSchemeFormBlankoAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const rate = checkRateLimit(`scheme:blanko:${auth.userId}`, 30, 60_000);
  if (!rate.allowed) {
    return { ok: false, error: `Terlalu banyak unggahan. Coba lagi dalam ${rate.retryAfterSeconds} detik.` };
  }

  const input = z
    .object({
      schemeId: z.string().uuid("Skema tidak valid."),
      formKey: SchemeFormDraftSchema.shape.formKey,
    })
    .safeParse({ schemeId: formData.get("schemeId"), formKey: formData.get("formKey") });
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message };

  const scheme = await getSchemeById(auth.userId, input.data.schemeId);
  if (!scheme || scheme.lspId !== auth.lspId) {
    return { ok: false, error: "Skema tidak ditemukan." };
  }
  const file = formData.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { ok: false, error: "Berkas blanko .docx wajib dipilih." };
  }
  const formName = scheme.forms.find((f) => f.formKey === input.data.formKey)?.formName;
  const up = await storeBlanko({
    userId: auth.userId,
    lspId: auth.lspId,
    schemeId: scheme.id,
    formKey: input.data.formKey,
    formName,
    file: file as File,
  });
  revalidatePath("/settings/schemes");
  if (!up.ok) return { ok: false, error: up.error };
  return { ok: true, schemeId: scheme.id, uploaded: [`${input.data.formKey} v${up.version}`] };
}
