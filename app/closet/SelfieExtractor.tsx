"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_MARGIN,
  EYEWEAR_MIN_MARGIN,
  TAG_VERSION,
  pretty,
} from "@/lib/wardrobe";

const MAX_PHOTOS = 10; // photos per batch (keeps phones from running out of memory)
const PREVIEW_SIDE = 1000; // size kept in memory for the review screen
const DETECT_SIDE = 1280; // size sent to the AI
const FINAL_SIDE = 2400; // size used for the final crops
const PARALLEL = 2; // photos analysed at the same time

type Box = [number, number, number, number];

// Labels the AI already worked out while finding the item
type Labels = {
  category: string;
  subtype: string | null;
  color: string;
  pattern: string;
  formality: string;
  season: string;
  tags: string[];
  is_prescription: boolean | null;
};

type Diagnostics = { raw: number; kept: number; dropped: string[] };

type Detected = {
  id: string;
  photoId: string;
  label: string;
  box: Box;
  note: string;
  labels?: Labels;
  selected: boolean;
};

type Photo = {
  id: string;
  name: string;
  thumb: string;
};

// A photo that could not be used, with the reason in plain words
type Failure = {
  name: string;
  file: File;
  reason: string;
  tip: string;
  detail?: string;
  retry: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class DetectError extends Error {
  code: string;
  detail?: string;
  constructor(code: string, detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

// Turns a failure code into something a person can understand and act on.
function explain(
  code: string,
  detail?: string,
  diag?: Diagnostics
): { reason: string; tip: string; retry: boolean } {
  switch (code) {
    case "busy":
      return {
        reason: "The AI was busy (free limit reached)",
        tip: "Wait a minute, then press Try again.",
        retry: true,
      };
    case "blocked":
      return {
        reason: "The AI declined to look at this photo",
        tip: "Try a different photo.",
        retry: false,
      };
    case "cut_off":
      return {
        reason: "The AI's answer was cut off",
        tip: "Press Try again. If it keeps happening, use a photo with fewer items in view.",
        retry: true,
      };
    case "bad_answer":
      return {
        reason: "The AI sent back something I could not read",
        tip: "Press Try again.",
        retry: true,
      };
    case "config":
      return {
        reason: "The AI service is not set up correctly",
        tip: "Check GEMINI_API_KEY and the model names in your settings.",
        retry: false,
      };
    case "too_large":
      return {
        reason: "The photo is too large to send",
        tip: "Use a smaller photo.",
        retry: false,
      };
    case "auth":
      return {
        reason: "Your session expired",
        tip: "Refresh the page and log in again.",
        retry: false,
      };
    case "network":
      return {
        reason: "The connection dropped",
        tip: "Check your internet, then press Try again.",
        retry: true,
      };
    case "unreadable":
      return {
        reason: "Your browser could not open this photo",
        tip: "iPhone HEIC photos can fail in some browsers. Share it as a JPEG, or take a screenshot of it.",
        retry: false,
      };
    case "no_items":
      if (diag && diag.raw > 0) {
        return {
          reason: `The AI saw ${diag.raw} ${diag.raw === 1 ? "item" : "items"} but could not mark where ${diag.raw === 1 ? "it is" : "they are"}`,
          tip: "Press Try again.",
          retry: true,
        };
      }
      return {
        reason: "The AI did not see any clothes in this photo",
        tip: "Use a clear, well-lit photo where your clothes are visible, ideally full-body. Pressing Try again sometimes works.",
        retry: true,
      };
    default:
      return {
        reason: "Something went wrong analysing this photo",
        tip: "Press Try again.",
        retry: true,
      };
  }
}

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

// Small square picture of the whole photo, shown above its items.
function makeThumb(src: HTMLCanvasElement): string {
  const size = 96;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const side = Math.min(src.width, src.height);
  ctx.drawImage(
    src,
    (src.width - side) / 2,
    (src.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size
  );
  return c.toDataURL("image/jpeg", 0.7);
}

// Cuts one item out of a photo, with a margin around the box.
function cropFrom(
  hi: HTMLCanvasElement,
  d: { label: string; box: Box },
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

// Asks the server which items are in one photo (and what each one is).
// Waits and retries if the free AI limit is hit.
async function detect(image: string): Promise<{
  items: { label: string; box: Box; note: string; tags?: Labels }[];
  diagnostics?: Diagnostics;
}> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mime: "image/jpeg" }),
      });
    } catch {
      throw new DetectError("network");
    }
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { items: body.items ?? [], diagnostics: body.diagnostics };
    if (body.code === "busy" || res.status === 429 || res.status === 503) {
      await sleep(6000 * (attempt + 1));
      continue;
    }
    throw new DetectError(body.code ?? "error", body.detail ?? body.error);
  }
  throw new DetectError("busy");
}

