export type DitFailureCategory = "timeout" | "quota" | "config" | "input" | "unknown";

export function classifyDitFailure(rawError: string | null | undefined): DitFailureCategory {
  const text = (rawError ?? "").trim();
  if (!text) return "unknown";

  if (/melewati batas waktu|worker timeout|timed?\s*out|aborted due to timeout|\babort(?:ed)?\b/i.test(text)) {
    return "timeout";
  }
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
  if (/UNPROCESSABLE|bahan dit belum lengkap|lapisan teks|EXTRACTION_TIMEOUT|DRIVE_/i.test(text)) {
    return "input";
  }
  return "unknown";
}

const FAILURE_GUIDANCE: Record<DitFailureCategory, string> = {
  timeout:
    "Penyebab: model AI terlalu lama merespons untuk ukuran dokumen ini (bukan masalah kuota). Coba jalankan ulang, ringkas lampiran besar, atau pilih model yang lebih cepat di Pengaturan → Penyedia AI.",
  quota:
    "Penyebab: batas kuota atau kredit penyedia AI tercapai. Periksa saldo/kuota atau ganti kunci BYOK di Pengaturan → Penyedia AI lalu jalankan ulang.",
  config:
    "Penyebab: konfigurasi penyedia, model, atau kunci API BYOK belum valid. Periksa Pengaturan → Penyedia AI lalu jalankan ulang.",
  input:
    "Penyebab: berkas masukan DIT belum terbaca atau belum lengkap. Periksa berkas di Triage atau tempel teks bahan secara manual di bawah.",
  unknown:
    "Penyebab: respons model AI atau proses worker gagal diproses. Jalankan ulang analisis atau periksa detail error di atas.",
};

/**
 * Formats DIT worker failure messages with accurate, category-specific guidance
 * so timeouts are never misattributed to BYOK quota exhaustion.
 */
export function formatDitJobFailureMessage(
  jobId: string,
  rawError: string | null | undefined,
): string {
  const fullId = jobId?.trim() || "-";
  const detail = rawError?.trim() || "kesalahan worker.";
  const category = classifyDitFailure(rawError);
  return `Analisis DIT gagal (Job ${fullId}): ${detail} ${FAILURE_GUIDANCE[category]}`;
}
