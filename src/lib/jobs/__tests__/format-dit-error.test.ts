import { describe, expect, it } from "vitest";
import { classifyDitFailure, formatDitJobFailureMessage } from "../format-dit-error";

describe("formatDitJobFailureMessage & classifyDitFailure", () => {
  it("classifies LLM timeout separately and states it is NOT a quota issue", () => {
    const msg = formatDitJobFailureMessage(
      "ad17a9fc-3459-430e-a6a8-f7d52832fdce",
      "Permintaan ke model AI (openai-compatible/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning) melewati batas waktu 220 detik (The operation was aborted due to timeout).",
    );

    expect(msg).toContain("Analisis DIT gagal (Job ad17a9fc-3459-430e-a6a8-f7d52832fdce):");
    expect(msg).toContain("bukan masalah kuota");
    expect(msg).toContain("model yang lebih cepat");
    expect(msg).not.toContain("batas kuota atau kredit");
    expect(msg).not.toContain("Periksa kuota/mode BYOK");
  });

  it("classifies quota/billing errors with quota guidance", () => {
    const raw =
      "Structured output validation failed after 2 attempts: You've used today's Free usage. Add a usage pack.";
    expect(classifyDitFailure(raw)).toBe("quota");

    const msg = formatDitJobFailureMessage("6688fde7-07f4-48d3-be50-8b43f20a1670", raw);
    expect(msg).toContain("Analisis DIT gagal (Job 6688fde7-07f4-48d3-be50-8b43f20a1670):");
    expect(msg).toContain("batas kuota atau kredit penyedia AI tercapai");
  });

  it("classifies BYOK config/model errors with config guidance", () => {
    const raw =
      "PROVIDER_NOT_CONFIGURED: Konfigurasi Penyedia AI (BYOK) belum diatur di Pengaturan → Penyedia AI.";
    expect(classifyDitFailure(raw)).toBe("config");

    const msg = formatDitJobFailureMessage("1e644c04-2472-4347-869c-353f1b9027b2", raw);
    expect(msg).toContain("konfigurasi penyedia, model, atau kunci API BYOK belum valid");
  });

  it("classifies input/extraction failures with Triage/manual input guidance", () => {
    const raw =
      "UNPROCESSABLE: Bahan DIT belum lengkap setelah ekstraksi (Profil Kandidat (CV)) (CV_Scan.pdf: tidak memiliki lapisan teks)";
    expect(classifyDitFailure(raw)).toBe("input");

    const msg = formatDitJobFailureMessage("abc12345-0000-0000-0000-000000000000", raw);
    expect(msg).toContain("Periksa berkas di Triage atau tempel teks bahan secara manual");
  });

  it("falls back safely on unknown worker errors", () => {
    expect(classifyDitFailure("Unexpected JSON parse exception")).toBe("unknown");
    const msg = formatDitJobFailureMessage("def67890-0000-0000-0000-000000000000", null);
    expect(msg).toContain("Analisis DIT gagal (Job def67890-0000-0000-0000-000000000000): kesalahan worker.");
    expect(msg).toContain("Jalankan ulang analisis");
  });
});
