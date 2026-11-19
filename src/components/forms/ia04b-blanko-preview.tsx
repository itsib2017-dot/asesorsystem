import React from "react";
import { formatAk05DateIndonesia, formatAk05SchemeTitle } from "@/lib/ak05/format";
import { IA04B_KELOMPOK_PEKERJAAN } from "@/lib/forms/assessee-forms";
import type { SchemeKelompokSpec } from "@/repositories/schemes.repository";
import type { Ia04bExportPayload } from "@/services/export";
import {
  BlankoA4Sheet,
  BlankoDocxExportBar,
  BlankoMetadataTable,
  BlankoSheetFooter,
  BlankoSignatureBlock,
  BlankoTitleBar,
} from "@/components/forms/blanko-chrome";

export function Ia04bBlankoPreview(props: {
  batchId: string;
  assesseeId: string;
  hasActiveSignature: boolean;
  signatureUrl?: string;
  isNameConfirmed: boolean;
  kelompokPekerjaan?: SchemeKelompokSpec[];
  payload: Ia04bExportPayload;
}) {
  const { payload } = props;
  const kelompokList =
    props.kelompokPekerjaan && props.kelompokPekerjaan.length > 0
      ? props.kelompokPekerjaan
      : IA04B_KELOMPOK_PEKERJAAN;
  const displaySchemeTitle = formatAk05SchemeTitle(payload.schemeTitle);
  const displayDate = formatAk05DateIndonesia(payload.assessmentDate);
  const isK = payload.overallRecommendation === "K";
  const isBk = payload.overallRecommendation === "BK";

  return (
    <div className="space-y-4">
      <BlankoDocxExportBar
        batchId={props.batchId}
        assesseeId={props.assesseeId}
        formType="ia04b"
        formLabel="FR.IA.04B"
        caption="Pratinjau resmi sesuai blanko BNSP FR.IA.04B-2024 (tampilan tidak diubah dari dokumen asli)."
        hasActiveSignature={props.hasActiveSignature}
        isNameConfirmed={props.isNameConfirmed}
      />

      <BlankoA4Sheet className="space-y-3">
        <BlankoTitleBar
          code="FR.IA.04B."
          title="DIT – PENILAIAN PROYEK SINGKAT ATAU KEGIATAN TERSTRUKTUR LAINNYA"
        />

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
        </BlankoMetadataTable>

        <p className="text-[11px] italic">*Coret yang tidak perlu</p>

        {/* Official Table 2: PANDUAN BAGI ASESOR */}
        <table className="w-full text-[11px] border-collapse border border-black">
          <thead>
            <tr className="bg-[#92D050] font-bold">
              <th className="border border-black p-1.5 text-left">PANDUAN BAGI ASESOR</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 space-y-1 leading-snug">
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>
                    Lakukan penilaian pencapaian hasil proyek singkat atau kegiatan terstruktur
                    lainnya melalui presentasi.
                  </li>
                  <li>
                    Penilaian dilakukan sesuai dengan IA.04A. DIT – Daftar Instruksi Terstruktur
                    (Penjelasan Proyek Singkat / Kegiatan Terstruktur Lainnya).
                  </li>
                  <li>
                    Pertanyaan disampaikan oleh Asesor setelah Asesi melakukan presentasi proyek
                    singkat / kegiatan terstruktur lainnya.
                  </li>
                  <li>
                    Pertanyaan yang disampaikan untuk pemenuhan pencapaian 5 dimensi kompetensi.
                  </li>
                  <li>Berikan keputusan pencapaian berdasarkan kesimpulan jawaban Asesi.</li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Official Kelompok Pekerjaan & Aspect Evaluation Tables */}
        {kelompokList.map((kp, kpIdx) => {
          const kpOffset = kelompokList.slice(0, kpIdx).reduce(
            (sum, prev) => sum + prev.aspects.length,
            0,
          );
          return (
          <div key={kp.kpIndex} className="space-y-2">
            <table className="w-full text-[11px] border-collapse border border-black">
              <thead>
                <tr className="bg-[#92D050] font-bold">
                  <th className="border border-black p-1.5 w-[20%] text-left">{kp.title}</th>
                  <th className="border border-black p-1.5 w-[6%] text-center">No.</th>
                  <th className="border border-black p-1.5 w-[22%] text-left">Kode Unit</th>
                  <th className="border border-black p-1.5 text-left">Judul Unit</th>
                </tr>
              </thead>
              <tbody>
                {kp.units.map((u, uIdx) => (
                  <tr key={u.code}>
                    {uIdx === 0 && (
                      <td
                        rowSpan={kp.units.length}
                        className="border border-black p-1.5 align-middle"
                      />
                    )}
                    <td className="border border-black p-1 text-center">{u.no}.</td>
                    <td className="border border-black p-1 font-mono text-[10px]">{u.code}</td>
                    <td className="border border-black p-1">{u.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="w-full text-[11px] border-collapse border border-black">
              <thead>
                <tr className="font-bold">
                  <th colSpan={4} className="border border-black p-1.5 text-center">
                    Aspek Penilaian
                  </th>
                  <th colSpan={2} className="border border-black p-1.5 text-center">
                    Pencapaian
                  </th>
                </tr>
                <tr className="font-bold">
                  <th className="border border-black p-1 w-[5%] text-center">No.</th>
                  <th className="border border-black p-1 w-[21%] text-center">
                    Lingkup penyajian proyek atau kegiatan terstruktur lainnya
                  </th>
                  <th className="border border-black p-1 w-[31%] text-center">
                    Daftar Pertanyaan
                  </th>
                  <th className="border border-black p-1 w-[29%] text-center">
                    Kesesuaian dengan standar kompetensi kerja (unit/elemen/KUK)
                  </th>
                  <th className="border border-black p-1 w-[7%] text-center">Ya</th>
                  <th className="border border-black p-1 w-[7%] text-center">Tidak</th>
                </tr>
              </thead>
              <tbody>
                {kp.aspects.map((asp, aspIdx) => {
                  const achieved = payload.itemAchievedFlags[kpOffset + aspIdx] ?? null;
                  return (
                    <tr key={`${kp.kpIndex}-${asp.no}`}>
                      <td className="border border-black p-1 text-center align-top">{asp.no}.</td>
                      <td className="border border-black p-1.5 align-top">{asp.lingkup}</td>
                      <td className="border border-black p-1.5 align-top">
                        <span className="font-semibold">Pertanyaan: </span>
                        {asp.question}
                      </td>
                      <td className="border border-black p-1.5 align-top">{asp.kukRef}</td>
                      <td className="border border-black p-1 text-center text-sm align-middle">
                        {achieved === true ? "☑" : "☐"}
                      </td>
                      <td className="border border-black p-1 text-center text-sm align-middle">
                        {achieved === false ? "☑" : "☐"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          );
        })}

        {/* Official Table 11: Rekomendasi Asesor + Signature Block */}
        <BlankoSignatureBlock
          assesseeName={payload.assesseeName}
          assessorName={payload.assessorName}
          assessorRegNo={payload.assessorRegNo}
          displayDate={displayDate}
          hasActiveSignature={props.hasActiveSignature}
          signatureUrl={props.signatureUrl}
          topRow={
            <tr>
              <td className="border border-black p-1.5 font-bold align-top">
                Rekomendasi Asesor:
              </td>
              <td className="border border-black p-1.5 text-center align-top">:</td>
              <td className="border border-black p-1.5 align-top leading-snug">
                Asesi telah{" "}
                <span className={isK ? "font-semibold" : isBk ? "line-through" : ""}>
                  memenuhi
                </span>
                /{" "}
                <span className={isBk ? "font-semibold" : isK ? "line-through" : ""}>
                  belum memenuhi
                </span>{" "}
                pencapaian seluruh kriteria unjuk kerja, direkomendasikan:{" "}
                <span className="ml-1 font-semibold">{isK ? "☑" : "☐"} Kompeten</span>{" "}
                <span className="ml-2 font-semibold">{isBk ? "☑" : "☐"} Belum Kompeten</span>
              </td>
            </tr>
          }
        />

        <BlankoSheetFooter
          schemeTitle={displaySchemeTitle}
          formCode="FR.IA.04B-2024"
          pageNumber={1}
        />
      </BlankoA4Sheet>
    </div>
  );
}
