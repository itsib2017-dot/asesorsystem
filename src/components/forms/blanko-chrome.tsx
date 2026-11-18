import React from "react";

export function BlankoSheetHeader() {
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

export function BlankoSheetFooter({
  schemeTitle,
  formCode = "FR.AK.05-2024",
  pageNumber,
}: {
  schemeTitle: string;
  formCode?: string;
  pageNumber: number;
}) {
  return (
    <div className="pt-6 mt-auto">
      <div className="border-t-2 border-[#4472C4] pt-2 flex items-center justify-between text-[10px] text-slate-800">
        <span className="tracking-tight">{schemeTitle}</span>
        <div className="flex items-center gap-2">
          <span>{formCode}</span>
          <span className="inline-flex items-center justify-center w-5 h-5 bg-[#A8D08D] text-white font-bold text-[11px]">
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
