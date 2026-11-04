"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// One tap hides every outfit you have not liked, with an Undo.
export default function OutfitToolbar({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [undoIds, setUndoIds] = useState<string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function hideAll() {
    if (ids.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("outfits").update({ hidden: true }).in("id", ids);
    setBusy(false);
    setUndoIds(ids);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndoIds(null), 10000);
    router.refresh();
  }

  async function undo() {
    if (!undoIds) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("outfits").update({ hidden: false }).in("id", undoIds);
    setBusy(false);
    setUndoIds(null);
    router.refresh();
  }

  if (undoIds) {
    return (
      <div className="mb-4 flex items-center gap-3 text-sm">
        <span>
          Hid {undoIds.length} {undoIds.length === 1 ? "outfit" : "outfits"}.
        </span>
        <button
          onClick={undo}
          disabled={busy}
          className="rounded-lg border border-[#1F1F1F] px-3 py-1 text-xs transition hover:bg-[#1F1F1F] hover:text-white disabled:opacity-50"
        >
          Undo
        </button>
      </div>
    );
  }

  if (ids.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={hideAll}
        disabled={busy}
        className="rounded-lg border border-[#1F1F1F]/30 px-3 py-1.5 text-xs transition hover:border-[#1F1F1F] disabled:opacity-50"
      >
        Hide all outfits I have not liked ({ids.length})
      </button>
    </div>
  );
}
