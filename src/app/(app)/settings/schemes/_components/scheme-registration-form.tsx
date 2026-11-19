"use client"; // WHY: Interactive form registry editor, dynamic form rows, and multi-file .docx blanko uploads require client state.

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Plus,
  PlusCircle,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  getFallbackAk3uUnits,
  IA04B_KELOMPOK_PEKERJAAN,
  resolveSchemeUnitsList,
} from "@/lib/forms/assessee-forms";
import {
  INSTRUMENT_ROLE_OPTIONS,
  formatInterviewQuestionsToText,
  formatKelompokTo04bText,
  formatWrittenQuestionsToText,
} from "@/lib/forms/scheme-manifest-parser";
import type { SchemeRecord } from "@/repositories/schemes.repository";
import {
  saveSchemeManifestAction,
  uploadSchemeFormBlankoAction,
} from "../actions";

interface EditableFormRow {
  rowId: string;
  formKey: string;
  formName: string;
  instrumentRole: string;
  required: boolean;
  sortOrder: number;
  filePatternsText: string;
  templateFileName?: string | null;
  templateVersion?: number;
  templateSha256?: string | null;
}

const AK3U_SAMPLE_FORMS: EditableFormRow[] = [
  { rowId: "ak3u-1", formKey: "apl01", formName: "FR.APL.01 — Permohonan Sertifikasi Kompetensi", instrumentRole: "administrasi", required: true, sortOrder: 1, filePatternsText: "apl01, apl.01, permohonan" },
  { rowId: "ak3u-2", formKey: "apl02", formName: "FR.APL.02 — Asesmen Mandiri", instrumentRole: "administrasi", required: true, sortOrder: 2, filePatternsText: "apl02, apl.02, asesmen mandiri" },
  { rowId: "ak3u-3", formKey: "ak01", formName: "FR.AK.01 — Persetujuan Asesmen dan Kerahasiaan", instrumentRole: "administrasi", required: true, sortOrder: 3, filePatternsText: "ak01, ak.01, persetujuan asesmen" },
  { rowId: "ak3u-4", formKey: "ak02", formName: "FR.AK.02 — Rekaman Asesmen Kompetensi", instrumentRole: "keputusan", required: true, sortOrder: 4, filePatternsText: "ak02, ak.02, rekaman asesmen" },
  { rowId: "ak3u-5", formKey: "ak05", formName: "FR.AK.05 — Laporan Asesmen", instrumentRole: "laporan", required: true, sortOrder: 5, filePatternsText: "ak05, ak.05, laporan asesmen" },
  { rowId: "ak3u-6", formKey: "04a", formName: "FR.IA.04A — Daftar Instruksi Terstruktur (DIT)", instrumentRole: "dit", required: true, sortOrder: 6, filePatternsText: "04a, ia.04a, dit" },
  { rowId: "ak3u-7", formKey: "04b", formName: "FR.IA.04B — Penilaian Proyek Singkat", instrumentRole: "presentation", required: true, sortOrder: 7, filePatternsText: "04b, ia.04b, presentasi" },
  { rowId: "ak3u-8", formKey: "06a", formName: "FR.IA.06A — Pertanyaan Tertulis Esai", instrumentRole: "written_soal", required: true, sortOrder: 8, filePatternsText: "06a, ia.06a" },
  { rowId: "ak3u-9", formKey: "06b", formName: "FR.IA.06B — Kunci Jawaban Tertulis Esai", instrumentRole: "written_kunci", required: true, sortOrder: 9, filePatternsText: "06b, ia.06b, kunci" },
  { rowId: "ak3u-10", formKey: "06c", formName: "FR.IA.06C — Lembar Jawaban Pertanyaan Tertulis", instrumentRole: "written_jawaban", required: true, sortOrder: 10, filePatternsText: "06c, ia.06c, jawaban" },
  { rowId: "ak3u-11", formKey: "09", formName: "FR.IA.09 — Daftar Pertanyaan Wawancara", instrumentRole: "interview", required: false, sortOrder: 11, filePatternsText: "09, ia.09, wawancara" },
];

