import { describe, expect, it } from "vitest";
import {
  classifyWrittenFailure,
  formatWrittenJobFailureMessage,
} from "../format-written-error";

const FULL_JOB_ID = "88888888-4444-4444-8888-1234567890ab";

describe("formatWrittenJobFailureMessage & classifyWrittenFailure", () => {
  it("classifies empty structured output (Run 1 verbatim & chunked) separately from timeout and quota", () => {
    const rawRun1 = "Structured output validation failed after 2 attempts: No output generated.";
    expect(classifyWrittenFailure(rawRun1)).toBe("empty_output");

    const msgRun1 = formatWrittenJobFailureMessage(FULL_JOB_ID, rawRun1);
    expect(msgRun1).toContain(`Koreksi tertulis gagal (Job ${FULL_JOB_ID}):`);
    expect(msgRun1).toContain("tidak menghasilkan output JSON terstruktur");
    expect(msgRun1).toContain("bukan masalah kuota");
    expect(msgRun1).not.toContain("batas kuota atau kredit");
    expect(msgRun1).not.toContain("melewati batas waktu respons");

    const rawChunked =
      "Soal 5–8: Structured output validation failed after 2 attempts: No output generated.";
    expect(classifyWrittenFailure(rawChunked)).toBe("empty_output");
  });

  it("classifies LLM timeout (Run 2 verbatim) separately from empty_output and quota", () => {
    const rawRun2 =
      "Permintaan ke model AI (openai-compatible/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning) melewati batas waktu 102 detik (The operation was aborted due to timeout).";
    expect(classifyWrittenFailure(rawRun2)).toBe("timeout");

    const msg = formatWrittenJobFailureMessage(FULL_JOB_ID, rawRun2);
    expect(msg).toContain(`Koreksi tertulis gagal (Job ${FULL_JOB_ID}):`);
    expect(msg).toContain("melewati batas waktu respons");
    expect(msg).toContain("bukan masalah kuota");
    expect(msg).not.toContain("tidak menghasilkan output JSON terstruktur");
  });

  it("classifies quota errors wrapped in Structured output validation failed as quota, NOT empty_output", () => {
    const raw =
      "Structured output validation failed after 2 attempts: You've used today's Free usage. Add a usage pack.";
    expect(classifyWrittenFailure(raw)).toBe("quota");

    const msg = formatWrittenJobFailureMessage(FULL_JOB_ID, raw);
    expect(msg).toContain(`Job ${FULL_JOB_ID}`);
    expect(msg).toContain("batas kuota atau kredit penyedia AI tercapai");
    expect(msg).not.toContain("tidak menghasilkan output JSON terstruktur");
  });

  it("classifies BYOK config/model errors with config guidance", () => {
    const raw =
      "PROVIDER_NOT_CONFIGURED: Konfigurasi Penyedia AI (BYOK) belum diatur di Pengaturan → Penyedia AI.";
    expect(classifyWrittenFailure(raw)).toBe("config");

    const msg = formatWrittenJobFailureMessage(FULL_JOB_ID, raw);
    expect(msg).toContain("konfigurasi penyedia, model, atau kunci API BYOK belum valid");
  });

  it("classifies invalid master key 06B and empty student answer as input errors", () => {
    const rawKey =
      "INVALID_MASTER_KEY_06B: Dokumen terdeteksi blanko. Aktifkan kunci 06B kerja yang valid.";
    expect(classifyWrittenFailure(rawKey)).toBe("input");

    const rawEmpty = "Kunci jawaban atau lembar jawaban asesi masih kosong.";
    expect(classifyWrittenFailure(rawEmpty)).toBe("input");

    const msg = formatWrittenJobFailureMessage(FULL_JOB_ID, rawKey);
    expect(msg).toContain("kunci jawaban 06B atau lembar jawaban asesi 06C belum valid");
  });

  it("falls back safely on unknown or null errors and preserves full jobId", () => {
    expect(classifyWrittenFailure("Unexpected worker crash")).toBe("unknown");
    const msg = formatWrittenJobFailureMessage(FULL_JOB_ID, null);
    expect(msg).toContain(`Koreksi tertulis gagal (Job ${FULL_JOB_ID}): kesalahan worker.`);
    expect(msg).toContain("Jalankan ulang koreksi");
  });
});
