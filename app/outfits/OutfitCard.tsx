"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { stableUrl } from "@/lib/urlCache";
import { todayIso } from "@/lib/dates";
import { UNDO_MS } from "@/lib/wardrobe";
import WearModal from "../components/WearModal";

export type OutfitView = {
  id: string;
  name: string;
  reason: string;
  occasion: string;
  liked: boolean | null;
  worn_count: number;
  itemIds: string[]; // every item in the outfit (kept for the Worn diary)
  items: { id: string; key: string; url: string; label: string }[];
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
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<null | "deleted" | "hidden">(null);
  // shown straight away; the database catches up in the background
  const [liked, setLiked] = useState<boolean | null>(outfit.liked);
  const [worn, setWorn] = useState(outfit.worn_count);
  // the "where did you wear it?" pop-up (holds today's date from the moment you tapped)
  const [wearing, setWearing] = useState<{ today: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLiked(outfit.liked);
    setWorn(outfit.worn_count);
  }, [outfit.liked, outfit.worn_count]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const refresh = () => startTransition(() => router.refresh());

  // Saves a change quietly. If it fails, the card goes back to how it was.
  async function save(values: Record<string, unknown>, revert: () => void) {
    const supabase = createClient();
    const { error } = await supabase
      .from("outfits")
      .update(values)
      .eq("id", outfit.id);
    if (error) revert();
    else refresh();
  }

  function toggleLike() {
    const prev = liked;
    const next = prev === true ? null : true;
    setLiked(next);
    void save({ liked: next }, () => setLiked(prev));
  }

  function openWear() {
    setWearing({ today: todayIso() });
  }

  // Adds an entry to the Worn diary (with where and when), then updates this card.
  async function logWear(place: string, date: string): Promise<string | null> {
    const supabase = createClient();
    const { error: wearErr } = await supabase.from("outfit_wears").insert({
      outfit_id: outfit.id,
      outfit_name: outfit.name,
      occasion: outfit.occasion,
      item_ids: outfit.itemIds,
      place: place || null,
      worn_on: date,
    });
    if (wearErr) return "Could not save that. Please try again.";

    const prevWorn = worn;
    const prevLiked = liked;
    setWorn(prevWorn + 1);
    if (prevLiked === null) setLiked(true);

    const values: Record<string, unknown> = { worn_count: prevWorn + 1 };
    if (date === todayIso()) values.last_worn_at = new Date().toISOString();
    if (prevLiked === null) values.liked = true;
    void save(values, () => {
      setWorn(prevWorn);
      setLiked(prevLiked);
    });

    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 5000);
    return null;
  }

  // No popup: the card is hidden at once and can be brought back with Undo.
  async function removeWith(kind: "deleted" | "hidden") {
    setBusy(true);
    setRemoved(kind);
    const supabase = createClient();
    const values =
      kind === "deleted"
        ? { deleted_at: new Date().toISOString() }
        : { hidden: true, liked: false }; // "Not for me" also teaches the AI
    const { error } = await supabase
      .from("outfits")
      .update(values)
      .eq("id", outfit.id);
    setBusy(false);
    if (error) {
      setRemoved(null);
      return;
    }
    timer.current = setTimeout(refresh, UNDO_MS);
  }

  async function undo() {
    if (timer.current) clearTimeout(timer.current);
    const was = removed;
    setRemoved(null);
    const supabase = createClient();
    const values =
      was === "deleted"
        ? { deleted_at: null }
        : { hidden: false, liked: outfit.liked };
    await supabase.from("outfits").update(values).eq("id", outfit.id);
    refresh();
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
    <>
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
                  src={stableUrl(it.key, it.url)}
                  suppressHydrationWarning
                  alt={it.label}
                  title={it.label}
                  className="aspect-square w-full rounded-2xl bg-sand/40 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div key={it.id} className="skeleton aspect-square rounded-2xl" />
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
              onClick={toggleLike}
              aria-pressed={liked === true}
              className={`btn btn-sm ${liked === true ? "btn-primary" : "btn-ghost"}`}
            >
              <HeartIcon filled={liked === true} />
              Like
            </button>
            <button
              disabled={busy}
              onClick={() => removeWith("hidden")}
              className="btn btn-ghost btn-sm"
            >
              Not for me
            </button>
            <button onClick={openWear} className="btn btn-ghost btn-sm">
              Wore it{worn > 0 ? ` (${worn})` : ""}
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

          {saved && (
            <p className="mt-3 text-xs text-sage">
              Saved to your{" "}
              <Link href="/worn" className="underline">
                Worn diary
              </Link>
              .
            </p>
          )}
        </div>
      </article>

      {wearing && (
        <WearModal
          title="Where did you wear it?"
          subtitle={outfit.name}
          initialDate={wearing.today}
          maxDate={wearing.today}
          saveLabel="Save to diary"
          onSave={logWear}
          onClose={() => setWearing(null)}
        />
      )}
    </>
  );
}
