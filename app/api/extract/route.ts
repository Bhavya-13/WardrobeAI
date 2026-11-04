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
    return NextResponse.json(
      { error: "Not logged in", code: "auth" },
      { status: 401 }
    );
  }

  let body: { image?: string; mime?: string } = {};
  try {
    body = await request.json();
  } catch {}
  const image = String(body.image ?? "");
  if (!image) {
    return NextResponse.json(
      { error: "No photo received", code: "error" },
      { status: 400 }
    );
  }
  if (image.length > 3_500_000) {
    return NextResponse.json(
      { error: "That photo is too large", code: "too_large" },
      { status: 413 }
    );
  }
  const mime = body.mime === "image/png" ? "image/png" : "image/jpeg";

  try {
    const { items, diagnostics } = await detectItems(image, mime);
    return NextResponse.json({ items, diagnostics });
  } catch (e) {
    if (e instanceof GeminiError) {
      const status =
        e.code === "busy"
          ? e.status === 429
            ? 429
            : 503
          : e.code === "config"
            ? 500
            : 422;
      return NextResponse.json(
        { error: e.message, code: e.code, detail: e.message.slice(0, 200) },
        { status }
      );
    }
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Could not analyse the photo",
        code: "error",
        detail: e instanceof Error ? e.message.slice(0, 200) : undefined,
      },
      { status: 502 }
    );
  }
}
