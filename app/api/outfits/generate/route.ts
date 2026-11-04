import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GeminiError } from "@/lib/gemini";
import {
  generateOutfits,
  describeItem,
  type CatalogItem,
} from "@/lib/outfits";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  let body: { occasion?: string; note?: string; count?: number } = {};
  try {
    body = await request.json();
  } catch {}
  const occasion =
    String(body.occasion ?? "").trim().slice(0, 80) || "Casual day out";
  const note = String(body.note ?? "").trim().slice(0, 200);
  const count = Math.min(5, Math.max(1, Number(body.count) || 3));

  // 1) The user's tagged wardrobe (Row Level Security limits this to their items)
  const { data: rows, error: itemsErr } = await supabase
    .from("items")
    .select("id, category, subtype, color, pattern, formality, season, tags")
    .eq("tag_status", "done")
    .order("created_at", { ascending: false })
    .limit(150);
  if (itemsErr) {
    return NextResponse.json({ error: "Could not read your closet" }, { status: 500 });
  }

  const items: CatalogItem[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    category: (r.category as string | null) ?? null,
    subtype: (r.subtype as string | null) ?? null,
    color: (r.color as string | null) ?? null,
    pattern: (r.pattern as string | null) ?? null,
    formality: (r.formality as string | null) ?? null,
    season: (r.season as string | null) ?? null,
    tags: (r.tags as string[] | null) ?? [],
  }));

  const has = (c: string) => items.some((i) => i.category === c);
  if (!has("one_piece") && !(has("top") && has("bottom"))) {
    return NextResponse.json(
      {
        error:
          "Add at least one top and one bottom (or a one-piece) and let AI tagging finish first.",
      },
      { status: 400 }
    );
  }

  // 2) What the user liked, disliked and wore recently
  const { data: past } = await supabase
    .from("outfits")
    .select("item_ids, liked, last_worn_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const byId = new Map(items.map((i) => [i.id, i]));
  const describeSet = (ids: string[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((x): x is CatalogItem => Boolean(x))
      .map(describeItem)
      .join(" + ");

  const liked: string[] = [];
  const disliked: string[] = [];
  const recentIds = new Set<string>();
  const cutoff = Date.now() - 4 * 24 * 3600 * 1000;
  for (const p of past ?? []) {
    const ids = (p.item_ids as string[] | null) ?? [];
    const text = describeSet(ids);
    if (text && p.liked === true && liked.length < 8) liked.push(text);
    if (text && p.liked === false && disliked.length < 8) disliked.push(text);
    if (
      p.last_worn_at &&
      new Date(p.last_worn_at as string).getTime() >= cutoff
    ) {
      ids.forEach((id) => recentIds.add(id));
    }
  }

  // 3) Ask Gemini
  try {
    const drafts = await generateOutfits({
      items,
      occasion,
      note,
      count,
      history: { liked, disliked, recentIds: Array.from(recentIds) },
    });

    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "The AI could not build a valid outfit this time. Please try again." },
        { status: 502 }
      );
    }

    const { error: insErr } = await supabase.from("outfits").insert(
      drafts.map((d) => ({
        user_id: user.id,
        occasion,
        name: d.name,
        reason: d.reason,
        item_ids: d.itemIds,
      }))
    );
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, created: drafts.length });
  } catch (e) {
    if (e instanceof GeminiError) {
      if (e.status === 429 || e.status === 500 || e.status === 503) {
        return NextResponse.json(
          {
            error:
              "The AI is busy (free tier limit). Wait about a minute and try again.",
            retry: true,
          },
          { status: e.status === 429 ? 429 : 503 }
        );
      }
      if ([400, 401, 403, 404].includes(e.status)) {
        return NextResponse.json({ error: e.message, fatal: true }, { status: 500 });
      }
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not generate outfits" },
      { status: 502 }
    );
  }
}
