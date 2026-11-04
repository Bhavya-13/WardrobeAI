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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-9.2-9.2A5 5 0 0 1 12 6.6a5 5 0 0 1 9.2 4.7c-1.7 4.6-9.2 9.2-9.2 9.2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

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
      <article className="flex items-center justify-between gap-3 rounded-3xl bg-sand/50 px-5 py-10 text-sm">
        <span className="text-ink/70">
          {removed === "deleted"
            ? "Outfit deleted."
            : "Hidden. I will avoid looks like this."}
        </span>
        <button onClick={undo} disabled={busy} className="btn btn-ghost btn-sm">
          Undo
        </button>
      </article>
    );
  }

  const cols = Math.min(Math.max(outfit.items.length, 1), 3);

  return (
    <article className="card overflow-hidden">
      {outfit.items.length === 0 ? (
        <div className="flex aspect-[3/2] items-center justify-center bg-sand/40 text-xs text-ink/50">
          These items were removed
        </div>
      ) : (
        <div
          className="grid gap-1 bg-paper p-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {outfit.items.map((it) =>
            it.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={it.id}
                src={it.url}
                alt={it.label}
                title={it.label}
                className="aspect-square w-full rounded-2xl object-cover"
                loading="lazy"
              />
            ) : (
              <div key={it.id} className="aspect-square rounded-2xl bg-sand/50" />
            )
          )}
        </div>
      )}

      <div className="p-4 pt-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="font-display text-xl leading-tight">{outfit.name}</h3>
          <span className="chip shrink-0">{outfit.occasion}</span>
        </div>
        <p className="mb-2 text-sm leading-relaxed text-ink/70">
          {outfit.reason}
        </p>
        <p className="mb-4 text-xs capitalize text-ink/45">
          {outfit.items.map((i) => i.label).join(" + ")}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={busy}
            onClick={() => update({ liked: outfit.liked === true ? null : true })}
            aria-pressed={outfit.liked === true}
            className={`btn btn-sm ${outfit.liked === true ? "btn-primary" : "btn-ghost"}`}
          >
            <HeartIcon filled={outfit.liked === true} />
            Like
          </button>
          <button
            disabled={busy}
            onClick={() => removeWith("hidden")}
            className="btn btn-ghost btn-sm"
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
            className="btn btn-ghost btn-sm"
          >
            Wore it{outfit.worn_count > 0 ? ` (${outfit.worn_count})` : ""}
          </button>
          <button
            disabled={busy}
            onClick={() => removeWith("deleted")}
            aria-label="Delete outfit"
            title="Delete"
            className="ml-auto grid h-10 w-10 place-items-center rounded-full text-ink/45 transition hover:bg-sand/60 hover:text-red-700 disabled:opacity-50"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
}