// The list of photos that did not work, each with its reason.
function FailureList({
  failures,
  busy,
  onRetry,
  onDismiss,
}: {
  failures: Failure[];
  busy: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (failures.length === 0) return null;
  const retryable = failures.filter((f) => f.retry).length;
  return (
    <div className="mb-4 rounded-2xl bg-blush/50 p-4 text-sm">
      <p className="font-medium">
        {failures.length} {failures.length === 1 ? "photo" : "photos"} could not
        be used
      </p>
      <ul className="mt-2 space-y-3">
        {failures.map((f, i) => (
          <li key={i}>
            <p className="truncate font-medium text-ink/90">{f.name}</p>
            <p className="text-ink/75">
              {f.reason}. {f.tip}
            </p>
            {f.detail && (
              <p className="mt-0.5 break-words text-[11px] text-ink/45">
                {f.detail}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {retryable > 0 && (
          <button
            onClick={onRetry}
            disabled={busy}
            className="btn btn-primary btn-sm"
          >
            Try {retryable === 1 ? "it" : `these ${retryable}`} again
          </button>
        )}
        <button onClick={onDismiss} disabled={busy} className="btn btn-ghost btn-sm">
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function SelfieExtractor() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasesRef = useRef<Record<string, HTMLCanvasElement>>({});
  const filesRef = useRef<Record<string, File>>({});
  const [step, setStep] = useState<"idle" | "detecting" | "review" | "saving">(
    "idle"
  );
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [items, setItems] = useState<Detected[]>([]);
  const [margin, setMargin] = useState(DEFAULT_MARGIN);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const itemsKey = items.map((i) => i.id).join(",");

  // Re-draw the preview crops whenever the margin slider moves.
  useEffect(() => {
    if (step !== "review") return;
    const next: Record<string, string> = {};
    for (const it of items) {
      const canvas = canvasesRef.current[it.photoId];
      if (canvas) next[it.id] = cropFrom(canvas, it, margin).toDataURL("image/jpeg", 0.8);
    }
    setPreviews(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, margin, step]);

  function resetAll() {
    canvasesRef.current = {};
    filesRef.current = {};
    setPhotos([]);
    setItems([]);
    setPreviews({});
    setNotes([]);
    setFailures([]);
  }

  // Analyses a list of photos. Used for the first pick and for "Try again".
  async function runDetection(files: File[]): Promise<{
    photos: Photo[];
    items: Detected[];
    failures: Failure[];
  }> {
    setProgress({ done: 0, total: files.length });

    const okPhotos: (Photo | null)[] = new Array(files.length).fill(null);
    const foundByIndex: Detected[][] = files.map(() => []);
    const failed: Failure[] = [];
    let next = 0;
    let done = 0;

    const fail = (
      file: File,
      code: string,
      detail?: string,
      diag?: Diagnostics
    ) => {
      const e = explain(code, detail, diag);
      failed.push({
        name: file.name,
        file,
        reason: e.reason,
        tip: e.tip,
        detail: detail && code !== "no_items" ? detail : undefined,
        retry: e.retry,
      });
    };

    async function worker() {
      while (next < files.length) {
        const index = next++;
        const file = files[index];
        const photoId = crypto.randomUUID();
        try {
          let bitmap: ImageBitmap;
          try {
            bitmap = await createImageBitmap(file);
          } catch {
            fail(file, "unreadable");
            continue;
          }
          const preview = scaleToCanvas(bitmap, PREVIEW_SIDE);
          const det = scaleToCanvas(bitmap, DETECT_SIDE);
          bitmap.close();

          const image = await blobToBase64(await toBlob(det, 0.85));
          const result = await detect(image);

          if (result.items.length === 0) {
            fail(file, "no_items", undefined, result.diagnostics);
          } else {
            canvasesRef.current[photoId] = preview;
            filesRef.current[photoId] = file;
            okPhotos[index] = {
              id: photoId,
              name: file.name,
              thumb: makeThumb(preview),
            };
            foundByIndex[index] = result.items.map((d) => ({
              id: crypto.randomUUID(),
              photoId,
              label: d.label,
              box: d.box,
              note: d.note,
              labels: d.tags,
              selected: true,
            }));
          }
        } catch (e) {
          if (e instanceof DetectError) {
            fail(file, e.code, e.detail);
          } else {
            fail(file, "error", (e as { message?: string })?.message);
          }
        } finally {
          done++;
          setProgress({ done, total: files.length });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, files.length) }, () => worker())
    );

    return {
      photos: okPhotos.filter((p): p is Photo => p !== null),
      items: foundByIndex.flat(),
      failures: failed,
    };
  }

  async function onPick(fileList: FileList | null) {
    const picked = Array.from(fileList ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length === 0) return;

    const files = picked.slice(0, MAX_PHOTOS);
    resetAll();
    setError(null);
    setNotice(null);
    setStep("detecting");

    const res = await runDetection(files);

    setNotes(
      picked.length > MAX_PHOTOS
        ? [`Only the first ${MAX_PHOTOS} photos were used. You can add more afterwards.`]
        : []
    );
    setFailures(res.failures);

    if (res.items.length === 0) {
      setStep("idle"); // the reasons are shown below the button
      return;
    }
    setPhotos(res.photos);
    setItems(res.items);
    setMargin(DEFAULT_MARGIN);
    setStep("review");
  }

  async function retryFailed() {
    const retryFiles = failures.filter((f) => f.retry).map((f) => f.file);
    if (retryFiles.length === 0) return;
    const keep = failures.filter((f) => !f.retry);
    setError(null);
    setStep("detecting");

    const res = await runDetection(retryFiles);

    setFailures([...keep, ...res.failures]);
    setPhotos((p) => [...p, ...res.photos]);
    setItems((i) => [...i, ...res.items]);
    setStep(items.length + res.items.length > 0 ? "review" : "idle");
  }

  async function addSelected() {
    const chosen = items.filter((i) => i.selected);
    if (chosen.length === 0) return;
    setStep("saving");
    setError(null);
    setProgress({ done: 0, total: chosen.length });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Please log in again.");
      setStep("review");
      return;
    }

    // Group by photo so each photo is opened full-size only once.
    const byPhoto = new Map<string, Detected[]>();
    chosen.forEach((it) => {
      const arr = byPhoto.get(it.photoId) ?? [];
      arr.push(it);
      byPhoto.set(it.photoId, arr);
    });

    let added = 0;
    let labelled = 0;
    let done = 0;
    const errs: string[] = [];

    for (const [photoId, list] of Array.from(byPhoto.entries())) {
      let hi: HTMLCanvasElement | null = null;
      try {
        const file = filesRef.current[photoId];
        const bitmap = await createImageBitmap(file);
        hi = scaleToCanvas(bitmap, FINAL_SIDE);
        bitmap.close();
      } catch {
        errs.push("One of the photos could not be reopened.");
        done += list.length;
        setProgress({ done, total: chosen.length });
        continue;
      }

      for (const it of list) {
        try {
          const blob = await toBlob(cropFrom(hi, it, margin), 0.9);
          const path = `${user.id}/${crypto.randomUUID()}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("wardrobe")
            .upload(path, blob, { contentType: "image/jpeg" });
          if (upErr) throw upErr;

          // If the AI already labelled the item, save the labels now. No second
          // AI request is needed. Otherwise it simply joins the tagging queue.
          const row: Record<string, unknown> = {
            user_id: user.id,
            image_path: path,
            category: it.label,
          };
          if (it.labels) {
            Object.assign(row, {
              category: it.labels.category,
              subtype: it.labels.subtype,
              color: it.labels.color,
              pattern: it.labels.pattern,
              formality: it.labels.formality,
              season: it.labels.season,
              tags: it.labels.tags,
              is_prescription: it.labels.is_prescription,
              tag_status: "done",
              tag_source: "ai",
              tagged_at: new Date().toISOString(),
              tag_version: TAG_VERSION,
            });
          }

          const { error: dbErr } = await supabase.from("items").insert(row);
          if (dbErr) {
            await supabase.storage.from("wardrobe").remove([path]);
            throw dbErr;
          }
          added++;
          if (it.labels) labelled++;
        } catch (e) {
          errs.push(
            `${pretty(it.label)}: ${(e as { message?: string })?.message ?? "failed"}`
          );
        }
        done++;
        setProgress({ done, total: chosen.length });
      }
    }

    resetAll(); // the original photos are never saved
    setStep("idle");
    if (errs.length > 0) setError(errs.join(" | "));
    if (added > 0) {
      const word = added === 1 ? "item" : "items";
      setNotice(
        labelled === added
          ? `Added ${added} ${word}, already labelled.`
          : `Added ${added} ${word}. AI is labelling the rest now.`
      );
    }
    router.refresh();
  }

  function cancel() {
    resetAll();
    setStep("idle");
  }

  function togglePhoto(photoId: string) {
    const mine = items.filter((i) => i.photoId === photoId);
    const allOn = mine.every((i) => i.selected);
    setItems(
      items.map((i) => (i.photoId === photoId ? { ...i, selected: !allOn } : i))
    );
  }

  const selectedCount = items.filter((i) => i.selected).length;
  const busy = step === "saving";
  const working = step === "detecting" || step === "saving";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
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
          ? `Analysing photo ${Math.min(progress.done + 1, progress.total)} of ${progress.total}...`
          : "Add from a photo of me"}
      </button>

      {step === "detecting" && (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sand sm:w-72"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-clay transition-all"
            style={{
              width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      {step === "idle" && !notice && !error && failures.length === 0 && (
        <p className="mt-2 text-xs text-ink/50">
          Tip: select several photos at once (up to {MAX_PHOTOS}).
        </p>
      )}
      {notice && <p className="mt-2 text-sm text-sage">{notice}</p>}
      {error && step === "idle" && (
        <p className="mt-2 max-w-md text-sm text-red-700">{error}</p>
      )}

      {/* why a photo did not work (when nothing else is open) */}
      {step === "idle" && failures.length > 0 && (
        <div className="mt-4 max-w-xl">
          <FailureList
            failures={failures}
            busy={working}
            onRetry={retryFailed}
            onDismiss={() => setFailures([])}
          />
        </div>
      )}

      {(step === "review" || step === "saving") && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4">
          <div className="sheet max-h-[92vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl bg-cream px-5 pt-5 shadow-xl sm:rounded-3xl sm:px-6 sm:pt-6">
            <h3 className="font-display text-2xl">
              Found in your {photos.length === 1 ? "photo" : "photos"}
            </h3>
            <p className="mb-3 mt-1 text-sm text-ink/60">
              {items.length} {items.length === 1 ? "item" : "items"} from{" "}
              {photos.length} {photos.length === 1 ? "photo" : "photos"}, already
              labelled. Tap an item to untick it. Your photos are not saved,
              only the items you add.
              {photos.length > 1 &&
                " Same piece in several photos? Untick the repeats."}
            </p>

            {notes.length > 0 && (
              <ul className="mb-3 space-y-1 rounded-2xl bg-sand/60 px-4 py-3 text-xs text-ink/75">
                {notes.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}

            <FailureList
              failures={failures}
              busy={working}
              onRetry={retryFailed}
              onDismiss={() => setFailures([])}
            />

            <label className="mb-5 block text-xs text-ink/70">
              Space around each item: {Math.round(margin * 100)}%
              <input
                type="range"
                min={0}
                max={40}
                step={2}
                value={Math.round(margin * 100)}
                onChange={(e) => setMargin(Number(e.target.value) / 100)}
                disabled={busy}
                className="mt-2 w-full accent-clay"
              />
            </label>

            {photos.map((photo, pi) => {
              const mine = items.filter((i) => i.photoId === photo.id);
              const allOn = mine.every((i) => i.selected);
              return (
                <section key={photo.id} className="mb-6">
                  <div className="mb-2 flex items-center gap-3">
                    {photo.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.thumb}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        Photo {pi + 1}
                      </p>
                      <p className="truncate text-xs text-ink/50">
                        {mine.length} {mine.length === 1 ? "item" : "items"} found
                      </p>
                    </div>
                    <button
                      onClick={() => togglePhoto(photo.id)}
                      disabled={busy}
                      className="btn btn-ghost btn-sm"
                    >
                      {allOn ? "Untick all" : "Tick all"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {mine.map((it) => {
                      const lb = it.labels;
                      const title = lb
                        ? pretty(
                            `${lb.color && lb.color !== "unknown" ? lb.color + " " : ""}${lb.subtype ?? lb.category}`
                          )
                        : pretty(it.label);
                      return (
                        <button
                          key={it.id}
                          disabled={busy}
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
                            <p className="truncate text-xs font-medium capitalize">
                              {title}
                            </p>
                            <p className="truncate text-[11px] capitalize text-ink/55">
                              {lb
                                ? `${pretty(lb.category)} / ${pretty(lb.formality)}`
                                : it.note}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

            {/* stays visible at the bottom while you scroll through many items */}
            <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-2 border-t border-line bg-cream px-5 py-3 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
              <button onClick={cancel} disabled={busy} className="btn btn-ghost">
                Cancel
              </button>
              <button
                onClick={addSelected}
                disabled={busy || selectedCount === 0}
                className="btn btn-primary"
              >
                {busy
                  ? `Adding ${progress.done}/${progress.total}...`
                  : `Add ${selectedCount} ${selectedCount === 1 ? "item" : "items"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
