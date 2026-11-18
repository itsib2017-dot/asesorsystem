"use client";

import { useFormStatus } from "react-dom";
import { RefreshCw } from "lucide-react";

export function RescanDriveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
    >
      <RefreshCw
        className={`w-3.5 h-3.5 text-teal-700 ${pending ? "animate-spin" : ""}`}
      />
      {pending ? "Memindai Ulang..." : "Pindai Ulang Drive"}
    </button>
  );
}
