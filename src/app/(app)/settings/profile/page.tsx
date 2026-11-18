import { getUser } from "@/lib/auth/get-session";
import { getAssessorProfile } from "@/repositories/auth.repository";
import { listAssessorSignatures } from "@/repositories/signatures.repository";
import { SignatureUpload } from "@/components/profile/signature-upload";
import { uploadSignatureAction } from "./actions";

export const metadata = {
  title: "Profil & Tanda Tangan Asesor — AsesorKompetensi",
};

export default async function ProfileSettingsPage() {
  const user = await getUser();
  const profile = user ? await getAssessorProfile(user.id) : null;
  const signatures = user ? await listAssessorSignatures(user.id) : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Profil & Tanda Tangan Asesor
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Identitas No. Reg MET dan tanda tangan digital untuk penandatanganan FR.AK.05.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-2 text-sm">
        <div>
          <span className="text-slate-500">Email:</span>{" "}
          <strong className="text-slate-900">{user?.email ?? "-"}</strong>
        </div>
        <div>
          <span className="text-slate-500">Nama Lengkap:</span>{" "}
          <strong className="text-slate-900">
            {(profile?.fullName as string) || (profile?.full_name as string) || "Belum dilengkapi"}
          </strong>
        </div>
        <div>
          <span className="text-slate-500">No. Reg MET:</span>{" "}
          <strong className="font-mono text-slate-900">
            {(profile?.regNoMet as string) || (profile?.reg_no_met as string) || "-"}
          </strong>
        </div>
      </div>

      <SignatureUpload versions={signatures} onUploadAction={uploadSignatureAction} />
    </div>
  );
}
