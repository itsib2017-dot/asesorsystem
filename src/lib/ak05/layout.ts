/**
 * Shared FR.AK.05-2024 official blanko layout constants used consistently
 * by React previews (`ak05-preview.tsx`, `blanko-chrome.tsx`) and `pdf-lib`
 * PDF generation (`src/services/export.ts`).
 */
export const AK05_LAYOUT = {
  formCode: "FR.AK.05-2024",
  minCandidateSlots: 12,
  maxPage1SlotsWhenOverflow: 24,
  pageSizeA4Pt: [595.28, 841.89] as [number, number],
  marginXPt: 54,
  rightEdgeXPt: 540,
  colors: {
    footerDividerHex: "#4472C4",
    footerDividerRgb: [68 / 255, 114 / 255, 196 / 255] as [number, number, number],
    pageBadgeHex: "#A8D08D",
    pageBadgeRgb: [168 / 255, 208 / 255, 141 / 255] as [number, number, number],
    tableHeaderGreenHex: "#92D050",
    tableHeaderGreenRgb: [146 / 255, 208 / 255, 80 / 255] as [number, number, number],
  },
  metadataColWidthsPt: [128, 50, 14, 294] as const,
  candidateColWidthsPt: [34, 179, 40, 40, 193] as const,
  assessorBlockColWidthsPt: [256, 78, 152] as const,
  footnoteAsterisk: "*Coret yang tidak perlu",
  footnoteKeterangan:
    "**Tuliskan Kode dan Judul Unit Kompetensi yang dinyatakan BK bila mengases satu skema",
  noteRowLabels: {
    positiveNegative: "Aspek Negatif dan Positif dalam asesmen",
    rejection: "Pencatatan penolakan hasil asesmen",
    improvement: "Saran perbaikan (Asesor/personil terkait)",
  },
} as const;
