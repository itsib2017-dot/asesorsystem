import React from "react";
import { formatAk05DateIndonesia, formatAk05SchemeTitle } from "@/lib/ak05/format";
import type { Ak02ExportPayload, Ak02EvidenceType } from "@/services/export";
import {
  BlankoDocxExportBar,
  BlankoMetadataTable,
  BlankoSheetFooter,
  BlankoSheetHeader,
  BlankoSignatureBlock,
  BlankoTitleBar,
} from "@/components/forms/blanko-chrome";

const EVIDENCE_COLUMNS: Array<{ key: Ak02EvidenceType; label: string }> = [
  { key: "observasi", label: "Observasi Demonstrasi" },
  { key: "portofolio", label: "Portofolio" },
  { key: "pihak_ketiga", label: "Pernyataan Pihak Ketiga, Pertanyaan Wawancara" },
  { key: "lisan", label: "Pertanyaan Lisan" },
  { key: "tertulis", label: "Pertanyaan Tertulis" },
  { key: "proyek", label: "Proyek Kerja" },
  { key: "lainnya", label: "Lainnya" },
];

export function Ak02BlankoPreview(props: {
  batchId: string;
  assesseeId: string;
  hasActiveSignature: boolean;
  signatureUrl?: string;
  isNameConfirmed: boolean;
  payload: Ak02ExportPayload;
}) {
  const { payload } = props;
  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);
  const displayEndDate = formatAk05DateIndonesia(payload.endDate ?? payload.assessmentDate);

  return (
    <div className="space-y-4">
      <BlankoDocxExportBar
        batchId={props.batchId}
        assesseeId={props.assesseeId}
        formType="ak02"
        formLabel="FR.AK.02"
        caption="Pratinjau resmi sesuai blanko BNSP FR.AK.02-2024 (tampilan tidak diubah dari dokumen asli)."
        hasActiveSignature={props.hasActiveSignature}
        isNameConfirmed={props.isNameConfirmed}
      />

      <div className="bg-white border border-slate-300 shadow-sm text-black max-w-[794px] mx-auto px-10 py-8 flex flex-col space-y-2.5">
        <BlankoSheetHeader />
        <BlankoTitleBar code="FR.AK.02." title="REKAMAN ASESMEN KOMPETENSI" />

        <BlankoMetadataTable
          schemeTitle={displaySchemeTitle}
          schemeNumber={payload.schemeNumber}
          tukType={payload.tukType}
          assessorName={payload.assessorName}
          assesseeName={payload.assesseeName}
        >
          <tr>
            <td rowSpan={2} className="border border-black p-1.5 align-middle">
              Tanggal Asesmen
            </td>
            <td className="border border-black p-1.5">Mulai</td>
            <td className="border border-black p-1.5 text-center">:</td>
            <td className="border border-black p-1.5">{displayDate}</td>
          </tr>
          <tr>
            <td className="border border-black p-1.5">Selesai</td>
            <td className="border border-black p-1.5 text-center">:</td>
            <td className="border border-black p-1.5">{displayEndDate}</td>
          </tr>
        </BlankoMetadataTable>

        <p className="text-[11px] italic">*Coret yang tidak perlu</p>

        <table className="w-full text-[11px] border-collapse border border-black">
          <thead>
            <tr className="bg-[#92D050] font-bold">
              <th className="border border-black p-1.5 text-left w-[45%]">Unit Kompetensi</th>
              {EVIDENCE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="border border-black p-1 text-center font-bold align-middle text-[10px] leading-tight"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payload.unitDecisions.map((unit, idx) => {
              const evSet = new Set(unit.evidenceTypes);
              return (
                <tr key={idx}>
                  <td className="border border-black py-1 px-1.5">{unit.unitTitle}</td>
                  {EVIDENCE_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className="border border-black py-1 text-center text-sm leading-none"
                    >
                      {evSet.has(col.key) ? "☑" : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td className="border border-black p-1.5 font-semibold">
                Rekomendasi hasil asesmen
              </td>
              <td colSpan={7} className="border border-black p-1.5 font-semibold">
                <span className="mr-3">
                  {payload.overallRecommendation === "K" ? "☑" : "☐"} Kompeten
                </span>
                <span>/ </span>
                <span className="ml-2">
                  {payload.overallRecommendation === "BK" ? "☑" : "☐"} Belum Kompeten
                </span>
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 align-top">
                Tindak lanjut yang dibutuhkan (Masukkan pekerjaan tambahan dan asesmen yang
                diperlukan untuk mencapai kompetensi)
              </td>
              <td colSpan={7} className="border border-black p-1.5 align-top">
                {payload.followUpNote || "-"}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 align-top">
                Komentar / Observasi oleh Asesor
              </td>
              <td colSpan={7} className="border border-black p-1.5 align-top">
                {payload.assessorComment || "-"}
              </td>
            </tr>
          </tbody>
        </table>

        <BlankoSignatureBlock
          assesseeName={payload.assesseeName}
          assessorName={payload.assessorName}
          assessorRegNo={payload.assessorRegNo}
          displayDate={displayDate}
          hasActiveSignature={props.hasActiveSignature}
          signatureUrl={props.signatureUrl}
        />

        <BlankoSheetFooter
          schemeTitle={displaySchemeTitle}
          formCode="FR.AK.02-2024"
          pageNumber={1}
        />
      </div>
    </div>
  );
}
