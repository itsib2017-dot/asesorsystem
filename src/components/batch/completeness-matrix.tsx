import React from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Minus } from "lucide-react";

export interface CompletenessRow {
  assesseeId: string;
  displayName: string;
  certificateNameConfirmed: string | null;
  completenessStatus: string;
  docs: Record<string, "complete" | "warning" | "missing">;
}

interface CompletenessMatrixProps {
  batchId: string;
  docColumns: string[];
  rows: CompletenessRow[];
}

export function CompletenessMatrix({
  batchId,
  docColumns,
  rows,
}: CompletenessMatrixProps) {
  // Decision-first ordering: incomplete / unconfirmed first
  const sorted = [...rows].sort((a, b) => {
    const aPending = a.completenessStatus !== "complete" || !a.certificateNameConfirmed ? 0 : 1;
    const bPending = b.completenessStatus !== "complete" || !b.certificateNameConfirmed ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return a.displayName.localeCompare(b.displayName);
  });

  if (sorted.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-600">
          Belum ada data asesi pada batch ini. Mulai pindai folder Google Drive untuk memuat daftar berkas.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50/90 border-b border-slate-200 text-xs uppercase text-slate-600">
            <tr>
              <th scope="col" className="py-3 px-4 font-semibold sticky left-0 bg-slate-50">
                Nama Asesi
              </th>
              <th scope="col" className="py-3 px-3 font-semibold">
                Nama Sertifikat
              </th>
              {docColumns.map((col) => (
                <th key={col} scope="col" className="py-3 px-3 font-semibold text-center">
                  {col}
                </th>
              ))}
              <th scope="col" className="py-3 px-4 font-semibold text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sorted.map((row) => (
              <tr key={row.assesseeId} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-medium text-slate-900 sticky left-0 bg-white/95">
                  {row.displayName}
                </td>
                <td className="py-3 px-3">
                  {row.certificateNameConfirmed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      {row.certificateNameConfirmed}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                      <AlertTriangle className="w-3 h-3" />
                      Belum dikonfirmasi
                    </span>
                  )}
                </td>
                {docColumns.map((col) => {
                  const status = row.docs[col] ?? "missing";
                  return (
                    <td key={col} className="py-3 px-3 text-center">
                      {status === "complete" ? (
                        <CheckCircle2
                          className="w-4 h-4 text-emerald-600 mx-auto"
                          aria-label={`${col} lengkap`}
                        />
                      ) : status === "warning" ? (
                        <AlertTriangle
                          className="w-4 h-4 text-amber-600 mx-auto"
                          aria-label={`${col} perlu diperiksa`}
                        />
                      ) : (
                        <Minus
                          className="w-4 h-4 text-slate-300 mx-auto"
                          aria-label={`${col} belum ada`}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                  <Link
                    href={`/batches/${batchId}/assessees/${row.assesseeId}`}
                    className="text-xs font-medium text-teal-700 hover:text-teal-900 underline-offset-2 hover:underline"
                  >
                    Periksa
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
