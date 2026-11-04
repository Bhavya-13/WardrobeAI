"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { scaleToCanvas, canvasToBlob, makeThumbBlob } from "@/lib/image";
import { HangerSpinner } from "../components/HangerLoader";

const MAX_SIDE = 1280; // shrink big phone photos before uploading
const PARALLEL_UPLOADS = 3;

// One full-size copy (for the AI) and one small preview (for fast screens).
async function prepare(file: File): Promise<{ full: Blob; thumb: Blob }> {
  const bitmap = await createImageBitmap(file);
  const canvas = scaleToCanvas(bitmap, MAX_SIDE);
  bitmap.close();
  const full = await canvasToBlob(canvas, 0.85);
  const thumb = await makeThumbBlob(canvas);
  return { full, thumb };
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
          const { full, thumb } = await prepare(file);
          const id = crypto.randomUUID();
          const path = `${uid}/${id}.jpg`;
          const thumbPath = `${uid}/thumbs/${id}.jpg`;

          const [mainUp, thumbUp] = await Promise.all([
            supabase.storage
              .from("wardrobe")
              .upload(path, full, { contentType: "image/jpeg" }),
            supabase.storage
              .from("wardrobe")
              .upload(thumbPath, thumb, { contentType: "image/jpeg" }),
          ]);
          if (mainUp.error) {
            if (!thumbUp.error) {
              await supabase.storage.from("wardrobe").remove([thumbPath]);
            }
            throw mainUp.error;
          }

          const { error: dbErr } = await supabase.from("items").insert({
            user_id: uid,
            image_path: path,
            thumb_path: thumbUp.error ? null : thumbPath, // a missing preview is fine
          });
          if (dbErr) {
            await supabase.storage
              .from("wardrobe")
              .remove(thumbUp.error ? [path] : [path, thumbPath]);
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
        className="btn btn-primary w-full sm:w-auto"
      >
        {busy ? (
          <HangerSpinner size={20} />
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
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
