// Finds each clothing item worn by the person in a photo (bounding boxes) AND
// labels it (type, colour, style...) in the same single AI request.
// The browser then crops the boxes out of the original photo.

import {
  callGeminiJson,
  GeminiError,
  OUTFIT_MODEL,
  TAG_MODEL,
  TAG_FIELD_RULES,
  TAG_PROPS,
  TAG_FIELD_NAMES,
  normalizeTags,
  type ClothingTags,
} from "./gemini";

export type DetectedItem = {
  label: string;
  // [ymin, xmin, ymax, xmax], each 0 to 1000 relative to the image size
  box: [number, number, number, number];
  note: string;
  // Already labelled, so no second AI request is needed for this item
  tags: ClothingTags;
};

// What happened, so the app can explain an empty result instead of just failing.
export type Diagnostics = {
  raw: number; // how many items the AI reported
  kept: number; // how many were usable
  dropped: string[]; // why the others were thrown away
};

const LABELS = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "footwear",
  "eyewear",
  "bag",
  "accessory",
] as const;

const ORDER: Record<string, number> = {
  outerwear: 0,
  top: 1,
  one_piece: 1,
  bottom: 2,
  footwear: 3,
  eyewear: 4,
  bag: 5,
  accessory: 6,
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING", enum: [...LABELS] },
          box_2d: { type: "ARRAY", items: { type: "INTEGER" } },
          note: { type: "STRING" },
          ...TAG_PROPS,
        },
        required: ["label", "box_2d", "note", ...TAG_FIELD_NAMES],
        propertyOrdering: ["label", "box_2d", "note", ...TAG_FIELD_NAMES],
      },
    },
  },
  required: ["items"],
};

const PROMPT = `You are helping digitise a wardrobe from a photo of one person.
Find each clothing item or accessory worn by the MAIN person (the most prominent person only; ignore anyone else).
Return one entry per item with:
- label: top, bottom, one_piece, outerwear, footwear, eyewear, bag or accessory
- box_2d: a tight bounding box [ymin, xmin, ymax, xmax] with every value from 0 to 1000, relative to the image size
- note: 3 to 6 words describing it (colour and type)
Then describe each item with these fields:
${TAG_FIELD_RULES}
Rules:
- Shoes: return ONE box that covers both shoes (label footwear), only if they are visible.
- Eyewear: only glasses or sunglasses that are actually visible. One box around the frames.
- If a jacket or open shirt is worn over a top, return both the outerwear and the visible top.
- A dress, saree or jumpsuit is one_piece, so do not also return a top or bottom for it.
- Do not return skin, hair or the background. Do not guess items that are hidden or cut off.`;

const clamp = (n: number) => Math.min(1000, Math.max(0, Math.round(n)));

// Accepts the box in slightly different shapes instead of rejecting it.
function parseBox(v: unknown): [number, number, number, number] | null {
  let arr: unknown = v;
  if (Array.isArray(arr) && arr.length === 1 && Array.isArray(arr[0])) arr = arr[0];
  if (!Array.isArray(arr) || arr.length !== 4) return null;
  let nums = arr.map((n: unknown) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  if (Math.max(...nums) <= 1.5) nums = nums.map((n) => n * 1000); // 0 to 1 scale
  const [a, b, c, d] = nums.map(clamp);
  // tolerate swapped corners
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

function processItems(raw: Record<string, unknown>): {
  items: DetectedItem[];
  diagnostics: Diagnostics;
} {
  const list = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [];
  const dropped: string[] = [];
  const found: DetectedItem[] = [];

  for (const it of list) {
    const label = String(it.label ?? "").toLowerCase().trim();
    if (!(LABELS as readonly string[]).includes(label)) {
      dropped.push(`an unknown item type (${label || "empty"})`);
      continue;
    }
    const box = parseBox(it.box_2d);
    if (!box) {
      dropped.push(`the ${label} had no usable position`);
      continue;
    }
    const [ymin, xmin, ymax, xmax] = box;
    if (ymax - ymin < 8 || xmax - xmin < 8) {
      dropped.push(`the ${label} looked too small`);
      continue;
    }
    found.push({
      label,
      box,
      note: String(it.note ?? "").trim().slice(0, 60),
      // the label decides the category; the rest is cleaned up for the database
      tags: normalizeTags({ ...it, category: label }),
    });
  }

  // Keep the biggest box per label (up to 3 accessories).
  const area = (d: DetectedItem) =>
    (d.box[2] - d.box[0]) * (d.box[3] - d.box[1]);
  const byLabel = new Map<string, DetectedItem[]>();
  for (const d of found) {
    const arr = byLabel.get(d.label) ?? [];
    arr.push(d);
    byLabel.set(d.label, arr);
  }
  const result: DetectedItem[] = [];
  byLabel.forEach((arr, label) => {
    arr.sort((a, b) => area(b) - area(a));
    result.push(...arr.slice(0, label === "accessory" ? 3 : 1));
  });
  result.sort((a, b) => (ORDER[a.label] ?? 9) - (ORDER[b.label] ?? 9));

  return {
    items: result,
    diagnostics: { raw: list.length, kept: result.length, dropped: dropped.slice(0, 5) },
  };
}

export async function detectItems(
  base64Image: string,
  mimeType: string
): Promise<{ items: DetectedItem[]; diagnostics: Diagnostics }> {
  const models = OUTFIT_MODEL === TAG_MODEL ? [OUTFIT_MODEL] : [OUTFIT_MODEL, TAG_MODEL];
  let last: { items: DetectedItem[]; diagnostics: Diagnostics } | null = null;

  for (let i = 0; i < models.length; i++) {
    const hasNext = i < models.length - 1;
    try {
      const raw = await callGeminiJson({
        model: models[i],
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
        schema: SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 8192, // room for several items with full labels
      });
      const result = processItems(raw);
      last = result;
      // Found something, or nothing left to try: done. Otherwise ask the second model.
      if (result.items.length > 0 || !hasNext) return result;
    } catch (e) {
      if (
        hasNext &&
        e instanceof GeminiError &&
        [404, 422, 429, 503].includes(e.status)
      ) {
        continue;
      }
      if (last) return last; // the first model answered (empty), the second failed
      throw e;
    }
  }
  if (last) return last;
  throw new GeminiError("The AI did not answer", 502, "bad_answer");
}
