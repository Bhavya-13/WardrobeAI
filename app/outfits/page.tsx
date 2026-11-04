import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "../components/AppHeader";
import OutfitGenerator from "./OutfitGenerator";
import OutfitCard, { type OutfitView } from "./OutfitCard";
import { CATEGORY_ORDER, pretty } from "@/lib/wardrobe";

// Per-user page (reads the login cookie), so it renders on every request.
export const instant = false;

export default async function OutfitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Closet stats, used for helpful hints
  const { data: stats } = await supabase
    .from("items")
    .select("category, tag_status");
  const all = stats ?? [];
  const done = all.filter((s) => s.tag_status === "done");
  const countCat = (c: string) => done.filter((s) => s.category === c).length;
  const pending = all.length - done.length;

  const hints: string[] = [];
  if (all.length === 0) hints.push("Your closet is empty. Add photos in Closet first.");
  if (pending > 0)
    hints.push(
      `${pending} ${pending === 1 ? "item is" : "items are"} still being tagged. Open Closet and let tagging finish.`
    );
  if (done.length > 0 && countCat("footwear") === 0)
    hints.push("No footwear yet. Add photos of your shoes for complete outfits.");
  if (done.length > 0 && countCat("top") + countCat("one_piece") === 0)
    hints.push("No tops yet. Outfits need a top and a bottom (or a one-piece).");
  if (done.length > 0 && countCat("bottom") + countCat("one_piece") === 0)
    hints.push("No bottoms yet. Outfits need a top and a bottom (or a one-piece).");

  // Saved outfits
  const { data: outfitRows } = await supabase
    .from("outfits")
    .select("id, occasion, name, reason, item_ids, liked, worn_count")
    .order("created_at", { ascending: false })
    .limit(24);
  const outfits = outfitRows ?? [];

  const itemIds = Array.from(
    new Set(outfits.flatMap((o) => (o.item_ids as string[] | null) ?? []))
  );

  type ItemInfo = {
    id: string;
    image_path: string;
    category: string | null;
    subtype: string | null;
    color: string | null;
  };
  const itemById = new Map<string, ItemInfo>();
  const urlByPath: Record<string, string> = {};

  if (itemIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, image_path, category, subtype, color")
      .in("id", itemIds);
    (itemRows ?? []).forEach((r) => itemById.set(r.id as string, r as ItemInfo));

    const paths = (itemRows ?? []).map((r) => r.image_path as string);
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("wardrobe")
        .createSignedUrls(paths, 3600);
      signed?.forEach((s) => {
        if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
      });
    }
  }

  const views: OutfitView[] = outfits.map((o) => {
    const ids = (o.item_ids as string[] | null) ?? [];
    const items = ids
      .map((id) => itemById.get(id))
      .filter((x): x is ItemInfo => Boolean(x))
      .sort(
        (a, b) =>
          (CATEGORY_ORDER[a.category ?? "other"] ?? 9) -
          (CATEGORY_ORDER[b.category ?? "other"] ?? 9)
      )
      .map((i) => ({
        id: i.id,
        url: urlByPath[i.image_path] ?? "",
        label: pretty(
          [i.color && i.color !== "unknown" ? i.color : null, i.subtype ?? i.category]
            .filter(Boolean)
            .join(" ")
        ),
      }));
    return {
      id: o.id as string,
      name: (o.name as string | null) ?? "Outfit",
      reason: (o.reason as string | null) ?? "",
      occasion: (o.occasion as string | null) ?? "",
      liked: (o.liked as boolean | null) ?? null,
      worn_count: (o.worn_count as number | null) ?? 0,
      items,
    };
  });

  const name = user.user_metadata?.full_name ?? user.email ?? "there";

  return (
    <main className="min-h-screen bg-[#F6F1EA] px-5 py-8 text-[#1F1F1F]">
      <div className="mx-auto max-w-5xl">
        <AppHeader name={name} active="outfits" />

        <OutfitGenerator />

        {hints.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl bg-white/60 p-4 text-sm text-[#1F1F1F]/70">
            {hints.map((h, i) => (
              <li key={i}>- {h}</li>
            ))}
          </ul>
        )}

        <h2 className="mb-4 mt-8 text-xl font-semibold">Your outfits</h2>
        {views.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1F1F1F]/30 p-10 text-center text-[#1F1F1F]/60">
            No outfits yet. Pick an occasion above and tap &quot;Make 3 outfits&quot;.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {views.map((v) => (
              <OutfitCard key={v.id} outfit={v} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
