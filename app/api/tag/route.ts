import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tagClothing, GeminiError } from "@/lib/gemini";
import { TAG_VERSION, CLAIM_MINUTES } from "@/lib/wardrobe";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in", fatal: true }, { status: 401 });
  }

  let itemId: string | undefined;
  let recheck = false;
  try {
    const body = await request.json();
    itemId = body?.itemId;
    recheck = body?.recheck === true;
  } catch {}
  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }
  const id: string = itemId;

  // Row Level Security guarantees this only finds the logged-in user's items.
  const { data: item, error: itemErr } = await supabase
    .from("items")
    .select("id, image_path, tag_status, tag_claimed_at, tag_source")
    .eq("id", id)
    .single();
  if (itemErr || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const status = item.tag_status as string;
  const claimedAt = (item.tag_claimed_at as string | null) ?? null;
  const claimedMs = claimedAt ? new Date(claimedAt).getTime() : 0;

  // 1) Someone else (another tab, a reload) is already tagging this item.
  if (status === "tagging" && Date.now() - claimedMs < CLAIM_MINUTES * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: "in_progress" });
  }
  // 2) Already tagged: never tag again, unless this is a re-check of an AI tag.
  //    Tags you fixed by hand are never overwritten.
  if (status === "done" && (!recheck || item.tag_source === "user")) {
    return NextResponse.json({ ok: true, skipped: "already_tagged" });
  }

  // 3) Claim the item so two requests can never tag it at the same time.
  let claim = supabase
    .from("items")
    .update({ tag_status: "tagging", tag_claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tag_status", status);
  if (claimedAt) claim = claim.eq("tag_claimed_at", claimedAt);
  const { data: claimed, error: claimErr } = await claim.select("id");
  if (claimErr || !claimed || claimed.length === 0) {
    return NextResponse.json({ ok: true, skipped: "in_progress" });
  }

  // If anything goes wrong we put the item back the way it was.
  const wasDone = status === "done";
  const restore = async (permanent: boolean) => {
    const back = wasDone ? "done" : permanent ? "failed" : "pending";
    await supabase
      .from("items")
      .update({ tag_status: back, tag_claimed_at: null })
      .eq("id", id);
  };

  const { data: file, error: dlErr } = await supabase.storage
    .from("wardrobe")
    .download(item.image_path as string);
  if (dlErr || !file) {
    await restore(true);
    return NextResponse.json({ error: "Could not read the photo" }, { status: 502 });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const tags = await tagClothing(base64, "image/jpeg");

    // Save once. From now on this item is "done" and is not tagged again.
    const { error: upErr } = await supabase
      .from("items")
      .update({
        ...tags,
        tag_status: "done",
        tag_claimed_at: null,
        tagged_at: new Date().toISOString(),
        tag_version: TAG_VERSION,
        tag_source: "ai",
      })
      .eq("id", id);
    if (upErr) throw new Error(upErr.message);

    return NextResponse.json({ ok: true, tags });
  } catch (e) {
    if (e instanceof GeminiError) {
      // Busy or rate limited: browser waits and retries later.
      if (e.status === 429 || e.status === 500 || e.status === 503) {
        await restore(false);
        return NextResponse.json(
          { error: e.message, retry: true },
          { status: e.status === 429 ? 429 : 503 }
        );
      }
      // Bad key, wrong model name, etc.
      if ([400, 401, 403, 404].includes(e.status)) {
        await restore(false);
        return NextResponse.json({ error: e.message, fatal: true }, { status: 500 });
      }
    }
    await restore(true);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Tagging failed" },
      { status: 502 }
    );
  }
}
