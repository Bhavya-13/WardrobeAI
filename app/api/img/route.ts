import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";

// Hands out your clothing pictures from your own site.
//
// Pictures used to come from Supabase through a temporary link that changed on
// every page load, so the phone downloaded everything again each visit. Here the
// address of a picture never changes and is marked "keep for a year", so after the
// first time the phone shows it straight from its own memory.
//
// Pictures stay private: you must be logged in, and Supabase's own rules still
// apply because the file is fetched with YOUR login.

// Only paths shaped like <user id>/<file>.jpg or <user id>/thumbs/<file>.jpg
const PATH = /^[0-9a-f-]{36}\/(thumbs\/)?[0-9a-f-]{36}\.jpg$/i;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("p") ?? "";
  if (!PATH.test(path)) {
    return new Response("Not found", { status: 404, headers: NO_STORE });
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return new Response("Please log in", { status: 401, headers: NO_STORE });
  }
  // an extra guard on top of Supabase's rules: only your own folder
  if (!path.startsWith(`${user.id}/`)) {
    return new Response("Not found", { status: 404, headers: NO_STORE });
  }

  const { data, error } = await supabase.storage.from("wardrobe").download(path);
  if (error || !data) {
    return new Response("Not found", { status: 404, headers: NO_STORE });
  }

  return new Response(data, {
    headers: {
      "Content-Type": "image/jpeg",
      // private = only this device may keep it; immutable = the file never changes
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
