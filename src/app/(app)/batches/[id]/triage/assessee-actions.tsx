// "use client" required: these forms need inline submit validation/confirmation,
// which a Server Component cannot pass to React DOM.
"use client";

import { deleteAssesseeFormAction, updateAssesseeFormAction } from "./actions";

export function AssesseeActions({
  batchId,
  assesseeId,
  displayName,
}: {
  batchId: string;
  assesseeId: string;
  displayName: string;
}) {
  return (
    <>
      <form
        action={updateAssesseeFormAction}
        className="inline space-x-1"
        onSubmit={(e) => {
          const input = e.currentTarget.elements.namedItem("displayName") as HTMLInputElement | null;
          if (input && !input.value.trim()) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="assesseeId" value={assesseeId} />
        <input
          name="displayName"
          defaultValue={displayName}
          className="px-2 py-1 rounded-lg border border-slate-300 text-xs bg-white w-[140px]"
        />
        <button
          type="submit"
          className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-medium cursor-pointer"
        >
          Ubah
        </button>
      </form>
      <form
        action={deleteAssesseeFormAction}
        className="inline"
        onSubmit={(e) => {
          if (!window.confirm(`Hapus asesi "${displayName}"?`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="assesseeId" value={assesseeId} />
        <button
          type="submit"
          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-medium cursor-pointer"
        >
          Hapus
        </button>
      </form>
    </>
  );
}
