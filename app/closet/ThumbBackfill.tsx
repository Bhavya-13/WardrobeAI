"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { makeThumbBlob } from "@/lib/image";

// Quietly makes small preview pictures for older items, a few per visit.
// After that the closet loads much faster.
export default function ThumbBackfill({
  targets,
}: {
  targets: { id: string; image_path: string }[];
}) {
  const router = useRouter();
  const handled = useRef<Set<string>>(new Set());
  const key = targets.map((t) => t.id).join(",");

  useEffect(() => {
    if (targets.length === 0) return;
    // skip on "data saver" connections
    const conn = (navigator as unknown as { connection?: { saveData?: boolean } })
      .connection;
    if (conn?.saveData) return;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let made = 0;
      for (const t of targets) {
        if (cancelled) break;
        if (handled.current.has(t.id)) continue;
        handled.current.add(t.id);
        try {
          const { data: blob, error } = await supabase.storage
            .from("wardrobe")
            .download(t.image_path);
          if (error || !blob) continue;
          const bitmap = await createImageBitmap(blob);
          const thumb = await makeThumbBlob(bitmap);
          bitmap.close();

          const path = `${user.id}/thumbs/${crypto.randomUUID()}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("wardrobe")
            .upload(path, thumb, { contentType: "image/jpeg" });
          if (upErr) continue;
          const { error: dbErr } = await supabase
            .from("items")
            .update({ thumb_path: path })
            .eq("id", t.id);
          if (dbErr) {
            await supabase.storage.from("wardrobe").remove([path]);
            continue;
          }
          made++;
        } catch {
          // skip this one, try again next visit
        }
      }
      if (made > 0) router.refresh();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
