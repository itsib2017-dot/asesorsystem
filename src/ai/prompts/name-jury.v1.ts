import { buildJuryPayload, type JuryInputPayload } from "../redact";

export const NAME_JURY_PROMPT_META = {
  key: "name-jury",
  version: "v1.0.0",
  sourceSha256: "ktp-authoritative-name-jury-v1",
} as const;

export function buildNameJuryPrompt(rawInput: JuryInputPayload): string {
  // Strict allow-list: only the 4 name strings + OCR confidence (no NIK, address, phone, or image)
  const payload = buildJuryPayload(rawInput);

  return `Anda adalah Juri Verifikasi Nama Sertifikat BNSP.
ATURAN MUTLAK:
1. KTP adalah otoritas utama ejaan nama sertifikat.
2. Bandingkan 4 sumber nama berikut:
   - KTP (hasil OCR lokal): "${payload.name_ktp_ocr}"
   - FR.APL.01: "${payload.name_apl01}"
   - Surat Tugas: "${payload.name_surat_tugas}"
   - Ijazah: "${payload.name_ijazah}"
   - Tingkat keyakinan OCR KTP: ${payload.ocr_confidence} (batas minimum konfigurasi: ${payload.ocr_confidence_floor})
3. Aturan putusan (verdict):
   - Jika ocr_confidence < ${payload.ocr_confidence_floor}, atau nama KTP kosong/tidak terbaca: WAJIB kembalikan "needs_human" dan proposed_certificate_name = null. Jangan pernah menebak ejaan KTP dari sumber lain!
   - Jika semua sumber cocok (mengabaikan variasi singkatan gelar/tanda baca ringan): kembalikan "match" dan proposed_certificate_name = null.
   - Jika terdapat ketidaksesuaian atau singkatan (mis. "Declan Rice P." vs KTP "Declan Rice Pangabean"): kembalikan "mismatch_resolved" dengan proposed_certificate_name = EJAAN KTP PERSIS (verbatim). Jangan mengarang nama baru.
4. Tulis reasoning dalam Bahasa Indonesia sebagai "usulan nama — perlu konfirmasi asesor", kutip evidence span untuk keempat sumber, dan laporkan ocr_confidence = ${payload.ocr_confidence}.`;
}
