"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_SIDE = 1280; // shrink big phone photos before uploading
const PARALLEL_UPLOADS = 3;

async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not compress image"))),
      "image/jpeg",
      0.85
    )
  );
}

export default function Uploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) {
      setErrors(["Please choose image files."]);
      return;
    }

    setBusy(true);
    setErrors([]);
    setProgress({ done: 0, total: files.length });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrors(["Your session expired. Please log in again."]);
      setBusy(false);
      return;
    }
    const uid = user.id;

    let next = 0;
    let done = 0;
    const errs: string[] = [];

    async function worker() {
      while (next < files.length) {
        const file = files[next++];
        try {
          const blob = await compress(file);
          const path = `${uid}/${crypto.randomUUID()}.jpg`;

          const { error: upErr } = await supabase.storage
            .from("wardrobe")
            .upload(path, blob, { contentType: "image/jpeg" });
          if (upErr) throw upErr;

          const { error: dbErr } = await supabase
            .from("items")
            .insert({ user_id: uid, image_path: path });
          if (dbErr) {
            await supabase.storage.from("wardrobe").remove([path]);
            throw dbErr;
          }
        } catch (e) {
          const msg = (e as { message?: string })?.message ?? "upload failed";
          errs.push(`${file.name}: ${msg}`);
        }
        done++;
        setProgress({ done, total: files.length });
      }
    }

    await Promise.all(
      Array.from({ length: PARALLEL_UPLOADS }, () => worker())
    );

    setErrors(errs);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-xl bg-[#1F1F1F] px-6 py-3 text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy
          ? `Uploading ${progress.done}/${progress.total}...`
          : "Add photos"}
      </button>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-red-700">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
