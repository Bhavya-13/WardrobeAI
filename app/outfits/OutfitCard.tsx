"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UNDO_MS } from "@/lib/wardrobe";

export type OutfitView = {
  id: string;
  name: string;
  reason: string;
  occasion: string;
  liked: boolean | null;
  worn_count: number;
  items: { id: string; url: string; label: string }[];
};

export default function OutfitCard({ outfit }: { outfit: OutfitView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<null | "deleted" | "hidden">(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function update(values: Record<string, unknown>) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("outfits").update(values).eq("id", outfit.id);
    setBusy(false);
    router.refresh();
  }

  // No popup: the card is hidden at once and can be brought back with Undo.
  async function removeWith(kind: "deleted" | "hidden") {
    setBusy(true);
    const supabase = createClient();
    const values =
      kind === "deleted"
        ? { deleted_at: new Date().toISOString() }
        : { hidden: true, liked: false }; // "Not for me" also teaches the AI
    await supabase.from("outfits").update(values).eq("id", outfit.id);
    setBusy(false);
    setRemoved(kind);
    timer.current = setTimeout(() => router.refresh(), UNDO_MS);
  }

  async function undo() {
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    const supabase = createClient();
    const values =
      removed === "deleted"
        ? { deleted_at: null }
        : { hidden: false, liked: outfit.liked };
    await supabase.from("outfits").update(values).eq("id", outfit.id);
    setBusy(false);
    setRemoved(null);
    router.refresh();
  }

  if (removed) {
    return (
      <article className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-8 text-sm">
        <span>
          {removed === "deleted"
            ? "Outfit deleted."
            : "Hidden. I will avoid looks like this."}
        </span>
        <button
          onClick={undo}
          disabled={busy}
          className="rounded-lg border border-[#1F1F1F] px-3 py-1.5 text-xs transition hover:bg-[#1F1F1F] hover:text-white disabled:opacity-50"
        >
          Undo
        </button>
      </article>
    );
  }

  const btn = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
      active
        ? "border-[#1F1F1F] bg-[#1F1F1F] text-white"
        : "border-[#1F1F1F]/30 hover:border-[#1F1F1F]"
    }`;

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="grid auto-cols-fr grid-flow-col gap-px bg-[#1F1F1F]/10">
        {outfit.items.length === 0 ? (
          <div className="flex aspect-[3/2] items-center justify-center bg-white text-xs text-[#1F1F1F]/50">
            These items were removed
          </div>
        ) : (
          outfit.items.map((it) =>
            it.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={it.id}
                src={it.url}
                alt={it.label}
                title={it.label}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div key={it.id} className="aspect-square bg-[#1F1F1F]/5" />
            )
          )
        )}
      </div>

      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="font-semibold">{outfit.name}</h3>
          <span className="shrink-0 rounded-full bg-[#F6F1EA] px-2 py-0.5 text-[10px] text-[#1F1F1F]/70">
            {outfit.occasion}
          </span>
        </div>
        <p className="mb-1 text-sm text-[#1F1F1F]/70">{outfit.reason}</p>
        <p className="mb-3 text-xs capitalize text-[#1F1F1F]/50">
          {outfit.items.map((i) => i.label).join(" + ")}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={busy}
            onClick={() => update({ liked: outfit.liked === true ? null : true })}
            className={btn(outfit.liked === true)}
          >
            Like
          </button>
          <button
            disabled={busy}
            onClick={() => removeWith("hidden")}
            className={btn(false)}
          >
            Not for me
          </button>
          <button
            disabled={busy}
            onClick={() =>
              update({
                worn_count: outfit.worn_count + 1,
                last_worn_at: new Date().toISOString(),
                ...(outfit.liked === null ? { liked: true } : {}),
              })
            }
            className={btn(false)}
          >
            Wore it{outfit.worn_count > 0 ? ` (${outfit.worn_count})` : ""}
          </button>
          <button
            disabled={busy}
            onClick={() => removeWith("deleted")}
            className="ml-auto text-xs text-red-700 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
