"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { stableUrl } from "@/lib/urlCache";
import Modal from "../components/Modal";
import { HangerSpinner } from "../components/HangerLoader";
import {
  CATEGORIES,
  PATTERNS,
  FORMALITY,
  SEASONS,
  UNDO_MS,
  pretty,
} from "@/lib/wardrobe";

export type Item = {
  id: string;
  image_path: string;
  key: string; // storage path of the picture shown (the small preview when there is one)
  url: string;
  category: string | null;
  subtype: string | null;
  color: string | null;
  pattern: string | null;
  formality: string | null;
  season: string | null;
  tags: string[];
  tag_status: string;
  is_prescription: boolean | null;
};

// Filter pills shown above the grid (only the ones that have items appear).
const GROUPS: { key: string; label: string; match: (c: string | null) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "top", label: "Tops", match: (c) => c === "top" },
  { key: "bottom", label: "Bottoms", match: (c) => c === "bottom" },
  { key: "one_piece", label: "One-pieces", match: (c) => c === "one_piece" },
  { key: "outerwear", label: "Outerwear", match: (c) => c === "outerwear" },
  { key: "footwear", label: "Shoes", match: (c) => c === "footwear" },
  { key: "eyewear", label: "Eyewear", match: (c) => c === "eyewear" },
  {
    key: "more",
    label: "Bags and more",
    match: (c) => c === "bag" || c === "accessory" || c === "other",
  },
];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-ink/70">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1 capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {pretty(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ItemGrid({ items }: { items: Item[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, Partial<Item>>>({});
  const [editing, setEditing] = useState<Item | null>(null);
  const [filter, setFilter] = useState("all");
  const [problem, setProblem] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // refresh in the background so taps never feel stuck
  const refresh = () => startTransition(() => router.refresh());

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  // No popup: the item is hidden at once and can be brought back with Undo.
  async function remove(item: Item) {
    setRemoved((r) => ({ ...r, [item.id]: true }));
    const supabase = createClient();
    const { error } = await supabase
      .from("items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      setRemoved((r) => ({ ...r, [item.id]: false }));
      setProblem("Could not remove that item. Please try again.");
      return;
    }
    timers.current[item.id] = setTimeout(refresh, UNDO_MS);
  }

  async function undo(item: Item) {
    clearTimeout(timers.current[item.id]);
    setRemoved((r) => ({ ...r, [item.id]: false }));
    const supabase = createClient();
    await supabase.from("items").update({ deleted_at: null }).eq("id", item.id);
    refresh();
  }

  // The card updates instantly; saving happens in the background.
  async function saveEdit() {
    if (!editing) return;
    const e = editing;
    const patch: Partial<Item> = {
      category: e.category,
      subtype: e.subtype?.trim().toLowerCase() || null,
      color: e.color?.trim().toLowerCase() || null,
      pattern: e.pattern,
      formality: e.formality,
      season: e.season,
      is_prescription: e.category === "eyewear" ? e.is_prescription === true : null,
      tag_status: "done",
    };
    setOverrides((o) => ({ ...o, [e.id]: patch }));
    setEditing(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("items")
      .update({
        ...patch,
        tag_source: "user", // AI re-checks never overwrite your fixes
        tag_claimed_at: null,
      })
      .eq("id", e.id);
    if (error) {
      setOverrides((o) => {
        const copy = { ...o };
        delete copy[e.id];
        return copy;
      });
      setProblem("Could not save that change. Please try again.");
      return;
    }
    refresh();
  }

  if (items.length === 0) {
    return (
      <div className="card px-6 py-14 text-center">
        <p className="font-display text-xl">Your closet is empty</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">
          Tap &quot;Add photos&quot; to upload your clothes, or &quot;Add from a
          photo of me&quot; to add a whole outfit in one go.
        </p>
      </div>
    );
  }

  const view = items.map((i) => ({ ...i, ...overrides[i.id] }));

  const counts: Record<string, number> = {};
  GROUPS.forEach((g) => {
    counts[g.key] = view.filter((i) => g.match(i.category)).length;
  });
  const activeKey = counts[filter] > 0 ? filter : "all";
  const active = GROUPS.find((g) => g.key === activeKey) ?? GROUPS[0];
  const visible = view.filter((i) => active.match(i.category));

  return (
    <>
      {problem && (
        <p className="mb-4 rounded-2xl bg-blush/60 px-4 py-3 text-sm">{problem}</p>
      )}

      <div
        className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Filter your closet"
      >
        {GROUPS.filter((g) => g.key === "all" || counts[g.key] > 0).map((g) => (
          <button
            key={g.key}
            onClick={() => setFilter(g.key)}
            aria-pressed={activeKey === g.key}
            className="chip-btn"
          >
            {g.label} ({counts[g.key]})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {visible.map((item) => {
          if (removed[item.id]) {
            return (
              <div
                key={item.id}
                className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl bg-sand/50 p-3 text-center text-sm"
              >
                <span className="text-ink/70">Item removed</span>
                <button onClick={() => undo(item)} className="btn btn-ghost btn-sm">
                  Undo
                </button>
              </div>
            );
          }

          const done = item.tag_status === "done";
          const failed = item.tag_status === "failed";
          const title = done
            ? pretty(
                `${item.color && item.color !== "unknown" ? item.color + " " : ""}${item.subtype ?? item.category ?? "item"}`
              )
            : failed
              ? "Tag failed"
              : "Tagging...";

          const chips = done
            ? Array.from(
                new Set(
                  [
                    item.category,
                    item.category === "eyewear" && item.is_prescription
                      ? "prescription"
                      : null,
                    item.pattern && item.pattern !== "solid" ? item.pattern : null,
                    item.formality,
                    item.season,
                    ...item.tags.slice(0, 3),
                  ]
                    .filter((c): c is string => Boolean(c))
                    .map(pretty)
                    .filter((c) => c !== (item.subtype ?? "").toLowerCase())
                )
              )
            : [];

          return (
            <div key={item.id} className="card overflow-hidden">
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stableUrl(item.key, item.url)}
                  suppressHydrationWarning
                  alt={title}
                  className="aspect-square w-full bg-sand/40 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="skeleton aspect-square w-full" />
              )}
              <div className="px-3 pb-3 pt-2.5">
                <p
                  className={`flex items-center gap-1.5 text-sm font-medium capitalize ${
                    done ? "" : "text-ink/50"
                  }`}
                >
                  {!done && !failed && (
                    <HangerSpinner size={14} className="text-clay" />
                  )}
                  {title}
                </p>
                {chips.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {chips.map((c, i) => (
                      <span key={i} className="chip">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-4 text-xs">
                  <button
                    onClick={() => setEditing({ ...item })}
                    className="-ml-1 px-1 py-2 text-ink/70 hover:text-ink hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(item)}
                    className="px-1 py-2 text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <Modal
          label="Fix this item"
          onClose={() => setEditing(null)}
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setEditing(null)} className="btn btn-ghost">
                Cancel
              </button>
              <button onClick={saveEdit} className="btn btn-primary">
                Save
              </button>
            </div>
          }
        >
          <h3 className="mb-4 font-display text-2xl">Fix this item</h3>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={editing.category ?? "other"}
              options={CATEGORIES}
              onChange={(v) => setEditing({ ...editing, category: v })}
            />
            <label className="block text-xs text-ink/70">
              Type (e.g. polo, shorts)
              <input
                value={editing.subtype ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, subtype: e.target.value })
                }
                maxLength={30}
                className="input mt-1"
              />
            </label>
            <label className="block text-xs text-ink/70">
              Color
              <input
                value={editing.color ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, color: e.target.value })
                }
                maxLength={40}
                className="input mt-1"
              />
            </label>
            <Select
              label="Pattern"
              value={editing.pattern ?? "solid"}
              options={PATTERNS}
              onChange={(v) => setEditing({ ...editing, pattern: v })}
            />
            <Select
              label="Formality"
              value={editing.formality ?? "casual"}
              options={FORMALITY}
              onChange={(v) => setEditing({ ...editing, formality: v })}
            />
            <Select
              label="Season"
              value={editing.season ?? "all_season"}
              options={SEASONS}
              onChange={(v) => setEditing({ ...editing, season: v })}
            />
            {editing.category === "eyewear" && (
              <label className="col-span-2 flex items-center gap-3 rounded-2xl bg-paper px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_prescription === true}
                  onChange={(e) =>
                    setEditing({ ...editing, is_prescription: e.target.checked })
                  }
                  className="h-5 w-5 accent-clay"
                />
                Prescription glasses (I need these to see)
              </label>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
