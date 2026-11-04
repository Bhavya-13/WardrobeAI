"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_MARGIN, EYEWEAR_MIN_MARGIN, pretty } from "@/lib/wardrobe";

type Detected = {
  id: string;
  label: string;
  box: [number, number, number, number];
  note: string;
  selected: boolean;
};

function scaleToCanvas(src: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * scale));
  c.height = Math.max(1, Math.round(src.height * scale));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not process the photo");
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function toBlob(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not compress the photo"))),
      "image/jpeg",
      quality
    )
  );
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the photo"));
    r.readAsDataURL(b);
  });
}

// Cuts one item out of the full-size photo, with a margin around the box.
function cropFrom(
  hi: HTMLCanvasElement,
  d: { label: string; box: [number, number, number, number] },
  margin: number
): HTMLCanvasElement {
  const W = hi.width;
  const H = hi.height;
  const [ymin, xmin, ymax, xmax] = d.box;
  const m = d.label === "eyewear" ? Math.max(margin, EYEWEAR_MIN_MARGIN) : margin;

  const bw = ((xmax - xmin) / 1000) * W;
  const bh = ((ymax - ymin) / 1000) * H;
  const padX = Math.max(8, bw * m);
  const padY = Math.max(8, bh * m);

  const sx = Math.max(0, (xmin / 1000) * W - padX);
  const sy = Math.max(0, (ymin / 1000) * H - padY);
  const ex = Math.min(W, (xmax / 1000) * W + padX);
  const ey = Math.min(H, (ymax / 1000) * H + padY);
  const sw = Math.max(1, ex - sx);
  const sh = Math.max(1, ey - sy);

  const scale = Math.min(1, 1024 / Math.max(sw, sh)); // only ever shrink
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not crop the photo");
  ctx.drawImage(hi, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

export default function SelfieExtractor() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const hiRef = useRef<HTMLCanvasElement | null>(null);
  const [step, setStep] = useState<"idle" | "detecting" | "review" | "saving">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<Detected[]>([]);
  const [margin, setMargin] = useState(DEFAULT_MARGIN);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const itemsKey = items.map((i) => i.id).join(",");

  // Re-draw the preview crops whenever the margin slider moves.
  useEffect(() => {
    const hi = hiRef.current;
    if (step !== "review" || !hi) return;
    const next: Record<string, string> = {};
    for (const it of items) {
      next[it.id] = cropFrom(hi, it, margin).toDataURL("image/jpeg", 0.8);
    }
    setPreviews(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, margin, step]);

  async function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setStep("detecting");
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");

      const bitmap = await createImageBitmap(file);
      const hi = scaleToCanvas(bitmap, 2400); // used for the final crops
      const det = scaleToCanvas(bitmap, 1280); // smaller copy sent to the AI
      bitmap.close();
      hiRef.current = hi;

      const image = await blobToBase64(await toBlob(det, 0.85));
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mime: "image/jpeg" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not analyse the photo.");

      const found: Detected[] = (body.items ?? []).map(
        (d: { label: string; box: [number, number, number, number]; note: string }) => ({
          id: crypto.randomUUID(),
          label: d.label,
          box: d.box,
          note: d.note,
          selected: true,
        })
      );
      if (found.length === 0) {
        throw new Error(
          "I could not find any clothes. Try a clear, full-body photo in good light."
        );
      }
      setItems(found);
      setMargin(DEFAULT_MARGIN);
      setStep("review");
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Something went wrong.");
      setStep("idle");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function addSelected() {
    const hi = hiRef.current;
    const chosen = items.filter((i) => i.selected);
    if (!hi || chosen.length === 0) return;
    setStep("saving");
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Please log in again.");
      setStep("review");
      return;
    }

    let added = 0;
    const errs: string[] = [];
    for (const it of chosen) {
      try {
        const blob = await toBlob(cropFrom(hi, it, margin), 0.9);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("wardrobe")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase
          .from("items")
          .insert({ user_id: user.id, image_path: path, category: it.label });
        if (dbErr) {
          await supabase.storage.from("wardrobe").remove([path]);
          throw dbErr;
        }
        added++;
      } catch (e) {
        errs.push(
          `${pretty(it.label)}: ${(e as { message?: string })?.message ?? "failed"}`
        );
      }
    }

    hiRef.current = null; // the original photo is never saved
    setItems([]);
    setPreviews({});
    setStep("idle");
    if (errs.length > 0) setError(errs.join(" | "));
    if (added > 0) {
      setNotice(
        `Added ${added} ${added === 1 ? "item" : "items"}. AI is tagging them now.`
      );
    }
    router.refresh();
  }

  function cancel() {
    hiRef.current = null;
    setItems([]);
    setPreviews({});
    setStep("idle");
  }

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={step !== "idle"}
        className="rounded-xl border border-[#1F1F1F] px-6 py-3 transition hover:bg-[#1F1F1F] hover:text-white disabled:opacity-50"
      >
        {step === "detecting"
          ? "Finding your clothes..."
          : "Add from a photo of me"}
      </button>
      {notice && <p className="mt-2 text-sm text-green-800">{notice}</p>}
      {error && step === "idle" && (
        <p className="mt-2 max-w-md text-sm text-red-700">{error}</p>
      )}

      {(step === "review" || step === "saving") && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[#F6F1EA] p-5 text-[#1F1F1F] shadow-xl">
            <h3 className="text-lg font-semibold">Found in your photo</h3>
            <p className="mb-4 text-sm text-[#1F1F1F]/60">
              Untick anything wrong. Your photo is not saved, only the items you
              add.
            </p>

            <label className="mb-4 block text-xs text-[#1F1F1F]/70">
              Space around each item: {Math.round(margin * 100)}%
              <input
                type="range"
                min={0}
                max={40}
                step={2}
                value={Math.round(margin * 100)}
                onChange={(e) => setMargin(Number(e.target.value) / 100)}
                disabled={step === "saving"}
                className="mt-1 w-full"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((it) => (
                <button
                  key={it.id}
                  disabled={step === "saving"}
                  onClick={() =>
                    setItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, selected: !x.selected } : x
                      )
                    )
                  }
                  className={`overflow-hidden rounded-xl bg-white text-left shadow-sm ring-2 transition ${
                    it.selected ? "ring-[#1F1F1F]" : "opacity-50 ring-transparent"
                  }`}
                >
                  {previews[it.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[it.id]}
                      alt={it.note || it.label}
                      className="aspect-square w-full bg-[#1F1F1F]/5 object-contain"
                    />
                  ) : (
                    <div className="aspect-square w-full bg-[#1F1F1F]/5" />
                  )}
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium capitalize">
                      {it.selected ? "[x] " : "[ ] "}
                      {pretty(it.label)}
                    </p>
                    <p className="truncate text-[10px] text-[#1F1F1F]/60">
                      {it.note}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={cancel}
                disabled={step === "saving"}
                className="rounded-xl border border-[#1F1F1F]/30 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={addSelected}
                disabled={step === "saving" || selectedCount === 0}
                className="rounded-xl bg-[#1F1F1F] px-5 py-2 text-sm text-white disabled:opacity-50"
              >
                {step === "saving"
                  ? "Adding..."
                  : `Add ${selectedCount} ${selectedCount === 1 ? "item" : "items"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
