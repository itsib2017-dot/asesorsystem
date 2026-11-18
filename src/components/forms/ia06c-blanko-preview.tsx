import React from "react";
import { formatAk05DateIndonesia, formatAk05SchemeTitle } from "@/lib/ak05/format";
import type { Ia06cExportPayload } from "@/services/export";
import {
  BlankoDocxExportBar,
  BlankoMetadataTable,
  BlankoSignatureBlock,
  BlankoTitleBar,
} from "@/components/forms/blanko-chrome";

export function Ia06cBlankoPreview(props: {
  batchId: string;
  assesseeId: string;
  hasActiveSignature: boolean;
  signatureUrl?: string;
  isNameConfirmed: boolean;
  payload: Ia06cExportPayload;
}) {
  const { payload } = props;
  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);
  const totalSlots = Math.max(13, payload.answers.length);

  return (
    <div className="space-y-4">
      <BlankoDocxExportBar
        batchId={props.batchId}
        assesseeId={props.assesseeId}
        formType="ia06"
        formLabel="FR.IA.06C"
        caption="Pratinjau resmi sesuai blanko BNSP FR.IA.06C-2024 (tampilan tidak diubah dari dokumen asli)."
        hasActiveSignature={props.hasActiveSignature}
        isNameConfirmed={props.isNameConfirmed}
      />

      <div className="bg-white border border-slate-300 shadow-sm text-black max-w-[794px] mx-auto px-10 py-8 flex flex-col space-y-2.5">
        <BlankoTitleBar code="FR.IA.06C." title="LEMBAR JAWABAN PERTANYAAN TERTULIS ESAI" />

        <BlankoMetadataTable
          schemeTitle={displaySchemeTitle}
          schemeNumber={payload.schemeNumber}
          tukType={payload.tukType}
          assessorName={payload.assessorName}
          assesseeName={payload.assesseeName}
        >
          <tr>
            <td colSpan={2} className="border border-black p-1.5">
              Tanggal
            </td>
            <td className="border border-black p-1.5 text-center">:</td>
            <td className="border border-black p-1.5">{displayDate}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black p-1.5">
              Waktu
            </td>
            <td className="border border-black p-1.5 text-center">:</td>
            <td className="border border-black p-1.5">{payload.durationText || "60 Menit"}</td>
          </tr>
        </BlankoMetadataTable>

        <p className="text-[11px] italic">*Coret yang tidak perlu</p>

        {/* Official Table 2: Jawaban + Pencapaian (Ya/Tidak) */}
        <table className="w-full text-[11px] border-collapse border border-black">
          <thead>
            <tr className="bg-[#92D050] font-bold">
              <th rowSpan={2} className="border border-black p-1.5 text-left w-[84%]">
                Jawaban:
              </th>
              <th colSpan={2} className="border border-black p-1 text-center">
                Pencapaian
              </th>
            </tr>
            <tr className="bg-[#92D050] font-bold">
              <th className="border border-black p-1 w-[8%] text-center">Ya</th>
              <th className="border border-black p-1 w-[8%] text-center">Tidak</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalSlots }).map((_, idx) => {
              const ans = payload.answers[idx];
              return (
                <tr key={idx}>
                  <td className="border border-black p-1.5 align-top">
                    <span className="font-semibold mr-1.5">{idx + 1}.</span>
                    <span>{ans?.answerText ?? ""}</span>
                  </td>
                  <td className="border border-black p-1 text-center text-sm align-middle">
                    {ans?.achieved === true ? "☑" : "☐"}
                  </td>
                  <td className="border border-black p-1 text-center text-sm align-middle">
                    {ans?.achieved === false ? "☑" : "☐"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Official Table 3: Umpan balik untuk Asesi */}
        <table className="w-full text-xs border-collapse border border-black">
          <tbody>
            <tr>
              <td className="border border-black p-1.5 w-[32%] font-semibold">
                Umpan balik untuk Asesi
              </td>
              <td className="border border-black p-1.5 w-[3%] text-center">:</td>
              <td className="border border-black p-1.5 leading-snug">
                Aspek pengetahuan seluruh unit pada kelompok pekerjaan yang diujikan (
                <span className={payload.overallAchieved ? "font-semibold" : "line-through"}>
                  tercapai
                </span>
                /
                <span className={!payload.overallAchieved ? "font-semibold" : "line-through"}>
                  belum tercapai
                </span>
                )*
                {payload.feedbackDetail && (
                  <div className="mt-1 text-[11px]">
                    Catatan unit/elemen/KUK: {payload.feedbackDetail}
                  </div>
                )}
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
      </div>
    </div>
  );
}
