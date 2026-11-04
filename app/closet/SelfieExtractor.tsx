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
        className="btn btn-ghost w-full sm:w-auto"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
        {step === "detecting"
          ? "Finding your clothes..."
          : "Add from a photo of me"}
      </button>
      {notice && <p className="mt-2 text-sm text-sage">{notice}</p>}
      {error && step === "idle" && (
        <p className="mt-2 max-w-md text-sm text-red-700">{error}</p>
      )}

      {(step === "review" || step === "saving") && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4">
          <div className="sheet max-h-[92vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl bg-cream p-5 shadow-xl sm:rounded-3xl sm:p-6">
            <h3 className="font-display text-2xl">Found in your photo</h3>
            <p className="mb-4 mt-1 text-sm text-ink/60">
              Tap an item to untick it if it is wrong. Your photo is not saved,
              only the items you add.
            </p>

            <label className="mb-4 block text-xs text-ink/70">
              Space around each item: {Math.round(margin * 100)}%
              <input
                type="range"
                min={0}
                max={40}
                step={2}
                value={Math.round(margin * 100)}
                onChange={(e) => setMargin(Number(e.target.value) / 100)}
                disabled={step === "saving"}
                className="mt-2 w-full accent-clay"
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
                  aria-pressed={it.selected}
                  className={`relative overflow-hidden rounded-2xl bg-paper text-left shadow-soft ring-2 transition ${
                    it.selected ? "ring-clay" : "opacity-50 ring-transparent"
                  }`}
                >
                  {previews[it.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[it.id]}
                      alt={it.note || it.label}
                      className="aspect-square w-full bg-sand/50 object-contain"
                    />
                  ) : (
                    <div className="aspect-square w-full bg-sand/50" />
                  )}
                  <span
                    className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border text-cream ${
                      it.selected
                        ? "border-clay bg-clay"
                        : "border-ink/30 bg-paper"
                    }`}
                  >
                    {it.selected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </span>
                  <div className="px-3 py-2">
                    <p className="text-xs font-medium capitalize">
                      {pretty(it.label)}
                    </p>
                    <p className="truncate text-[11px] text-ink/55">
                      {it.note}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={cancel}
                disabled={step === "saving"}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={addSelected}
                disabled={step === "saving" || selectedCount === 0}
                className="btn btn-primary"
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
