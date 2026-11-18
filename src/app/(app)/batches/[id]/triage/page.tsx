import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/get-session";
import { getBatchById, listDriveFilesForBatch } from "@/repositories/batches.repository";
import { listAssesseesByBatch } from "@/repositories/assessees.repository";
import { assignDriveFileAction } from "./actions";

export const metadata = {
  title: "Triage Berkas Drive — AsesorKompetensi",
};

export default async function TriagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) return notFound();

  const { id } = await params;
  const batch = await getBatchById(user.id, id);
  if (!batch) return notFound();

  const files = await listDriveFilesForBatch(user.id, id);
  const assessees = await listAssesseesByBatch(user.id, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/batches/${id}`} className="text-xs text-teal-700 hover:underline">
            &larr; Kembali ke Batch
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Antrean Triage Berkas ({batch.name})
          </h1>
          <p className="text-sm text-slate-500">
            Petakan file Google Drive yang belum cocok ke asesi dan jenis dokumen yang tepat.
          </p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-slate-600">
          Belum ada berkas yang dipindai pada batch ini.
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-600">
              <tr>
                <th className="py-3 px-4">Nama Berkas / Jalur Drive</th>
                <th className="py-3 px-4">Jenis Terdeteksi</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Petakan ke Asesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {files.map((f) => (
                <tr key={f.id}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{f.fileName}</div>
                    <div className="text-xs text-slate-400 font-mono">{f.drivePath}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">{f.docType}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                      {f.triageStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <form action={assignDriveFileAction} className="flex gap-2">
                      <input type="hidden" name="batchId" value={id} />
                      <input type="hidden" name="fileId" value={f.id} />
                      <input type="hidden" name="triageStatus" value="assigned" />
                      <select
                        name="assesseeId"
                        defaultValue={f.assesseeId ?? ""}
                        className="px-2 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        <option value="">-- Pilih Asesi --</option>
                        {assessees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-lg bg-teal-700 text-white text-xs font-medium cursor-pointer"
                      >
                        Tetapkan
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
