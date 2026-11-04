"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Item = {
  id: string;
  image_path: string;
  url: string;
  category: string | null;
  color: string | null;
  pattern: string | null;
  formality: string | null;
  season: string | null;
  tags: string[];
  tag_status: string;
};

const pretty = (s: string) => s.replace(/_/g, " ");

export default function ItemGrid({ items }: { items: Item[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(item: Item) {
    if (!confirm("Remove this item from your closet?")) return;
    setRemoving(item.id);
    const supabase = createClient();
    await supabase.storage.from("wardrobe").remove([item.image_path]);
    await supabase.from("items").delete().eq("id", item.id);
    setRemoving(null);
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => {
        const done = item.tag_status === "done";
        const title = done
          ? `${item.color && item.color !== "unknown" ? item.color + " " : ""}${pretty(item.category ?? "item")}`
          : item.tag_status === "failed"
            ? "Tag failed"
            : "Tagging...";
        const chips = done
          ? Array.from(
              new Set(
                [
                  item.pattern && item.pattern !== "solid" ? item.pattern : null,
                  item.formality,
                  item.season,
                  ...item.tags.slice(0, 3),
                ]
                  .filter((c): c is string => Boolean(c))
                  .map(pretty)
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
              <button
                onClick={() => remove(item)}
                disabled={removing === item.id}
                className="mt-2 text-xs text-red-700 hover:underline disabled:opacity-50"
              >
                {removing === item.id ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
