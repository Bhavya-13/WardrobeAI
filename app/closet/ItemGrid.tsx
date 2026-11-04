"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Item = {
  id: string;
  image_path: string;
  url: string;
  category: string | null;
  color: string | null;
};

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
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative overflow-hidden rounded-2xl bg-white shadow-sm"
        >
          {item.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.category ?? "Clothing item"}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="aspect-square w-full bg-[#1F1F1F]/5" />
          )}
          <div className="flex items-center justify-between px-3 py-2 text-xs text-[#1F1F1F]/70">
            <span>{item.category ?? "Untagged"}</span>
            <button
              onClick={() => remove(item)}
              disabled={removing === item.id}
              className="text-red-700 hover:underline disabled:opacity-50"
            >
              {removing === item.id ? "..." : "Remove"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
