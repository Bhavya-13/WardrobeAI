import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "../components/AppHeader";
import Uploader from "./Uploader";
import Tagger from "./Tagger";
import ItemGrid, { type Item } from "./ItemGrid";

// Per-user page (reads the login cookie), so it renders on every request.
export const instant = false;

export default async function ClosetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("items")
    .select(
      "id, image_path, category, subtype, color, pattern, formality, season, tags, tag_status"
    )
    .order("created_at", { ascending: false });

  const items = rows ?? [];

  // Photos are private, so we create temporary (1 hour) viewing links.
  const urlByPath: Record<string, string> = {};
  if (items.length > 0) {
    const { data: signed } = await supabase.storage
      .from("wardrobe")
      .createSignedUrls(
        items.map((i) => i.image_path),
        3600
      );
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
    });
  }

  const gridItems: Item[] = items.map((i) => ({
    id: i.id as string,
    image_path: i.image_path as string,
    url: urlByPath[i.image_path] ?? "",
    category: (i.category as string | null) ?? null,
    subtype: (i.subtype as string | null) ?? null,
    color: (i.color as string | null) ?? null,
    pattern: (i.pattern as string | null) ?? null,
    formality: (i.formality as string | null) ?? null,
    season: (i.season as string | null) ?? null,
    tags: (i.tags as string[] | null) ?? [],
    tag_status: (i.tag_status as string | null) ?? "pending",
  }));

  const pendingIds = gridItems
    .filter((i) => i.tag_status === "pending")
    .map((i) => i.id);
  const failedIds = gridItems
    .filter((i) => i.tag_status === "failed")
    .map((i) => i.id);

  const name = user.user_metadata?.full_name ?? user.email ?? "there";

  return (
    <main className="min-h-screen bg-[#F6F1EA] px-5 py-8 text-[#1F1F1F]">
      <div className="mx-auto max-w-5xl">
        <AppHeader name={name} active="closet" />

        <section className="mb-8">
          <h2 className="mb-1 text-xl font-semibold">Your closet</h2>
          <p className="mb-4 text-sm text-[#1F1F1F]/60">
            {gridItems.length} {gridItems.length === 1 ? "item" : "items"}. Add
            photos of your clothes, one item per photo works best. Tap
            &quot;Edit&quot; on a card to fix a wrong label.
          </p>
          <Uploader />
          <Tagger pendingIds={pendingIds} failedIds={failedIds} />
        </section>

        <ItemGrid items={gridItems} />
      </div>
    </main>
  );
}
