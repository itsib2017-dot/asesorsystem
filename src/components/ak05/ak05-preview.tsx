import React from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Download } from "lucide-react";
import {
  formatAk05DateIndonesia,
  formatAk05SchemeTitle,
} from "@/lib/ak05/format";

interface Ak05PreviewProps {
  batchId: string;
  schemeTitle: string;
  schemeNumber: string;
  tukName?: string;
  tukType: string;
  assessorName: string;
  assessorRegNo: string;
  assessmentDate: string;
  hasActiveSignature: boolean;
  signatureUrl?: string;
  unconfirmedNamesCount: number;
  rows: Array<{
    no: number;
    assesseeName: string;
    recommendation: "K" | "BK" | "-";
    keterangan: string;
  }>;
  notesPositiveNegative: string;
  notesRejection: string;
  notesImprovement: string;
}

function BlankoSheetHeader() {
  return (
    <div className="flex items-center justify-between gap-4 pb-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/templates/ak3u/bnsp-logo.png"
        alt="BNSP"
        className="h-10 w-auto object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/templates/ak3u/lsp-logo.png"
        alt="LSP K3 Nasional"
        className="h-11 w-auto object-contain"
      />
    </div>
  );
}

function BlankoSheetFooter({
  schemeTitle,
  pageNumber,
}: {
  schemeTitle: string;
  pageNumber: number;
}) {
  return (
    <div className="pt-6 mt-auto">
      <div className="border-t-2 border-[#4472C4] pt-2 flex items-center justify-between text-[10px] text-slate-800">
        <span className="tracking-tight">{schemeTitle}</span>
        <div className="flex items-center gap-2">
          <span>FR.AK.05-2024</span>
          <span className="inline-flex items-center justify-center w-5 h-5 bg-[#A8D08D] text-white font-bold text-[11px]">
            {pageNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Ak05Preview(props: Ak05PreviewProps) {
  const blocked = !props.hasActiveSignature || props.unconfirmedNamesCount > 0;
  const displaySchemeTitle = formatAk05SchemeTitle(props.schemeTitle);
  const displayDate = formatAk05DateIndonesia(props.assessmentDate);
  const totalSlots = Math.max(12, props.rows.length);

  const notesTable = (
    <table className="w-full text-xs border-collapse border border-black">
      <tbody>
        <tr>
          <td className="border border-black bg-[#92D050] p-2 w-1/3 align-top">
            Aspek Negatif dan Positif dalam asesmen
          </td>
          <td className="border border-black p-2 align-top">
            {props.notesPositiveNegative || "-"}
          </td>
        </tr>
        <tr>
          <td className="border border-black bg-[#92D050] p-2 align-top">
            Pencatatan penolakan hasil asesmen
          </td>
          <td className="border border-black p-2 align-top">
            {props.notesRejection || "-"}
          </td>
        </tr>
        <tr>
          <td className="border border-black bg-[#92D050] p-2 align-top">
            Saran perbaikan (Asesor/personil terkait)
          </td>
          <td className="border border-black p-2 align-top">
            {props.notesImprovement || "-"}
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="space-y-6">
      {/* Blocker Warning Banner */}
      {blocked && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            Penyerahan &amp; Ekspor FR.AK.05 Terkunci
          </div>
          <ul className="list-disc pl-6 text-xs space-y-1">
            {!props.hasActiveSignature && (
              <li>
                Tanda tangan belum diunggah.{" "}
                <Link href="/settings/profile" className="underline font-semibold">
                  Unggah Tanda Tangan
                </Link>
              </li>
            )}
            {props.unconfirmedNamesCount > 0 && (
              <li>
                Terdapat {props.unconfirmedNamesCount} asesi yang belum memiliki konfirmasi nama sertifikat (otoritas KTP).
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Action Buttons: Export Rule D8 — ONLY AK.05 offers PDF + DOCX */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Pratinjau resmi sesuai blanko BNSP FR.AK.05-2024 (tampilan tidak diubah dari dokumen asli).
        </div>
        <div className="flex gap-2">
          <a
            href={blocked ? undefined : `/api/v1/batches/${props.batchId}/ak05/export?format=pdf`}
            aria-disabled={blocked}
            className={`px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2 ${
              blocked
                ? "bg-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                : "bg-teal-700 hover:bg-teal-800 text-white shadow-sm"
            }`}
          >
            <Download className="w-4 h-4" /> Ekspor PDF
          </a>
          <a
            href={blocked ? undefined : `/api/v1/batches/${props.batchId}/ak05/export?format=docx`}
            aria-disabled={blocked}
            className={`px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2 border ${
              blocked
                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                : "bg-white hover:bg-slate-50 border-slate-300 text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" /> Ekspor DOCX
          </a>
        </div>
      </div>

      {/* Sheet 1: Faithful Official Blanko FR.AK.05 Page 1 */}
      <div className="bg-white border border-slate-300 shadow-sm text-black max-w-[794px] mx-auto px-10 py-8 flex flex-col space-y-2.5">
        <BlankoSheetHeader />

        {/* Borderless Table 0: FR.AK.05.   LAPORAN ASESMEN */}
        <div className="flex items-baseline gap-6 text-sm font-bold pb-1">
          <span>FR.AK.05.</span>
          <span>LAPORAN ASESMEN</span>
        </div>

        {/* Table 1: Metadata Grid (Skema, TUK, Nama Asesor, Tanggal) */}
        <table className="w-full text-xs border-collapse border border-black">
          <tbody>
            <tr>
              <td
                rowSpan={2}
                className="border border-black p-1.5 w-[27%] align-middle leading-snug"
              >
                <div>Skema Sertifikasi</div>
                <div>(KKNI/Okupasi/Klaster)</div>
              </td>
              <td className="border border-black p-1.5 w-[11%]">Judul</td>
              <td className="border border-black p-1.5 w-[3%] text-center">:</td>
              <td className="border border-black p-1.5 font-bold">{displaySchemeTitle}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5">Nomor</td>
              <td className="border border-black p-1.5 text-center">:</td>
              <td className="border border-black p-1.5 font-bold">{props.schemeNumber}</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black p-1.5">
                TUK
              </td>
              <td className="border border-black p-1.5 text-center">:</td>
              <td className="border border-black p-1.5">
                <span className={props.tukType === "sewaktu" ? "" : "line-through"}>
                  Sewaktu
                </span>
                <span>/</span>
                <span className={props.tukType === "tempat_kerja" ? "" : "line-through"}>
                  Tempat Kerja
                </span>
                <span>/</span>
                <span className={props.tukType === "mandiri" ? "" : "line-through"}>
                  Mandiri*
                </span>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black p-1.5">
                Nama Asesor
              </td>
              <td className="border border-black p-1.5 text-center">:</td>
              <td className="border border-black p-1.5">{props.assessorName}</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black p-1.5">
                Tanggal
              </td>
              <td className="border border-black p-1.5 text-center">:</td>
              <td className="border border-black p-1.5">{displayDate}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-[11px] italic">*Coret yang tidak perlu</p>

        {/* Table 2: Candidate Recommendations Grid (#92D050 Green Header) */}
        <table className="w-full text-xs border-collapse border border-black">
          <thead>
            <tr className="bg-[#92D050] font-bold">
              <th rowSpan={2} className="border border-black p-1.5 w-[7%] text-center">
                No.
              </th>
              <th rowSpan={2} className="border border-black p-1.5 w-[37%] text-center">
                Nama Asesi
              </th>
              <th colSpan={2} className="border border-black p-1 text-center">
                Rekomendasi
              </th>
              <th rowSpan={2} className="border border-black p-1.5 w-[40%] text-center">
                Keterangan**
              </th>
            </tr>
            <tr className="bg-[#92D050] font-bold">
              <th className="border border-black py-1 w-[8%] text-center">K</th>
              <th className="border border-black py-1 w-[8%] text-center">BK</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalSlots }).map((_, i) => {
              const r = props.rows[i];
              return (
                <tr key={i}>
                  <td className="border border-black py-1 px-2 text-center">{i + 1}.</td>
                  <td className="border border-black py-1 px-2">{r?.assesseeName ?? ""}</td>
                  <td className="border border-black py-1 text-center text-sm leading-none">
                    {r ? (r.recommendation === "K" ? "☑" : "☐") : ""}
                  </td>
                  <td className="border border-black py-1 text-center text-sm leading-none">
                    {r ? (r.recommendation === "BK" ? "☑" : "☐") : ""}
                  </td>
                  <td className="border border-black py-1 px-2">{r?.keterangan ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="text-[11px] italic">
          **Tuliskan Kode dan Judul Unit Kompetensi yang dinyatakan BK bila mengases satu skema
        </p>

        {/* Table 3 on Page 1 matching official FR.AK.05 */}
        {notesTable}

        <BlankoSheetFooter schemeTitle={displaySchemeTitle} pageNumber={1} />
      </div>

      {/* Sheet 2: Faithful Official Blanko FR.AK.05 Page 2 (Table 4 Assessor Block) */}
      <div className="bg-white border border-slate-300 shadow-sm text-black max-w-[794px] mx-auto px-10 py-8 min-h-[680px] flex flex-col">
        <BlankoSheetHeader />

        <table className="w-full text-xs border-collapse border border-black mt-2">
          <tbody>
            <tr>
              <td rowSpan={4} className="border border-black p-2 w-[53%] align-top font-bold">
                Catatan :
              </td>
              <td colSpan={2} className="border border-black p-1.5 font-bold">
                Asesor :
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 w-[16%]">Nama</td>
              <td className="border border-black p-1.5">{props.assessorName}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5">No. Reg</td>
              <td className="border border-black p-1.5">{props.assessorRegNo}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 align-middle">
                <div>Tanda tangan</div>
                <div>&amp; tanggal</div>
              </td>
              <td className="border border-black p-2 text-center">
                <div className="h-16 flex items-center justify-center">
                  {props.hasActiveSignature && props.signatureUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={props.signatureUrl}
                      alt="Tanda tangan asesor"
                      className="max-h-14 w-auto object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-amber-700 italic">
                      [Tanda tangan belum diunggah]
                    </span>
                  )}
                </div>
                <div className="mt-1">{displayDate}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <BlankoSheetFooter schemeTitle={displaySchemeTitle} pageNumber={2} />
      </div>
    </div>
  );
}
