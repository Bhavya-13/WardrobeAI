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

export async function detectItems(
  base64Image: string,
  mimeType: string
): Promise<DetectedItem[]> {
  const models = OUTFIT_MODEL === TAG_MODEL ? [OUTFIT_MODEL] : [OUTFIT_MODEL, TAG_MODEL];
  let raw: Record<string, unknown> | undefined;
  let lastErr: unknown;
  for (const model of models) {
    try {
      raw = await callGeminiJson({
        model,
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
        schema: SCHEMA,
        temperature: 0.1,
      });
      break;
    } catch (e) {
      lastErr = e;
      if (e instanceof GeminiError && [404, 429, 503].includes(e.status)) continue;
      throw e;
    }
  }
  if (!raw) throw lastErr;

  const list = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [];
  const clamp = (n: number) => Math.min(1000, Math.max(0, Math.round(n)));
  const found: DetectedItem[] = [];

  for (const it of list) {
    const label = String(it.label ?? "").toLowerCase().trim();
    if (!(LABELS as readonly string[]).includes(label)) continue;
    const nums = Array.isArray(it.box_2d) ? it.box_2d.map((n: unknown) => Number(n)) : [];
    if (nums.length !== 4 || nums.some((n: number) => !Number.isFinite(n))) continue;
    const [ymin, xmin, ymax, xmax] = nums.map(clamp);
    if (ymax - ymin < 15 || xmax - xmin < 15) continue; // too tiny to be real
    found.push({
      label,
      box: [ymin, xmin, ymax, xmax],
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
  return result;
}
