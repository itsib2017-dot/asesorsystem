"use server";

import { z } from "zod";
import { getUser } from "@/lib/auth/get-session";
import { listUserMemberships } from "@/repositories/auth.repository";
import { createOrUpdateScheme } from "@/repositories/schemes.repository";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schemeSchema = z.object({
  code: z.string().min(2, { message: "Kode skema wajib diisi." }),
  name: z.string().min(3, { message: "Nama skema wajib diisi." }),
  official04bCount: z.coerce.number().int().min(1),
  written06aCount: z.coerce.number().int().min(1),
  questionBankCount: z.coerce.number().int().min(1),
  decisionRule: z.string().min(1),
  decisionRuleRef: z.string().min(1),
  prerequisites: z.string().default(""),
  registrationRequirements: z.string().default(""),
  soalSuffix: z.string().min(1).default("06A"),
  kunciSuffix: z.string().min(1).default("06B"),
  jawabanSuffix: z.string().min(1).default("06C"),
});

export async function saveSchemeManifestAction(formData: FormData) {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const memberships = await listUserMemberships(user.id);
  const adminMembership = memberships.find((m) => m.role === "lsp_admin") ?? memberships[0];
  if (!adminMembership) {
    return { ok: false, error: "Akun belum terdaftar pada LSP mana pun." };
  }

  const parsed = schemeSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    official04bCount: formData.get("official04bCount"),
    written06aCount: formData.get("written06aCount"),
    questionBankCount: formData.get("questionBankCount"),
    decisionRule: formData.get("decisionRule"),
    decisionRuleRef: formData.get("decisionRuleRef"),
    prerequisites: formData.get("prerequisites") ?? "",
    registrationRequirements: formData.get("registrationRequirements") ?? "",
    soalSuffix: formData.get("soalSuffix") || "06A",
    kunciSuffix: formData.get("kunciSuffix") || "06B",
    jawabanSuffix: formData.get("jawabanSuffix") || "06C",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const d = parsed.data;
  const res = await createOrUpdateScheme({
    userId: user.id,
    lspId: adminMembership.lspId,
    code: d.code.trim().toUpperCase(),
    name: d.name.trim(),
    manifest: {
      questionCounts: {
        official04bCount: d.official04bCount,
        written06aCount: d.written06aCount,
        questionBankCount: d.questionBankCount,
      },
      decisionRule: d.decisionRule.trim(),
      decisionRuleRef: d.decisionRuleRef.trim(),
      prerequisites: d.prerequisites
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      registrationRequirements: d.registrationRequirements
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      units: [],
      formSuffixMapping: {
        soal: d.soalSuffix.trim(),
        kunci: d.kunciSuffix.trim(),
        jawaban: d.jawabanSuffix.trim(),
      },
    },
    forms: [
      { formKey: "04a", filePatterns: ["04a", "dit"], required: true, instrumentRole: "dit", sortOrder: 1 },
      { formKey: "04b", filePatterns: ["04b", "presentasi"], required: true, instrumentRole: "presentation", sortOrder: 2 },
      { formKey: "06a", filePatterns: [d.soalSuffix.toLowerCase()], required: true, instrumentRole: "written_soal", sortOrder: 3 },
      { formKey: "06b", filePatterns: [d.kunciSuffix.toLowerCase()], required: true, instrumentRole: "written_kunci", sortOrder: 4 },
      { formKey: "06c", filePatterns: [d.jawabanSuffix.toLowerCase()], required: true, instrumentRole: "written_jawaban", sortOrder: 5 },
    ],
  });

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  const supabase = await getSupabaseServerClient();
  await writeAuditLog(
    {
      lsp_id: adminMembership.lspId,
      actor_id: user.id,
      action: "scheme.manifest.upsert",
      resource: "schemes",
      resource_id: res.schemeId,
      after_summary: { code: d.code, name: d.name },
    },
    supabase,
  );

  return { ok: true };
}
