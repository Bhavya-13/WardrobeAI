import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import { imageUrl } from "@/lib/imgUrl";
import AppHeader from "../components/AppHeader";
import WornCard, { type WornView } from "./WornCard";
import { CATEGORY_ORDER, pretty } from "@/lib/wardrobe";
import { monthKey, monthLabel } from "@/lib/dates";

// Per-user page (reads the login cookie), so it renders on every request.
export const instant = false;

const LIMIT = 100;

export default async function WornPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("outfit_wears")
    .select("id, outfit_id, outfit_name, occasion, item_ids, place, worn_on")
    .is("deleted_at", null)
    .order("worn_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  const wears = rows ?? [];

  const itemIds = Array.from(
    new Set(wears.flatMap((w) => (w.item_ids as string[] | null) ?? []))
  );

  type ItemInfo = {
    id: string;
    image_path: string;
    thumb_path: string | null;
    category: string | null;
    subtype: string | null;
    color: string | null;
  };
  const itemById = new Map<string, ItemInfo>();
  const shownPath = (i: ItemInfo) => i.thumb_path ?? i.image_path;

  if (itemIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, image_path, thumb_path, category, subtype, color")
      .is("deleted_at", null)
      .in("id", itemIds);
    (itemRows ?? []).forEach((r) => itemById.set(r.id as string, r as ItemInfo));
  }

  const views: WornView[] = wears.map((w) => {
    const ids = (w.item_ids as string[] | null) ?? [];
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
        key: shownPath(i),
        url: imageUrl(shownPath(i)),
        label: pretty(
          [i.color && i.color !== "unknown" ? i.color : null, i.subtype ?? i.category]
            .filter(Boolean)
            .join(" ")
        ),
      }));
    return {
      id: w.id as string,
      outfitId: (w.outfit_id as string | null) ?? null,
      name: (w.outfit_name as string | null) ?? "Outfit",
      occasion: (w.occasion as string | null) ?? "",
      place: (w.place as string | null) ?? "",
      wornOn: String(w.worn_on),
      itemIds: ids,
      items,
    };
  });

  // group by month, newest first
  const groups: { key: string; label: string; entries: WornView[] }[] = [];
  for (const v of views) {
    const key = monthKey(v.wornOn);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(v);
    else groups.push({ key, label: monthLabel(key), entries: [v] });
  }

  const placeCount = new Set(
    views.map((v) => v.place.trim().toLowerCase()).filter(Boolean)
  ).size;

  const name = user.name ?? user.email ?? "there";

  return (
    <div className="min-h-screen bg-cream pb-28 text-ink md:pb-12">
      <AppHeader name={name} active="worn" />

      <main className="fade-up mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            Worn
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Your outfit diary.
            {views.length > 0 && (
              <>
                {" "}
                {views.length} {views.length === 1 ? "outfit" : "outfits"} logged
                {placeCount > 0
                  ? `, ${placeCount} ${placeCount === 1 ? "place" : "places"}`
                  : ""}
                {views.length >= LIMIT ? " (showing your latest 100)" : ""}.
              </>
            )}
          </p>
        </div>

        {views.length === 0 ? (
          <div className="card px-6 py-14 text-center">
            <p className="font-display text-xl">Nothing logged yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">
              Tap &quot;Wore it&quot; on an outfit and add where you wore it.
              It will show up here.
            </p>
            <Link href="/outfits" className="btn btn-primary mt-6">
              Go to Outfits
            </Link>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="mb-8">
              <h2 className="mb-3 font-display text-xl text-ink/70">
                {g.label}
              </h2>
              <div className="space-y-4">
                {g.entries.map((v) => (
                  <WornCard key={v.id} entry={v} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
