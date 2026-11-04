"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { stableUrl } from "@/lib/urlCache";
import { formatWornDate, todayIso } from "@/lib/dates";
import { UNDO_MS } from "@/lib/wardrobe";
import WearModal from "../components/WearModal";

export type WornView = {
  id: string;
  outfitId: string | null;
  name: string;
  occasion: string;
  place: string;
  wornOn: string; // YYYY-MM-DD
  itemIds: string[];
  items: { id: string; key: string; url: string; label: string }[];
};

function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
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

export default function WornCard({ entry }: { entry: WornView }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // shown straight away; the database catches up in the background
  const [place, setPlace] = useState(entry.place);
  const [wornOn, setWornOn] = useState(entry.wornOn);
  const [removed, setRemoved] = useState(false);
  const [modal, setModal] = useState<null | { mode: "edit" | "again"; today: string }>(
    null
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlace(entry.place);
    setWornOn(entry.wornOn);
  }, [entry.place, entry.wornOn]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const refresh = () => startTransition(() => router.refresh());

  // Change the place or the date of this diary entry.
  async function saveEdit(newPlace: string, date: string): Promise<string | null> {
    const supabase = createClient();
    const { error } = await supabase
      .from("outfit_wears")
      .update({ place: newPlace || null, worn_on: date })
      .eq("id", entry.id);
    if (error) return "Could not save that. Please try again.";
    setPlace(newPlace);
    setWornOn(date);
    refresh();
    return null;
  }

  // Log the same outfit again (for example when you repeat a look).
  async function wearAgain(newPlace: string, date: string): Promise<string | null> {
    const supabase = createClient();
    const { error } = await supabase.from("outfit_wears").insert({
      outfit_id: entry.outfitId,
      outfit_name: entry.name,
      occasion: entry.occasion || null,
      item_ids: entry.itemIds,
      place: newPlace || null,
      worn_on: date,
    });
    if (error) return "Could not save that. Please try again.";

    // keep the outfit's own counter and "recently worn" memory in step (best effort)
    if (entry.outfitId) {
      const { data } = await supabase
        .from("outfits")
        .select("worn_count")
        .eq("id", entry.outfitId)
        .maybeSingle();
      if (data) {
        const values: Record<string, unknown> = {
          worn_count: ((data.worn_count as number | null) ?? 0) + 1,
        };
        if (date === todayIso()) values.last_worn_at = new Date().toISOString();
        await supabase.from("outfits").update(values).eq("id", entry.outfitId);
      }
    }
    refresh();
    return null;
  }

  // No popup: the entry is hidden at once and can be brought back with Undo.
  async function remove() {
    setRemoved(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("outfit_wears")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", entry.id);
    if (error) {
      setRemoved(false);
      return;
    }
    timer.current = setTimeout(refresh, UNDO_MS);
  }

  async function undo() {
    if (timer.current) clearTimeout(timer.current);
    setRemoved(false);
    const supabase = createClient();
    await supabase
      .from("outfit_wears")
      .update({ deleted_at: null })
      .eq("id", entry.id);
    refresh();
  }

  if (removed) {
    return (
      <article className="flex items-center justify-between gap-3 rounded-3xl bg-sand/50 px-5 py-8 text-sm">
        <span className="text-ink/70">Removed from your diary.</span>
        <button onClick={undo} className="btn btn-ghost btn-sm">
          Undo
        </button>
      </article>
    );
  }

  return (
    <>
      <article className="card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl leading-tight">
              {formatWornDate(wornOn)}
            </p>
            {place ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/75">
                <PinIcon />
                <span className="min-w-0 break-words">{place}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink/40">No place added</p>
            )}
          </div>
          {entry.occasion && <span className="chip shrink-0">{entry.occasion}</span>}
        </div>

        {entry.items.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-sand/40 px-4 py-6 text-center text-xs text-ink/50">
            These items were removed from your closet
          </p>
        ) : (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {entry.items.map((it) =>
              it.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={it.id}
                  src={stableUrl(it.key, it.url)}
                  suppressHydrationWarning
                  alt={it.label}
                  title={it.label}
                  className="h-20 w-20 shrink-0 rounded-2xl bg-sand/40 object-cover sm:h-24 sm:w-24"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  key={it.id}
                  className="skeleton h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24"
                />
              )
            )}
          </div>
        )}

        <p className="mt-2 text-xs capitalize text-ink/45">
          {entry.name}
          {entry.items.length > 0
            ? ` - ${entry.items.map((i) => i.label).join(" + ")}`
            : ""}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setModal({ mode: "edit", today: todayIso() })}
            className="btn btn-ghost btn-sm"
          >
            {place ? "Edit" : "Add place"}
          </button>
          <button
            onClick={() => setModal({ mode: "again", today: todayIso() })}
            className="btn btn-ghost btn-sm"
          >
            Wear again
          </button>
          <button
            onClick={remove}
            aria-label="Remove from diary"
            title="Remove"
            className="ml-auto grid h-10 w-10 place-items-center rounded-full text-ink/45 transition hover:bg-sand/60 hover:text-red-700"
          >
            <TrashIcon />
          </button>
        </div>
      </article>

      {modal?.mode === "edit" && (
        <WearModal
          title="Edit this entry"
          subtitle={entry.name}
          initialPlace={place}
          initialDate={wornOn}
          maxDate={modal.today}
          onSave={saveEdit}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === "again" && (
        <WearModal
          title="Wear it again"
          subtitle={entry.name}
          initialDate={modal.today}
          maxDate={modal.today}
          saveLabel="Save to diary"
          onSave={wearAgain}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
