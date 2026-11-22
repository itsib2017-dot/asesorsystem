"use client";
// Client interactivity required to trigger router.refresh() on the current audit log URL without a no-op Link navigation.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshAuditButton({ hasBeforeId = false }: { hasBeforeId?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      if (hasBeforeId) {
        router.push("/settings/audit");
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Memuat Ulang..." : "Muat Ulang Log"}
    </button>
  );
}
