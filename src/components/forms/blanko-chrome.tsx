import React from "react";
import Link from "next/link";
import { AlertTriangle, FileText } from "lucide-react";
import { AK05_LAYOUT } from "@/lib/ak05/layout";
import type { SchemeBrandingConfig } from "@/repositories/schemes.repository";

export function BlankoA4Sheet({
  children,
  className = "space-y-2.5",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="w-full overflow-x-auto pb-1">
      <div
        className={`bg-white border border-slate-300 shadow-sm text-black w-[794px] mx-auto px-10 py-8 flex flex-col ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function BlankoSheetHeader(props?: SchemeBrandingConfig) {
  const leftUrl = props?.leftLogoUrl || "/templates/ak3u/bnsp-logo.png";
  const leftAlt = props?.leftLogoAlt || "BNSP";
  const rightUrl = props?.rightLogoUrl || "/templates/ak3u/lsp-logo.png";
  const rightAlt = props?.rightLogoAlt || "LSP Logo";

  return (
    <div className="flex items-center justify-between gap-4 pb-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={leftUrl}
        alt={leftAlt}
        className="h-10 w-auto object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={rightUrl}
        alt={rightAlt}
        className="h-11 w-auto object-contain"
      />
    </div>
  );
}

export function BlankoSheetFooter({
  schemeTitle,
  formCode = AK05_LAYOUT.formCode,
  pageNumber,
}: {
  schemeTitle: string;
  formCode?: string;
  pageNumber: number;
}) {
  return (
    <div className="pt-6 mt-auto">
      <div
        className="border-t-2 pt-2 flex items-center justify-between text-[10px] text-slate-800"
        style={{ borderColor: AK05_LAYOUT.colors.footerDividerHex }}
      >
        <span className="tracking-tight">{schemeTitle}</span>
        <div className="flex items-center gap-2">
          <span>{formCode}</span>
          <span
            className="inline-flex items-center justify-center w-5 h-5 text-white font-bold text-[11px]"
            style={{ backgroundColor: AK05_LAYOUT.colors.pageBadgeHex }}
          >
            {pageNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BlankoTukValue({ tukType }: { tukType?: string | null }) {
  const active = tukType === "tempat_kerja" || tukType === "mandiri" ? tukType : "sewaktu";
  return (
    <>
      <span className={active === "sewaktu" ? "" : "line-through"}>Sewaktu</span>
      <span>/</span>
      <span className={active === "tempat_kerja" ? "" : "line-through"}>Tempat Kerja</span>
      <span>/</span>
      <span className={active === "mandiri" ? "" : "line-through"}>Mandiri*</span>
    </>
  );
}

export function BlankoTitleBar({
  code,
  title,
}: {
  code: string;
  title: string;
}) {
  return (
    <div className="flex items-baseline gap-6 text-sm font-bold pb-1">
      <span className="shrink-0">{code}</span>
      <span>{title}</span>
    </div>
  );
}

export function BlankoMetadataTable({
  schemeTitle,
  schemeNumber,
  tukType,
  assessorName,
  assesseeName,
  children,
}: {
  schemeTitle: string;
  schemeNumber: string;
  tukType?: string | null;
  assessorName: string;
  assesseeName?: string;
  children?: React.ReactNode;
}) {
  return (
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
          <td className="border border-black p-1.5 font-bold">{schemeTitle}</td>
        </tr>
        <tr>
          <td className="border border-black p-1.5">Nomor</td>
          <td className="border border-black p-1.5 text-center">:</td>
          <td className="border border-black p-1.5 font-bold">{schemeNumber}</td>
        </tr>
        <tr>
          <td colSpan={2} className="border border-black p-1.5">
            TUK
          </td>
          <td className="border border-black p-1.5 text-center">:</td>
          <td className="border border-black p-1.5">
            <BlankoTukValue tukType={tukType} />
          </td>
        </tr>
        <tr>
          <td colSpan={2} className="border border-black p-1.5">
            Nama Asesor
          </td>
          <td className="border border-black p-1.5 text-center">:</td>
          <td className="border border-black p-1.5">{assessorName}</td>
        </tr>
        {assesseeName !== undefined && (
          <tr>
            <td colSpan={2} className="border border-black p-1.5">
              Nama Asesi
            </td>
            <td className="border border-black p-1.5 text-center">:</td>
            <td className="border border-black p-1.5">{assesseeName}</td>
          </tr>
        )}
        {children}
      </tbody>
    </table>
  );
}

export function BlankoDocxExportBar(props: {
  batchId: string;
  assesseeId: string;
  formType: "ak02" | "ia04b" | "ia06";
  formLabel: string;
  caption: string;
  hasActiveSignature: boolean;
  isNameConfirmed: boolean;
}) {
  const blocked = !props.hasActiveSignature || !props.isNameConfirmed;
  const href = blocked
    ? undefined
    : `/api/v1/batches/${props.batchId}/assessees/${props.assesseeId}/export?form=${props.formType}&format=docx`;

  return (
    <div className="space-y-3">
      {blocked && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            Ekspor {props.formLabel} (DOCX) Terkunci
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {!props.hasActiveSignature && (
              <li>
                Tanda tangan asesor belum diunggah.{" "}
                <Link href="/settings/profile" className="underline font-semibold">
                  Unggah Tanda Tangan
                </Link>
              </li>
            )}
            {!props.isNameConfirmed && (
              <li>
                Nama sertifikat asesi (otoritas KTP) belum dikonfirmasi.{" "}
                <Link
                  href={`/batches/${props.batchId}/assessees/${props.assesseeId}`}
                  className="underline font-semibold"
                >
                  Konfirmasi Nama Asesi
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">{props.caption}</div>
        <a
          href={href}
          aria-disabled={blocked}
          className={`px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2 border ${
            blocked
              ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none"
              : "bg-teal-700 hover:bg-teal-800 border-teal-700 text-white shadow-sm"
          }`}
        >
          <FileText className="w-4 h-4" /> Ekspor {props.formLabel} (DOCX)
        </a>
      </div>
    </div>
  );
}

export function BlankoSignatureBlock(props: {
  assesseeName: string;
  assessorName: string;
  assessorRegNo: string;
  displayDate: string;
  hasActiveSignature: boolean;
  signatureUrl?: string;
  topRow?: React.ReactNode;
}) {
  return (
    <table className="w-full text-xs border-collapse border border-black mt-2">
      <tbody>
        {props.topRow}
        <tr>
          <td colSpan={3} className="border border-black p-1.5 font-bold">
            Asesi :
          </td>
        </tr>
        <tr>
          <td className="border border-black p-1.5 w-[32%]">Nama</td>
          <td className="border border-black p-1.5 w-[3%] text-center">:</td>
          <td className="border border-black p-1.5">{props.assesseeName}</td>
        </tr>
        <tr>
          <td className="border border-black p-1.5">Tanda tangan &amp; tanggal</td>
          <td className="border border-black p-1.5 text-center">:</td>
          <td className="border border-black p-1.5 h-10 align-bottom">{props.displayDate}</td>
        </tr>
        <tr>
          <td colSpan={3} className="border border-black p-1.5 font-bold">
            Asesor :
          </td>
        </tr>
        <tr>
          <td className="border border-black p-1.5">Nama</td>
          <td className="border border-black p-1.5 text-center">:</td>
          <td className="border border-black p-1.5">{props.assessorName}</td>
        </tr>
        <tr>
          <td className="border border-black p-1.5">No. Reg</td>
          <td className="border border-black p-1.5 text-center">:</td>
          <td className="border border-black p-1.5">{props.assessorRegNo}</td>
        </tr>
        <tr>
          <td className="border border-black p-1.5 align-middle">Tanda tangan &amp; tanggal</td>
          <td className="border border-black p-1.5 text-center">:</td>
          <td className="border border-black p-2 text-center">
            <div className="h-14 flex items-center justify-center">
              {props.hasActiveSignature && props.signatureUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={props.signatureUrl}
                  alt="Tanda tangan asesor"
                  className="max-h-12 w-auto object-contain"
                />
              ) : (
                <span className="text-[11px] text-amber-700 italic">
                  [Tanda tangan belum diunggah]
                </span>
              )}
            </div>
            <div className="mt-0.5">{props.displayDate}</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