const ICT_PM_SAMPLE_FORMS: EditableFormRow[] = [
  { rowId: "ict-1", formKey: "apl01", formName: "FR.APL.01 — Permohonan Sertifikasi ICT PM", instrumentRole: "administrasi", required: true, sortOrder: 1, filePatternsText: "apl01, apl.01, permohonan" },
  { rowId: "ict-2", formKey: "apl02", formName: "FR.APL.02 — Asesmen Mandiri ICT PM", instrumentRole: "administrasi", required: true, sortOrder: 2, filePatternsText: "apl02, apl.02, asesmen mandiri" },
  { rowId: "ict-3", formKey: "berita_acara", formName: "Kelengkapan Asesmen — Berita Acara & Daftar Hadir", instrumentRole: "administrasi", required: true, sortOrder: 3, filePatternsText: "berita acara, daftar hadir, kelengkapan asesmen" },
  { rowId: "ict-4", formKey: "muk_portofolio", formName: "MUK Verifikasi Portofolio Proyek TIK", instrumentRole: "portofolio", required: true, sortOrder: 4, filePatternsText: "verifikasi portofolio, portofolio proyek, project charter, wbs, bast" },
  { rowId: "ict-5", formKey: "04a", formName: "MUK Kegiatan Terstruktur (FR.IA.04A)", instrumentRole: "dit", required: true, sortOrder: 5, filePatternsText: "04a, kegiatan terstruktur, ia.04a" },
  { rowId: "ict-6", formKey: "04b", formName: "Penilaian Proyek & Presentasi ICT PM (FR.IA.04B)", instrumentRole: "presentation", required: true, sortOrder: 6, filePatternsText: "04b, ia.04b, paparan proyek" },
  { rowId: "ict-7", formKey: "06a", formName: "Soal Tertulis ICT PM (FR.IA.06A)", instrumentRole: "written_soal", required: true, sortOrder: 7, filePatternsText: "06a, ia.06a, soal ict" },
  { rowId: "ict-8", formKey: "06b", formName: "Kunci Jawaban ICT PM (FR.IA.06B)", instrumentRole: "written_kunci", required: true, sortOrder: 8, filePatternsText: "06b, ia.06b, kunci ict" },
  { rowId: "ict-9", formKey: "06c", formName: "Lembar Jawaban Tertulis ICT PM (FR.IA.06C)", instrumentRole: "written_jawaban", required: true, sortOrder: 9, filePatternsText: "06c, ia.06c, jawaban ict" },
  { rowId: "ict-10", formKey: "09", formName: "Wawancara Klarifikasi Portofolio ICT PM (FR.IA.09)", instrumentRole: "interview", required: false, sortOrder: 10, filePatternsText: "09, ia.09, wawancara" },
  { rowId: "ict-11", formKey: "ak02", formName: "FR.AK.02 — Rekaman Asesmen ICT PM", instrumentRole: "keputusan", required: true, sortOrder: 11, filePatternsText: "ak02, ak.02, rekaman asesmen" },
  { rowId: "ict-12", formKey: "ak05", formName: "FR.AK.05 — Laporan Asesmen ICT PM", instrumentRole: "laporan", required: true, sortOrder: 12, filePatternsText: "ak05, ak.05, laporan asesmen" },
];

