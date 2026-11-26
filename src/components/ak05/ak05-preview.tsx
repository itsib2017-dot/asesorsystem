import React from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Download } from "lucide-react";
import {
  formatAk05DateIndonesia,
  formatAk05SchemeTitle,
} from "@/lib/ak05/format";
import { AK05_LAYOUT } from "@/lib/ak05/layout";
import type { SchemeBrandingConfig } from "@/repositories/schemes.repository";
import {
  BlankoA4Sheet,
  BlankoMetadataTable,
  BlankoSheetFooter,
  BlankoSheetHeader,
  BlankoTitleBar,
} from "@/components/forms/blanko-chrome";

interface Ak05PreviewProps {
  batchId: string;
  branding?: SchemeBrandingConfig;
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
  undecidedCount?: number;
  rows: Array<{
    no: number;
    assesseeId?: string;
    assesseeName: string;
    isNameConfirmed?: boolean;
    recommendation: "K" | "BK" | "-";
    keterangan: string;
  }>;
  notesPositiveNegative: string;
  notesRejection: string;
  notesImprovement: string;
}

export function Ak05Preview(props: Ak05PreviewProps) {
  const blocked = !props.hasActiveSignature || props.unconfirmedNamesCount > 0;
  const displaySchemeTitle = formatAk05SchemeTitle(props.schemeTitle);
  const displayDate = formatAk05DateIndonesia(props.assessmentDate);
  const totalSlots = Math.max(AK05_LAYOUT.minCandidateSlots, props.rows.length);

  const notesTable = (
    <table className="w-full text-xs border-collapse border border-black">
      <tbody>
        <tr>
          <td
            className="border border-black p-2 w-1/3 align-top"
            style={{ backgroundColor: AK05_LAYOUT.colors.tableHeaderGreenHex }}
          >
            {AK05_LAYOUT.noteRowLabels.positiveNegative}
          </td>
          <td className="border border-black p-2 align-top">
            {props.notesPositiveNegative || "-"}
          </td>
        </tr>
        <tr>
          <td
            className="border border-black p-2 align-top"
            style={{ backgroundColor: AK05_LAYOUT.colors.tableHeaderGreenHex }}
          >
            {AK05_LAYOUT.noteRowLabels.rejection}
          </td>
          <td className="border border-black p-2 align-top">
            {props.notesRejection || "-"}
          </td>
        </tr>
        <tr>
          <td
            className="border border-black p-2 align-top"
            style={{ backgroundColor: AK05_LAYOUT.colors.tableHeaderGreenHex }}
          >
            {AK05_LAYOUT.noteRowLabels.improvement}
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
                Terdapat {props.unconfirmedNamesCount} asesi yang belum memiliki konfirmasi nama sertifikat (otoritas KTP) untuk ekspor tingkat batch. Asesi yang namanya sudah terkonfirmasi tetap dapat diekspor per asesi di bawah.
              </li>
            )}
            {(props.undecidedCount ?? 0) > 0 && (
              <li>
                Terdapat {props.undecidedCount} asesi yang belum memiliki keputusan per unit K/BK (ditampilkan sebagai &ldquo;Belum diputuskan&rdquo;, bukan K).
              </li>
            )}
          </ul>
        </div>
      )}

      {!blocked && (props.undecidedCount ?? 0) > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Terdapat <strong>{props.undecidedCount}</strong> asesi yang belum memiliki keputusan K/BK per unit (kolom Rekomendasi dibiarkan kosong dengan keterangan &ldquo;Belum diputuskan&rdquo;).
          </span>
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

      {/* Per-Assessee Export Card (P0-3: never block confirmed assessee on unconfirmed peers) */}
      {props.rows.some((r) => Boolean(r.assesseeId)) && (
        <div className="glass-card rounded-2xl p-4 space-y-3 border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Ekspor FR.AK.05 Per Asesi (PDF / DOCX)
              </h2>
              <p className="text-[11px] text-slate-500">
                Asesi dengan nama sertifikat terkonfirmasi dapat langsung diekspor tanpa menunggu asesi lain di batch.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
            {props.rows.map((r) => {
              const canExportAssessee =
                props.hasActiveSignature && Boolean(r.isNameConfirmed) && Boolean(r.assesseeId);
              return (
                <div
                  key={r.assesseeId ?? r.no}
                  className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-mono text-slate-500">{r.no}.</span>
                    <span className="font-medium text-slate-900 truncate">{r.assesseeName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        r.isNameConfirmed
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {r.isNameConfirmed ? "Nama Terkonfirmasi" : "Belum Konfirmasi KTP"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {r.recommendation}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={
                        canExportAssessee
                          ? `/api/v1/batches/${props.batchId}/ak05/export?format=pdf&assesseeId=${r.assesseeId}`
                          : undefined
                      }
                      aria-disabled={!canExportAssessee}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 ${
                        canExportAssessee
                          ? "bg-teal-700 hover:bg-teal-800 text-white"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none"
                      }`}
                    >
                      <Download className="w-3 h-3" /> PDF
                    </a>
                    <a
                      href={
                        canExportAssessee
                          ? `/api/v1/batches/${props.batchId}/ak05/export?format=docx&assesseeId=${r.assesseeId}`
                          : undefined
                      }
                      aria-disabled={!canExportAssessee}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 border ${
                        canExportAssessee
                          ? "bg-white hover:bg-slate-50 border-slate-300 text-slate-800"
                          : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
                      }`}
                    >
                      <FileText className="w-3 h-3" /> DOCX
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sheet 1: Faithful Official Blanko FR.AK.05 Page 1 */}
      <BlankoA4Sheet>
        <BlankoSheetHeader {...props.branding} />

        {/* Borderless Table 0: FR.AK.05.   LAPORAN ASESMEN */}
        <BlankoTitleBar code="FR.AK.05." title="LAPORAN ASESMEN" />

        {/* Table 1: Metadata Grid (Skema, TUK, Nama Asesor, Tanggal) */}
        <BlankoMetadataTable
          schemeTitle={displaySchemeTitle}
          schemeNumber={props.schemeNumber}
          tukType={props.tukType}
          assessorName={props.assessorName}
        >
          <tr>
            <td colSpan={2} className="border border-black p-1.5">
              Tanggal
            </td>
            <td className="border border-black p-1.5 text-center">:</td>
            <td className="border border-black p-1.5">{displayDate}</td>
          </tr>
        </BlankoMetadataTable>

        <p className="text-[11px] italic">{AK05_LAYOUT.footnoteAsterisk}</p>

        {/* Table 2: Candidate Recommendations Grid (#92D050 Green Header) */}
        <table className="w-full text-xs border-collapse border border-black">
          <thead>
            <tr
              className="font-bold"
              style={{ backgroundColor: AK05_LAYOUT.colors.tableHeaderGreenHex }}
            >
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
            <tr
              className="font-bold"
              style={{ backgroundColor: AK05_LAYOUT.colors.tableHeaderGreenHex }}
            >
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

        <p className="text-[11px] italic">{AK05_LAYOUT.footnoteKeterangan}</p>

        {/* Table 3 on Page 1 matching official FR.AK.05 */}
        {notesTable}

        <BlankoSheetFooter schemeTitle={displaySchemeTitle} pageNumber={1} />
      </BlankoA4Sheet>

      {/* Sheet 2: Faithful Official Blanko FR.AK.05 Page 2 (Table 4 Assessor Block) */}
      <BlankoA4Sheet className="min-h-[680px]">
        <BlankoSheetHeader {...props.branding} />

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
      </BlankoA4Sheet>
    </div>
  );
}
