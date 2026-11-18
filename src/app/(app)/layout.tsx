import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  UserCheck,
  BookOpenCheck,
  LogOut,
  Cpu,
} from "lucide-react";
import { getUser } from "@/lib/auth/get-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listUserMemberships } from "@/repositories/auth.repository";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const memberships = await listUserMemberships(user.id);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  async function signOutAction() {
    "use server";
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      const supabase = await getSupabaseServerClient();
      await supabase.auth.signOut();
    }
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] text-[#1c2b33]">
      {/* Dark Icon + Label Sidebar (D20 Dashboard V18) */}
      <aside className="w-full md:w-64 bg-slate-950 text-slate-200 flex flex-col justify-between p-4 shrink-0 border-r border-slate-900">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center font-bold text-white shadow-lg shadow-teal-600/30">
              AK
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-white">
                AsesorKompetensi
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                PORTAL LSP · BNSP
              </div>
            </div>
          </div>

          <nav aria-label="Navigasi utama" className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-teal-400" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/batches"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <FolderKanban className="w-4 h-4 text-blue-400" />
              <span>Batch Asesmen</span>
            </Link>

            <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Pengaturan
            </div>

            <Link
              href="/settings/provider"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Penyedia AI (BYOK)</span>
            </Link>

            <Link
              href="/settings/schemes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <BookOpenCheck className="w-4 h-4 text-emerald-400" />
              <span>Skema & Manifes</span>
            </Link>

            <Link
              href="/settings/profile"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>Profil & Tanda Tangan</span>
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Semua Pengaturan</span>
            </Link>
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-900 mt-6">
          <div className="px-3 py-1.5 text-xs text-slate-400 truncate mb-2">
            {user?.email ?? "Belum masuk"}
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Light Content Surface (D20) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-[1400px] w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
