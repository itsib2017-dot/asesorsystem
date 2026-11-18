import React from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Download } from "lucide-react";

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

export function Ak05Preview(props: Ak05PreviewProps) {
  const blocked = !props.hasActiveSignature || props.unconfirmedNamesCount > 0;

  return (
    <div className="space-y-6">
      {/* Blocker Warning Banner */}
      {blocked && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            Penyerahan & Ekspor FR.AK.05 Terkunci
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
          Pratinjau resmi sesuai blanko BNSP FR.AK.05 (rekomendasi ke TUK/LSP, bukan penerbitan sertifikat).
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

      {/* Print-Faithful FR.AK.05 Frame */}
      <div className="bg-white border border-slate-300 rounded-xl p-8 shadow-sm text-slate-900 space-y-5">
        <div className="border-b-2 border-slate-900 pb-3">
          <h2 className="text-lg font-bold">FR.AK.05. LAPORAN ASESMEN</h2>
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            <div>Skema Sertifikasi: <strong>{props.schemeTitle}</strong></div>
            <div>Nomor: <strong>{props.schemeNumber}</strong></div>
            <div>
              TUK:{" "}
              <span className={props.tukType === "sewaktu" ? "font-bold" : "line-through text-slate-400"}>
                Sewaktu
              </span>
              /
              <span className={props.tukType === "tempat_kerja" ? "font-bold" : "line-through text-slate-400"}>
                Tempat Kerja
              </span>
              /
              <span className={props.tukType === "mandiri" ? "font-bold" : "line-through text-slate-400"}>
                Mandiri*
              </span>
              {props.tukName && props.tukName !== "-" ? (
                <span className="ml-1.5 font-semibold text-slate-700">— {props.tukName}</span>
              ) : null}
            </div>
            <div>Tanggal: <strong>{props.assessmentDate}</strong></div>
            <div>Nama Asesor: <strong>{props.assessorName}</strong></div>
            <div>No. Reg MET: <strong>{props.assessorRegNo}</strong></div>
          </div>
        </div>

        <table className="w-full text-xs border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 p-2 w-10 text-center">No.</th>
              <th className="border border-slate-400 p-2 text-left">Nama Asesi</th>
              <th className="border border-slate-400 p-2 w-20 text-center">K</th>
              <th className="border border-slate-400 p-2 w-20 text-center">BK</th>
              <th className="border border-slate-400 p-2 text-left">Keterangan**</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(12, props.rows.length) }).map((_, i) => {
              const r = props.rows[i];
              return (
                <tr key={i}>
                  <td className="border border-slate-400 p-2 text-center">{i + 1}</td>
                  <td className="border border-slate-400 p-2">{r?.assesseeName ?? ""}</td>
                  <td className="border border-slate-400 p-2 text-center font-bold">
                    {r?.recommendation === "K" ? "✓" : ""}
                  </td>
                  <td className="border border-slate-400 p-2 text-center font-bold">
                    {r?.recommendation === "BK" ? "✓" : ""}
                  </td>
                  <td className="border border-slate-400 p-2">{r?.keterangan ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="text-[11px] italic text-slate-600">
          **Tuliskan Kode dan Judul Unit Kompetensi yang dinyatakan BK
        </p>

        <div className="space-y-3 text-xs border-t border-slate-300 pt-4">
          <div>
            <strong>Aspek Negatif dan Positif dalam Asesmen:</strong>
            <p className="mt-1 text-slate-700">{props.notesPositiveNegative || "-"}</p>
          </div>
          <div>
            <strong>Pencatatan Penolakan Hasil Asesmen:</strong>
            <p className="mt-1 text-slate-700">{props.notesRejection || "-"}</p>
          </div>
          <div>
            <strong>Saran Perbaikan (Asesor/Personil Terkait):</strong>
            <p className="mt-1 text-slate-700">{props.notesImprovement || "-"}</p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <div className="w-64 border border-slate-300 rounded-lg p-3 text-xs text-center space-y-2">
            <div className="font-semibold">Asesor Kompetensi</div>
            <div className="h-16 flex items-center justify-center">
              {props.hasActiveSignature && props.signatureUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.signatureUrl}
                  alt="Tanda tangan asesor"
                  className="max-h-14 object-contain"
                />
              ) : (
                <span className="text-[11px] text-amber-700 italic">
                  [Tanda tangan belum diunggah]
                </span>
              )}
            </div>
            <div className="font-semibold border-t border-slate-300 pt-1">
              {props.assessorName}
            </div>
            <div className="text-[11px] text-slate-500">
              No. Reg: {props.assessorRegNo} | {props.assessmentDate}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