export function SchemeRegistrationForm({
  existingSchemes = [],
}: {
  existingSchemes?: SchemeRecord[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [forms, setForms] = useState<EditableFormRow[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const setField = (name: string, value: string) => {
    const form = formRef.current;
    if (!form) return;
    const el = form.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (el) el.value = value;
  };

  const handleResetEmpty = () => {
    setEditingSchemeId(null);
    setFeedback(null);
    formRef.current?.reset();
    setForms([]);
  };

  const handleLoadScheme = (scheme: SchemeRecord, asClone = false) => {
    setEditingSchemeId(asClone ? null : scheme.id);
    setFeedback(null);

    setField("code", asClone ? `${scheme.code}-COPY` : scheme.code);
    setField("name", asClone ? `${scheme.name} (Salinan)` : scheme.name);
    setField(
      "official04bCount",
      String(scheme.manifest.questionCounts?.official04bCount ?? 0),
    );
    setField(
      "written06aCount",
      String(scheme.manifest.questionCounts?.written06aCount ?? 0),
    );
    setField(
      "questionBankCount",
      String(scheme.manifest.questionCounts?.questionBankCount ?? 0),
    );
    setField("soalSuffix", scheme.manifest.formSuffixMapping?.soal || "06A");
    setField("kunciSuffix", scheme.manifest.formSuffixMapping?.kunci || "06B");
    setField("jawabanSuffix", scheme.manifest.formSuffixMapping?.jawaban || "06C");
    setField("decisionRule", scheme.manifest.decisionRule || "VATM");
    setField("decisionRuleRef", scheme.manifest.decisionRuleRef || "");
    setField("prerequisites", (scheme.manifest.prerequisites ?? []).join("\n"));
    setField(
      "registrationRequirements",
      (scheme.manifest.registrationRequirements ?? []).join("\n"),
    );
    setField(
      "unitsText",
      (scheme.manifest.units ?? []).map((u) => `${u.code} | ${u.title}`).join("\n"),
    );
    setField("docColumnsText", (scheme.manifest.docColumns ?? []).join(", "));
    setField(
      "official04bQuestionsText",
      formatKelompokTo04bText(scheme.manifest.kelompokPekerjaan),
    );
    setField(
      "written06aQuestionsText",
      formatWrittenQuestionsToText(scheme.manifest.writtenQuestions),
    );
    setField(
      "interview09QuestionsText",
      formatInterviewQuestionsToText(scheme.manifest.interviewQuestions),
    );
    setField("leftLogoUrl", scheme.manifest.branding?.leftLogoUrl ?? "");
    setField("leftLogoAlt", scheme.manifest.branding?.leftLogoAlt ?? "");
    setField("rightLogoUrl", scheme.manifest.branding?.rightLogoUrl ?? "");
    setField("rightLogoAlt", scheme.manifest.branding?.rightLogoAlt ?? "");

    setForms(
      scheme.forms.map((f, idx) => ({
        rowId: `${scheme.id}-${f.formKey}-${idx}`,
        formKey: f.formKey,
        formName: f.formName || f.formKey.toUpperCase(),
        instrumentRole: f.instrumentRole,
        required: f.required,
        sortOrder: f.sortOrder || idx + 1,
        filePatternsText: f.filePatterns.join(", "),
        templateFileName: asClone ? null : f.templateFileName,
        templateVersion: asClone ? 0 : f.templateVersion,
        templateSha256: asClone ? null : f.templateSha256,
      })),
    );
  };

  const handleFillAk3uSample = () => {
    setEditingSchemeId(null);
    setFeedback(null);
    setField("code", "AK3U");
    setField(
      "name",
      "Okupasi Ahli Keselamatan dan Kesehatan Kerja Umum (SKM/2037/00013/2/2021/1)",
    );
    setField("official04bCount", "13");
    setField("written06aCount", "13");
    setField("questionBankCount", "13");
    setField("soalSuffix", "06A");
    setField("kunciSuffix", "06B");
    setField("jawabanSuffix", "06C");
    setField("decisionRule", "VATM");
    setField("decisionRuleRef", "Dokumen Skema §9.3.3-9.3.4 (Kepmenaker No. 38 Tahun 2019)");
    setField(
      "prerequisites",
      [
        "Sarjana / Diploma IV dengan pengalaman kerja K3 minimal 1 tahun",
        "Diploma III dengan pengalaman kerja K3 minimal 2 tahun",
        "Memiliki Sertifikat Pembinaan / Pelatihan Ahli K3 Umum",
      ].join("\n"),
    );
    setField(
      "registrationRequirements",
      [
        "KTP",
        "Ijazah Terakhir",
        "Daftar Riwayat Hidup (CV)",
        "Surat Keterangan Pengalaman Kerja / Surat Tugas",
        "Sertifikat Pelatihan / Pembinaan K3",
        "Pas Foto Terbaru",
      ].join("\n"),
    );
    setField(
      "unitsText",
      getFallbackAk3uUnits()
        .map((u) => `${u.code} | ${u.title}`)
        .join("\n"),
    );
    setField("docColumnsText", "APL.01, APL.02, KTP, Ijazah, Pas Foto, CV, 04A, 06C");
    setField("official04bQuestionsText", formatKelompokTo04bText(IA04B_KELOMPOK_PEKERJAAN));
    setField("written06aQuestionsText", "");
    setField("interview09QuestionsText", "");
    setField("leftLogoUrl", "/templates/ak3u/bnsp-logo.png");
    setField("leftLogoAlt", "BNSP");
    setField("rightLogoUrl", "/templates/ak3u/lsp-logo.png");
    setField("rightLogoAlt", "LSP K3");
    setForms(AK3U_SAMPLE_FORMS);
  };

  const handleFillIctPmSample = () => {
    setEditingSchemeId(null);
    setFeedback(null);
    setField("code", "ICT-PM");
    setField("name", "Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)");
    setField("official04bCount", "4");
    setField("written06aCount", "5");
    setField("questionBankCount", "5");
    setField("soalSuffix", "06A");
    setField("kunciSuffix", "06B");
    setField("jawabanSuffix", "06C");
    setField("decisionRule", "VATM");
    setField(
      "decisionRuleRef",
      "SKKNI Bidang Manajemen Proyek TIK (Kepmenaker No. 349 Tahun 2014)",
    );
    setField(
      "prerequisites",
      [
        "Minimal Sarjana (S1) bidang Teknik Informatika / Sistem Informasi / Manajemen dengan pengalaman proyek TIK minimal 2 tahun",
        "Memiliki sertifikat pelatihan Manajemen Proyek TIK atau portofolio kepemimpinan proyek",
      ].join("\n"),
    );
    setField(
      "registrationRequirements",
      [
        "KTP",
        "Ijazah Terakhir",
        "Daftar Riwayat Hidup (CV)",
        "Portofolio Proyek TIK & Surat Tugas",
        "Pas Foto Terbaru",
      ].join("\n"),
    );
    setField(
      "unitsText",
      [
        "J.620900.001.02 | Menyusun Perencanaan Proyek TIK (Project Charter & WBS)",
        "J.620900.002.02 | Mengelola Jadwal, Biaya, dan Sumber Daya Proyek TIK",
        "J.620900.003.02 | Mengelola Risiko, Kualitas, dan Perubahan Lingkup Proyek TIK",
        "J.620900.004.02 | Melakukan Pemantauan, Pelaporan, dan Penutupan Proyek TIK",
      ].join("\n"),
    );
    setField("docColumnsText", "APL.01, APL.02, KTP, Ijazah, CV, Portofolio, 04A, 06C");
    setField(
      "official04bQuestionsText",
      [
        "1 | J.620900.001.02 | Penyusunan Project Charter & WBS | Bagaimana Anda menurunkan tujuan bisnis sponsor proyek TIK ke dalam Project Charter dan struktur WBS yang terukur? | 1.1 Project Charter dan WBS disusun sesuai ruang lingkup.",
        "1 | J.620900.002.02 | Estimasi Jalur Kritis & Anggaran Proyek | Metode apa yang Anda gunakan untuk menentukan jalur kritis, alokasi tim teknis, dan baseline anggaran proyek TIK? | 2.2 Jadwal induk, RACI, dan rencana anggaran disepakati.",
        "2 | J.620900.003.02 | Pengendalian Change Request & Risiko Teknis | Saat muncul permintaan perubahan fitur di tengah sprint/produksi, bagaimana mekanisme Change Control Board dan penilaian dampaknya? | 3.1 Perubahan ruang lingkup dievaluasi dampak biaya, jadwal, dan risikonya.",
        "2 | J.620900.004.02 | Pengukuran Earned Value (EVM) & Serah Terima Proyek | Bagaimana Anda mengukur kinerja jadwal/biaya (SPI/CPI) serta memastikan Berita Acara Serah Terima (BAST) terdokumentasi? | 4.2 Laporan kinerja dan dokumen penutupan proyek disahkan sponsor.",
      ].join("\n"),
    );
    setField(
      "written06aQuestionsText",
      [
        "J.620900.001.02 | Jelaskan komponen wajib dalam Project Charter dan perbedaannya dengan Project Management Plan.",
        "J.620900.002.02 | Uraikan cara menghitung Earned Value (EV), Cost Performance Index (CPI), dan Schedule Performance Index (SPI).",
        "J.620900.002.02 | Bagaimana strategi crashing dan fast-tracking diterapkan saat proyek mengalami keterlambatan pada critical path?",
        "J.620900.003.02 | Jelaskan proses manajemen risiko proyek TIK mulai dari Risk Register hingga penetapan contingency reserve.",
        "J.620900.004.02 | Sebutkan tahapan formal administrative closure dan verifikasi deliverables sebelum penandatanganan BAST.",
      ].join("\n"),
    );
    setField(
      "interview09QuestionsText",
      [
        "J.620900.001.02 | Ceritakan proyek TIK terakhir yang Anda pimpin: bagaimana Anda menyepakati scope baseline dengan klien?",
        "J.620900.002.02 | Bagaimana Anda menangani konflik alokasi engineer senior yang dibutuhkan dua workstream bersamaan?",
        "J.620900.003.02 | Risiko teknis terbesar apa yang pernah terjadi di proyek Anda dan bagaimana mitigasi nyatanya?",
        "J.620900.004.02 | Bagaimana proses serah terima operasional dan dokumentasi lessons learned dilakukan bersama tim?",
      ].join("\n"),
    );
    setField("leftLogoUrl", "");
    setField("leftLogoAlt", "BNSP");
    setField("rightLogoUrl", "");
    setField("rightLogoAlt", "LSP TIK — ICT Project Manager");
    setForms(ICT_PM_SAMPLE_FORMS);
  };

  const handleAddFormRow = () => {
    const nextOrder = forms.length + 1;
    setForms((prev) => [
      ...prev,
      {
        rowId: `form-${Date.now()}-${nextOrder}`,
        formKey: "",
        formName: "",
        instrumentRole: "custom",
        required: true,
        sortOrder: nextOrder,
        filePatternsText: "",
      },
    ]);
  };

  const handleUpdateFormRow = (
    rowId: string,
    patch: Partial<EditableFormRow>,
  ) => {
    setForms((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  };

  const handleRemoveFormRow = (rowId: string) => {
    setForms((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const handleDirectBlankoUpload = async (row: EditableFormRow, file: File | null) => {
    if (!editingSchemeId || !row.formKey.trim() || !file) return;
    setUploadingKey(row.formKey);
    setFeedback(null);

    const fd = new FormData();
    fd.set("schemeId", editingSchemeId);
    fd.set("formKey", row.formKey.trim());
    fd.set("file", file);

    const res = await uploadSchemeFormBlankoAction(fd);
    setFeedback({
      ok: res.ok,
      text: res.ok
        ? `Blanko .docx untuk formulir ${row.formKey} berhasil diperbarui (${res.uploaded?.join(", ") || "versi baru"}).`
        : res.error || "Gagal mengunggah blanko.",
    });
    if (res.ok) {
      handleUpdateFormRow(row.rowId, {
        templateFileName: file.name,
        templateVersion: (row.templateVersion ?? 0) + 1,
      });
      router.refresh();
    }
    setUploadingKey(null);
  };

  const serializedFormsJson = JSON.stringify(
    forms.map((f, idx) => ({
      formKey: f.formKey.trim(),
      formName: f.formName.trim(),
      instrumentRole: f.instrumentRole,
      required: f.required,
      sortOrder: Number.isFinite(f.sortOrder) ? f.sortOrder : idx + 1,
      filePatterns: f.filePatternsText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    })),
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const fd = new FormData(e.currentTarget);
    fd.set("formsJson", serializedFormsJson);
    const res = await saveSchemeManifestAction(fd);
    const uploadedText =
      res.uploaded && res.uploaded.length > 0
        ? ` Blanko terunggah: ${res.uploaded.join(", ")}.`
        : "";
    setFeedback({
      ok: res.ok,
      text: res.ok
        ? `Manifes skema & registry formulir berhasil disimpan.${uploadedText}`
        : res.error || "Gagal menyimpan skema.",
    });
    if (res.ok) {
      if (res.schemeId) setEditingSchemeId(res.schemeId);
      router.refresh();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Existing Registered Schemes Cards with Edit & Clone Actions */}
      {existingSchemes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {existingSchemes.map((s) => {
            const uploadedBlankoCount = s.forms.filter(
              (f) => f.templateVersion > 0 && f.templateFileName,
            ).length;
            const total04bQuestions = (s.manifest.kelompokPekerjaan ?? []).reduce(
              (acc, kp) => acc + kp.aspects.length,
              0,
            );
            return (
              <div
                key={s.id}
                data-testid={`scheme-card-${s.code}`}
                className="glass-card rounded-2xl p-5 space-y-3 border border-slate-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      {s.code}
                    </span>
                    <span className="text-xs text-slate-500">
                      {s.forms.length} formulir · {uploadedBlankoCount} blanko .docx
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">v{s.version}</span>
                </div>

                <h3 className="font-semibold text-slate-900 leading-snug">{s.name}</h3>

                <p className="text-xs text-slate-600">
                  Aturan: <strong>{s.manifest.decisionRule || "-"}</strong> · Unit:{" "}
                  <strong>{resolveSchemeUnitsList(s).length}</strong> · Soal 04B:{" "}
                  <strong>
                    {total04bQuestions || s.manifest.questionCounts?.official04bCount || 0}
                  </strong>{" "}
                  · Soal 06A:{" "}
                  <strong>
                    {s.manifest.writtenQuestions?.length ||
                      s.manifest.questionCounts?.written06aCount ||
                      0}
                  </strong>
                </p>

                {s.forms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {s.forms.map((f) => (
                      <span
                        key={f.id || f.formKey}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                          f.templateVersion > 0
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                        title={
                          f.templateFileName
                            ? `Blanko: ${f.templateFileName} (v${f.templateVersion})`
                            : `Pola: ${f.filePatterns.join(", ")}`
                        }
                      >
                        {f.formKey}
                        {f.templateVersion > 0 ? ` · v${f.templateVersion}` : ""}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    data-testid={`edit-scheme-${s.code}`}
                    onClick={() => handleLoadScheme(s, false)}
                    className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-xs font-medium text-teal-800 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Skema &amp; Blanko
                  </button>
                  <button
                    type="button"
                    data-testid={`clone-scheme-${s.code}`}
                    onClick={() => handleLoadScheme(s, true)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Salin ke Skema Baru
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Scheme + Form Registry + Blanko + Questions Form */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="glass-card rounded-2xl p-6 space-y-6"
      >
        <input type="hidden" name="formsJson" value={serializedFormsJson} readOnly />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-900">
              {editingSchemeId
                ? "Edit Skema, Registry Formulir & Blanko (D17/D21)"
                : "Daftarkan Skema, Registry Formulir & Blanko Baru (D17/D21)"}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetEmpty}
              data-testid="reset-empty-scheme-btn"
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
            >
              Skema Baru (Kosong)
            </button>
            <button
              type="button"
              onClick={handleFillIctPmSample}
              data-testid="fill-ict-pm-sample-btn"
              className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-xs font-medium text-indigo-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Isi Contoh ICT Project Manager
            </button>
            <button
              type="button"
              onClick={handleFillAk3uSample}
              data-testid="fill-ak3u-sample-btn"
              className="px-3 py-1.5 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-xs font-medium text-teal-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Isi Contoh Skema AK3U
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Setiap skema memiliki himpunan formulir, pola klasifikasi berkas, template blanko{" "}
          <code>.docx</code> berversi, dan isi pertanyaan (FR.IA.04B, FR.IA.06A, FR.IA.09)
          masing-masing — tidak ada formulir atau soal AK3U yang dikunci untuk skema lain.
        </p>

        {feedback && (
          <div
            data-testid="scheme-feedback-banner"
            className={`p-3 rounded-xl text-xs border ${
              feedback.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Section 1: Metadata Skema */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kode Skema
            </label>
            <input
              name="code"
              required
              placeholder="Contoh: ICT-PM / PK3-MIGAS / AK3U"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Skema Sertifikasi (Sertakan Nomor Skema dalam Kurung bila Ada)
            </label>
            <input
              name="name"
              required
              placeholder="Contoh: Okupasi ICT Project Manager (SKM/1522/00008/2/2024/3)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jumlah Soal Resmi FR.IA.04B
            </label>
            <input
              name="official04bCount"
              type="number"
              min="0"
              defaultValue="1"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jumlah Soal Esai 06A
            </label>
            <input
              name="written06aCount"
              type="number"
              min="0"
              defaultValue="1"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jumlah Bank Soal Asesor
            </label>
            <input
              name="questionBankCount"
              type="number"
              min="0"
              defaultValue="1"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pemetaan Sufiks Soal
            </label>
            <input
              name="soalSuffix"
              defaultValue="06A"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pemetaan Sufiks Kunci
            </label>
            <input
              name="kunciSuffix"
              defaultValue="06B"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pemetaan Sufiks Jawaban
            </label>
            <input
              name="jawabanSuffix"
              defaultValue="06C"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Aturan Keputusan
            </label>
            <input
              name="decisionRule"
              defaultValue="VATM"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rujukan Dokumen Skema / SKKNI
            </label>
            <input
              name="decisionRuleRef"
              placeholder="Contoh: SKKNI Manajemen Proyek TIK (Kepmenaker No. 349 Tahun 2014)"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Prasyarat Pendaftaran (1 per baris)
            </label>
            <textarea
              name="prerequisites"
              rows={3}
              placeholder="Isi kombinasi pendidikan / pengalaman sesuai skema..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Persyaratan Dokumen (1 per baris)
            </label>
            <textarea
              name="registrationRequirements"
              rows={3}
              placeholder="KTP, Ijazah, CV, Portofolio..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unit Kompetensi (1 per baris: KODE | Judul Unit)
            </label>
            <textarea
              name="unitsText"
              rows={4}
              placeholder="J.620900.001.02 | Menyusun Perencanaan Proyek TIK"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kolom Matriks Dokumen Batch (pisahkan dengan koma)
            </label>
            <input
              name="docColumnsText"
              defaultValue="APL.01, APL.02, KTP, Ijazah, Pas Foto, CV, 04A, 06C"
              placeholder="APL.01, APL.02, KTP, Ijazah, CV, Portofolio, 04A, 06C"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Daftar unit kompetensi dan kolom kelengkapan disimpan ke manifes skema (D21).
            </p>
          </div>
        </div>

        {/* Section 2: Registry Formulir & Unggah Blanko .docx per Skema */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Registry Formulir &amp; Blanko <code>.docx</code> per Skema
              </h3>
              <p className="text-xs text-slate-500">
                Tambahkan, ubah, atau hapus formulir skema ini beserta pola nama file klasifikasi{" "}
                (<code>filePatterns</code>) dan unggah template blanko <code>.docx</code> berversi.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddFormRow}
              data-testid="add-scheme-form-row-btn"
              className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Formulir
            </button>
          </div>

          {forms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
              Daftar formulir masih kosong (tidak ada formulir bawaan yang dikunci). Klik{" "}
              <strong>Tambah Formulir</strong> untuk menambahkan formulir skema ini, atau gunakan
              tombol contoh/salin di atas.
            </div>
          ) : (
            <div className="space-y-3">
              {forms.map((row, idx) => (
                <div
                  key={row.rowId}
                  data-testid={`scheme-form-row-${row.formKey || idx}`}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kode (formKey)
                      </label>
                      <input
                        value={row.formKey}
                        onChange={(e) =>
                          handleUpdateFormRow(row.rowId, { formKey: e.target.value })
                        }
                        placeholder="ak02 / 04b / va"
                        required
                        data-testid={`form-key-input-${idx}`}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Formulir
                      </label>
                      <input
                        value={row.formName}
                        onChange={(e) =>
                          handleUpdateFormRow(row.rowId, { formName: e.target.value })
                        }
                        placeholder="FR.AK.02 — Rekaman Asesmen"
                        data-testid={`form-name-input-${idx}`}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Peran Instrumen
                      </label>
                      <select
                        value={row.instrumentRole}
                        onChange={(e) =>
                          handleUpdateFormRow(row.rowId, { instrumentRole: e.target.value })
                        }
                        data-testid={`form-role-select-${idx}`}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        {INSTRUMENT_ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Pola Nama File (pisahkan koma)
                      </label>
                      <input
                        value={row.filePatternsText}
                        onChange={(e) =>
                          handleUpdateFormRow(row.rowId, {
                            filePatternsText: e.target.value,
                          })
                        }
                        placeholder="ak02, rekaman asesmen"
                        required
                        data-testid={`form-patterns-input-${idx}`}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-center justify-end gap-1 pt-5">
                      <button
                        type="button"
                        onClick={() => handleRemoveFormRow(row.rowId)}
                        title="Hapus formulir"
                        data-testid={`remove-form-row-${idx}`}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.required}
                          onChange={(e) =>
                            handleUpdateFormRow(row.rowId, { required: e.target.checked })
                          }
                        />
                        <span>Wajib (required)</span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 text-slate-700">
                        <span>Urutan:</span>
                        <input
                          type="number"
                          min={0}
                          value={row.sortOrder}
                          onChange={(e) =>
                            handleUpdateFormRow(row.rowId, {
                              sortOrder: Number(e.target.value) || 0,
                            })
                          }
                          className="w-16 px-2 py-0.5 rounded border border-slate-300 text-xs font-mono"
                        />
                      </label>

                      {row.templateVersion && row.templateVersion > 0 ? (
                        <span
                          data-testid={`blanko-badge-${row.formKey || idx}`}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[11px]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Blanko Aktif: v{row.templateVersion} · {row.templateFileName}
                          {row.templateSha256
                            ? ` (${row.templateSha256.slice(0, 8)})`
                            : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <FileText className="w-3.5 h-3.5" />
                          Belum ada blanko .docx diunggah
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                        <Upload className="w-3.5 h-3.5 text-teal-700" />
                        <span>Blanko .docx:</span>
                        <input
                          type="file"
                          name={row.formKey ? `blankoFile_${row.formKey.trim()}` : undefined}
                          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          data-testid={`blanko-file-input-${row.formKey || idx}`}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (editingSchemeId && f && row.formKey.trim()) {
                              void handleDirectBlankoUpload(row, f);
                            }
                          }}
                          className="text-xs file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border file:border-teal-300 file:bg-teal-50 file:text-teal-800 file:text-xs file:font-medium"
                        />
                      </label>
                      {uploadingKey === row.formKey && (
                        <span className="text-[11px] text-teal-700 font-medium">
                          Mengunggah...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Isi Pertanyaan per Skema (04B, 06A, 09) */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Isi Pertanyaan &amp; Kelompok Pekerjaan per Skema (Bukan Konstanta Kode)
            </h3>
            <p className="text-xs text-slate-500">
              Simpan daftar pertanyaan resmi FR.IA.04B, bank soal tertulis FR.IA.06A, dan
              pertanyaan wawancara FR.IA.09 langsung di manifes skema ini.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pertanyaan Resmi FR.IA.04B &amp; Kelompok Pekerjaan (1 per baris: KP_NO | KODE_UNIT
              | Lingkup | Pertanyaan | KUK)
            </label>
            <textarea
              name="official04bQuestionsText"
              rows={4}
              data-testid="official-04b-questions-textarea"
              placeholder="1 | J.620900.001.02 | Penyusunan Project Charter & WBS | Bagaimana Anda menurunkan tujuan bisnis ke dalam Project Charter? | 1.1 Project Charter disusun sesuai lingkup."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank Soal Tertulis FR.IA.06A (1 per baris: KODE_UNIT | Pertanyaan)
              </label>
              <textarea
                name="written06aQuestionsText"
                rows={4}
                data-testid="written-06a-questions-textarea"
                placeholder="J.620900.001.02 | Jelaskan komponen wajib dalam Project Charter."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pertanyaan Wawancara FR.IA.09 (1 per baris: KODE_UNIT | Pertanyaan)
              </label>
              <textarea
                name="interview09QuestionsText"
                rows={4}
                data-testid="interview-09-questions-textarea"
                placeholder="J.620900.001.02 | Ceritakan proyek TIK terakhir yang Anda pimpin."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Branding & Logo per Skema */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Branding &amp; Logo Blanko per Skema / LSP
            </h3>
            <p className="text-xs text-slate-500">
              Skema non-AK3U tidak lagi otomatis mengambil logo <code>/templates/ak3u/</code>.
              Kosongkan URL logo untuk menampilkan lencana teks resmi LSP/skema.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Label Logo Kiri
              </label>
              <input
                name="leftLogoAlt"
                placeholder="BNSP"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                URL Logo Kiri (opsional)
              </label>
              <input
                name="leftLogoUrl"
                placeholder="https://... atau /path/logo.png"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Label Logo Kanan (LSP / Skema)
              </label>
              <input
                name="rightLogoAlt"
                placeholder="LSP TIK — ICT PM"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                URL Logo Kanan (opsional)
              </label>
              <input
                name="rightLogoUrl"
                placeholder="https://... atau /path/lsp-logo.png"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          data-testid="save-scheme-manifest-btn"
          className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium cursor-pointer"
        >
          {saving ? "Menyimpan Manifes & Blanko..." : "Simpan Skema, Registry Formulir & Blanko"}
        </button>
      </form>
    </div>
  );
}
