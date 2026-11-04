import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tagClothing, GeminiError } from "@/lib/gemini";

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
  try {
    const body = await request.json();
    itemId = body?.itemId;
  } catch {}
  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  // Row Level Security guarantees this only finds the logged-in user's items.
  const { data: item, error: itemErr } = await supabase
    .from("items")
    .select("id, image_path, tag_status")
    .eq("id", itemId)
    .single();
  if (itemErr || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (item.tag_status === "done") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: file, error: dlErr } = await supabase.storage
    .from("wardrobe")
    .download(item.image_path);
  if (dlErr || !file) {
    await supabase.from("items").update({ tag_status: "failed" }).eq("id", itemId);
    return NextResponse.json({ error: "Could not read the photo" }, { status: 502 });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const tags = await tagClothing(base64, "image/jpeg");

    const { error: upErr } = await supabase
      .from("items")
      .update({ ...tags, tag_status: "done" })
      .eq("id", itemId);
    if (upErr) throw new Error(upErr.message);

    return NextResponse.json({ ok: true, tags });
  } catch (e) {
    if (e instanceof GeminiError) {
      // Busy or rate limited: the browser waits and retries, item stays "pending".
      if (e.status === 429 || e.status === 500 || e.status === 503) {
        return NextResponse.json(
          { error: e.message, retry: true },
          { status: e.status === 429 ? 429 : 503 }
        );
      }
      // Bad key, wrong model name, etc.: stop everything, item stays "pending".
      if ([400, 401, 403, 404].includes(e.status)) {
        return NextResponse.json({ error: e.message, fatal: true }, { status: 500 });
      }
    }
    await supabase.from("items").update({ tag_status: "failed" }).eq("id", itemId);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Tagging failed" },
      { status: 502 }
    );
  }
}
