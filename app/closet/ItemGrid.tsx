"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  PATTERNS,
  FORMALITY,
  SEASONS,
  pretty,
} from "@/lib/wardrobe";

export type Item = {
  id: string;
  image_path: string;
  url: string;
  category: string | null;
  subtype: string | null;
  color: string | null;
  pattern: string | null;
  formality: string | null;
  season: string | null;
  tags: string[];
  tag_status: string;
};

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
    <label className="block text-xs text-[#1F1F1F]/70">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#1F1F1F]/20 bg-white px-2 py-2 text-sm capitalize text-[#1F1F1F]"
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
  const [removing, setRemoving] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  async function remove(item: Item) {
    if (!confirm("Remove this item from your closet?")) return;
    setRemoving(item.id);
    const supabase = createClient();
    await supabase.storage.from("wardrobe").remove([item.image_path]);
    await supabase.from("items").delete().eq("id", item.id);
    setRemoving(null);
    router.refresh();
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("items")
      .update({
        category: editing.category,
        subtype: editing.subtype?.trim().toLowerCase() || null,
        color: editing.color?.trim().toLowerCase() || null,
        pattern: editing.pattern,
        formality: editing.formality,
        season: editing.season,
        tag_status: "done",
        tag_source: "user", // AI re-checks never overwrite your fixes
        tag_claimed_at: null,
      })
      .eq("id", editing.id);
    setSaving(false);
    setEditing(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1F1F1F]/30 p-10 text-center text-[#1F1F1F]/60">
        Your closet is empty. Tap &quot;Add photos&quot; to upload your first
        items.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => {
          const done = item.tag_status === "done";
          const title = done
            ? pretty(
                `${item.color && item.color !== "unknown" ? item.color + " " : ""}${item.subtype ?? item.category ?? "item"}`
              )
            : item.tag_status === "failed"
              ? "Tag failed"
              : "Tagging...";

          const chips = done
            ? Array.from(
                new Set(
                  [
                    item.category,
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
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={title}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-square w-full bg-[#1F1F1F]/5" />
              )}
              <div className="px-3 py-2">
                <p className="text-sm font-medium capitalize">{title}</p>
                {chips.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {chips.map((c, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-[#F6F1EA] px-2 py-0.5 text-[10px] capitalize text-[#1F1F1F]/70"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-3 text-xs">
                  <button
                    onClick={() => setEditing({ ...item })}
                    className="hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(item)}
                    disabled={removing === item.id}
                    className="text-red-700 hover:underline disabled:opacity-50"
                  >
                    {removing === item.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => !saving && setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#F6F1EA] p-5 text-[#1F1F1F] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold">Fix this item</h3>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Category"
                value={editing.category ?? "other"}
                options={CATEGORIES}
                onChange={(v) => setEditing({ ...editing, category: v })}
              />
              <label className="block text-xs text-[#1F1F1F]/70">
                Type (e.g. polo, shorts)
                <input
                  value={editing.subtype ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, subtype: e.target.value })
                  }
                  maxLength={30}
                  className="mt-1 w-full rounded-lg border border-[#1F1F1F]/20 bg-white px-2 py-2 text-sm text-[#1F1F1F]"
                />
              </label>
              <label className="block text-xs text-[#1F1F1F]/70">
                Color
                <input
                  value={editing.color ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, color: e.target.value })
                  }
                  maxLength={40}
                  className="mt-1 w-full rounded-lg border border-[#1F1F1F]/20 bg-white px-2 py-2 text-sm text-[#1F1F1F]"
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
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="rounded-xl border border-[#1F1F1F]/30 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="rounded-xl bg-[#1F1F1F] px-5 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
