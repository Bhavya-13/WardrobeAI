import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import AppHeader from "../components/AppHeader";
import OutfitGenerator from "./OutfitGenerator";
import OutfitToolbar from "./OutfitToolbar";
import OutfitCard, { type OutfitView } from "./OutfitCard";
import { CATEGORY_ORDER, pretty, type GlassesMode } from "@/lib/wardrobe";

// Per-user page (reads the login cookie), so it renders on every request.
export const instant = false;

export default async function OutfitsPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  // Three independent questions, asked at the same time (faster than one by one)
  const [profileRes, statsRes, outfitsRes] = await Promise.all([
    supabase.from("profiles").select("glasses_mode").maybeSingle(),
    supabase
      .from("items")
      .select("category, tag_status, is_prescription")
      .is("deleted_at", null),
    supabase
      .from("outfits")
      .select("id, occasion, name, reason, item_ids, liked, worn_count")
      .eq("hidden", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const savedMode = profileRes.data?.glasses_mode as string | undefined;
  const glassesMode: GlassesMode =
    savedMode === "always" || savedMode === "never" ? savedMode : "sometimes";

  // Closet stats, used for helpful hints
  const all = statsRes.data ?? [];
  const done = all.filter((s) => s.tag_status === "done");
  const countCat = (c: string) => done.filter((s) => s.category === c).length;
  const pending = all.length - done.length;
  const rxCount = done.filter(
    (s) => s.category === "eyewear" && s.is_prescription === true
  ).length;

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
  if (glassesMode === "always" && rxCount === 0)
    hints.push(
      "Glasses are set to Always, but no prescription pair is marked. In Closet, tap Edit on your glasses, set the category to Eyewear and tick Prescription."
    );

  const outfits = outfitsRes.data ?? [];
  const itemIds = Array.from(
    new Set(outfits.flatMap((o) => (o.item_ids as string[] | null) ?? []))
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
  const urlByPath: Record<string, string> = {};
  const shownPath = (i: ItemInfo) => i.thumb_path ?? i.image_path;

  if (itemIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, image_path, thumb_path, category, subtype, color")
      .is("deleted_at", null)
      .in("id", itemIds);
    (itemRows ?? []).forEach((r) => itemById.set(r.id as string, r as ItemInfo));

    const paths = (itemRows ?? []).map((r) => shownPath(r as ItemInfo));
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
        key: shownPath(i),
        url: urlByPath[shownPath(i)] ?? "",
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
      itemIds: ids,
      items,
    };
  });

  const notLikedIds = views.filter((v) => v.liked !== true).map((v) => v.id);
  const name = user.name ?? user.email ?? "there";

  return (
    <div className="min-h-screen bg-cream pb-28 text-ink md:pb-12">
      <AppHeader name={name} active="outfits" />

      <main className="fade-up mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            Outfits
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Fresh looks from the clothes you already own.
          </p>
        </div>

        <OutfitGenerator initialGlasses={glassesMode} />

        {hints.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-2xl bg-blush/50 p-4 text-sm text-ink/75">
            {hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        )}

        <h2 className="mb-3 mt-10 font-display text-2xl">Your outfits</h2>
        <OutfitToolbar ids={notLikedIds} />
        {views.length === 0 ? (
          <div className="card px-6 py-14 text-center">
            <p className="font-display text-xl">No outfits yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">
              Pick an occasion above and tap &quot;Make 3 outfits&quot;.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {views.map((v) => (
              <OutfitCard key={v.id} outfit={v} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
