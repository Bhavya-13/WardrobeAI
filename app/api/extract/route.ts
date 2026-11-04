import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GeminiError } from "@/lib/gemini";
import { detectItems } from "@/lib/extract";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  let body: { image?: string; mime?: string } = {};
  try {
    body = await request.json();
  } catch {}
  const image = String(body.image ?? "");
  if (!image) {
    return NextResponse.json({ error: "No photo received" }, { status: 400 });
  }
  if (image.length > 3_500_000) {
    return NextResponse.json({ error: "That photo is too large" }, { status: 413 });
  }
  const mime = body.mime === "image/png" ? "image/png" : "image/jpeg";

  try {
    const items = await detectItems(image, mime);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof GeminiError) {
      if (e.status === 429 || e.status === 500 || e.status === 503) {
        return NextResponse.json(
          {
            error:
              "The AI is busy (free tier limit). Wait about a minute and try again.",
          },
          { status: e.status === 429 ? 429 : 503 }
        );
      }
      if ([400, 401, 403, 404].includes(e.status)) {
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not analyse the photo" },
      { status: 502 }
    );
  }
}
