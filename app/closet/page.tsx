import { redirect } from "next/navigation";
import { after, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";
import { imageUrl } from "@/lib/imgUrl";
import AppHeader from "../components/AppHeader";
import Uploader from "./Uploader";
import SelfieExtractor from "./SelfieExtractor";
import Tagger from "./Tagger";
import ThumbBackfill from "./ThumbBackfill";
import ItemGrid, { type Item } from "./ItemGrid";
import {
  TAG_VERSION,
  RECHECK_DAYS,
  RECHECK_BATCH,
  CLAIM_MINUTES,
  PURGE_MINUTES,
} from "@/lib/wardrobe";

// Per-user page (reads the login cookie), so it renders on every request.
export const instant = false;

export default async function ClosetPage() {
  await connection(); // this page is always rendered per request
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  // Erase items removed a couple of minutes ago for good (after the Undo window).
  // Runs AFTER the page has been sent, so it never slows the page down.
  after(async () => {
    try {
      const cutoff = new Date(
        Date.now() - PURGE_MINUTES * 60 * 1000
      ).toISOString();
      const { data: gone } = await supabase
        .from("items")
        .select("id, image_path, thumb_path")
        .lt("deleted_at", cutoff);
      if (gone && gone.length > 0) {
        const paths = gone
          .flatMap((g) => [g.image_path as string, g.thumb_path as string | null])
          .filter((p): p is string => Boolean(p));
        await supabase.storage.from("wardrobe").remove(paths);
        await supabase
          .from("items")
          .delete()
          .in(
            "id",
            gone.map((g) => g.id as string)
          );
      }
    } catch {
      // cleaning up can wait until the next visit
    }
  });

  const { data: rows } = await supabase
    .from("items")
    .select(
      "id, image_path, thumb_path, category, subtype, color, pattern, formality, season, tags, tag_status, tag_claimed_at, tag_source, tag_version, tagged_at, is_prescription"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const items = rows ?? [];

  // The small preview is shown when there is one (much faster to load).
  // Pictures come from our own site, so no "signing" round trip is needed.
  const shownPath = (i: { image_path: unknown; thumb_path: unknown }) =>
    ((i.thumb_path as string | null) ?? (i.image_path as string)) as string;

  const gridItems: Item[] = items.map((i) => {
    const key = shownPath(i);
    return {
      id: i.id as string,
      image_path: i.image_path as string,
      key,
      url: imageUrl(key),
      category: (i.category as string | null) ?? null,
      subtype: (i.subtype as string | null) ?? null,
      color: (i.color as string | null) ?? null,
      pattern: (i.pattern as string | null) ?? null,
      formality: (i.formality as string | null) ?? null,
      season: (i.season as string | null) ?? null,
      tags: (i.tags as string[] | null) ?? [],
      tag_status: (i.tag_status as string | null) ?? "pending",
      is_prescription: (i.is_prescription as boolean | null) ?? null,
    };
  });

  // Older items that do not have a small preview yet (made quietly in the background)
  const backfill = items
    .filter((i) => !i.thumb_path)
    .slice(0, 12)
    .map((i) => ({ id: i.id as string, image_path: i.image_path as string }));

  const now = Date.now();
  const claimCutoff = now - CLAIM_MINUTES * 60 * 1000;
  const staleCutoff = now - RECHECK_DAYS * 24 * 3600 * 1000;

  // Waiting to be tagged (or a tagging attempt that was abandoned)
  const pendingIds = items
    .filter((r) => {
      if (r.tag_status === "pending") return true;
      if (r.tag_status === "tagging") {
        const t = r.tag_claimed_at ? new Date(r.tag_claimed_at as string).getTime() : 0;
        return t < claimCutoff;
      }
      return false;
    })
    .map((r) => r.id as string);

  const failedIds = items
    .filter((r) => r.tag_status === "failed")
    .map((r) => r.id as string);

  // Old AI tags worth a second look (never tags you edited yourself)
  const staleIds = items
    .filter((r) => {
      if (r.tag_status !== "done" || r.tag_source === "user") return false;
      const version = (r.tag_version as number | null) ?? 0;
      const taggedAt = r.tagged_at ? new Date(r.tagged_at as string).getTime() : 0;
      return version < TAG_VERSION || taggedAt < staleCutoff;
    })
    .slice(0, RECHECK_BATCH)
    .map((r) => r.id as string);

  const name = user.name ?? user.email ?? "there";

  return (
    <div className="min-h-screen bg-cream pb-28 text-ink md:pb-12">
      <AppHeader name={name} active="closet" />

      <main className="fade-up mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            Your closet
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {gridItems.length} {gridItems.length === 1 ? "item" : "items"}
          </p>
        </div>

        <section className="card mb-8 p-5 sm:p-6">
          <h2 className="font-display text-xl">Add to your closet</h2>
          <p className="mb-4 mt-1 text-sm text-ink/60">
            Upload photos of single items, or photos of you wearing them and
            Outfi will pick out each piece.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Uploader />
            <SelfieExtractor />
          </div>
          <Tagger
            pendingIds={pendingIds}
            failedIds={failedIds}
            staleIds={staleIds}
          />
        </section>

        <ItemGrid items={gridItems} />
        <ThumbBackfill targets={backfill} />
      </main>
    </div>
  );
}
