export type WrittenFailureCategory =
  | "empty_output"
  | "timeout"
  | "quota"
  | "config"
  | "input"
  | "unknown";

/**
 * Classifies written grading (06C) worker failures with strict priority so
 * quota/billing errors wrapped inside "Structured output validation failed..."
 * are never misclassified as empty_output.
 */
export function classifyWrittenFailure(
  rawError: string | null | undefined,
): WrittenFailureCategory {
  const text = (rawError ?? "").trim();
  if (!text) return "unknown";

  if (/free usage|quota|insufficient_quota|billing|credit|saldo|rate[\s_-]*limit|\b429\b/i.test(text)) {
    return "quota";
  }
  if (
    /PROVIDER_NOT_CONFIGURED|not available|invalid api key|unauthorized|\b401\b|\b403\b|penyedia ai \(byok\)/i.test(
      text,
    )
  ) {
    return "config";
  }
  if (/melewati batas waktu|worker timeout|timed?\s*out|aborted due to timeout|\babort(?:ed)?\b/i.test(text)) {
    return "timeout";
  }
  if (
    /no output generated|tidak menghasilkan vonis|structured output validation failed|failed to generate object|zoderror/i.test(
      text,
    )
  ) {
    return "empty_output";
  }
  if (
    /INVALID_MASTER_KEY_06B|kunci jawaban|lembar jawaban|UNPROCESSABLE|lapisan teks|EXTRACTION_TIMEOUT|DRIVE_/i.test(
      text,
    )
  ) {
    return "input";
  }
  return "unknown";
}

const FAILURE_GUIDANCE: Record<WrittenFailureCategory, string> = {
  empty_output:
    "Penyebab: model AI tidak menghasilkan output JSON terstruktur untuk koreksi soal ini (bukan masalah kuota atau kunci 06B rusak). Coba jalankan ulang koreksi atau pilih model non-reasoning/lebih stabil di Pengaturan → Penyedia AI.",
  timeout:
    "Penyebab: model AI melewati batas waktu respons (bukan masalah kuota). Coba jalankan ulang koreksi atau pilih model yang lebih cepat di Pengaturan → Penyedia AI.",
  quota:
    "Penyebab: batas kuota atau kredit penyedia AI tercapai. Periksa saldo/kuota atau ganti kunci BYOK di Pengaturan → Penyedia AI lalu jalankan ulang.",
  config:
    "Penyebab: konfigurasi penyedia, model, atau kunci API BYOK belum valid. Periksa Pengaturan → Penyedia AI lalu jalankan ulang.",
  input:
    "Penyebab: kunci jawaban 06B atau lembar jawaban asesi 06C belum valid atau masih kosong. Pastikan kunci 06B aktif dan teks jawaban 06C tersedia.",
  unknown:
    "Penyebab: respons model AI atau proses worker gagal diproses. Jalankan ulang koreksi atau periksa detail error di atas.",
};

/**
 * Formats written grading failure messages with full Job ID (for log correlation)
 * and distinct guidance for empty structured outputs vs timeouts vs quota.
 */
export function formatWrittenJobFailureMessage(
  jobId: string,
  rawError: string | null | undefined,
): string {
  const fullId = jobId?.trim() || "-";
  const detail = rawError?.trim() || "kesalahan worker.";
  const category = classifyWrittenFailure(rawError);
  return `Koreksi tertulis gagal (Job ${fullId}): ${detail} ${FAILURE_GUIDANCE[category]}`;
}
