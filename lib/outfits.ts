// Asks Gemini (text only, no photos) to build outfits from the tagged wardrobe.

import {
  callGeminiJson,
  GeminiError,
  OUTFIT_MODEL,
  TAG_MODEL,
} from "./gemini";

export type CatalogItem = {
  id: string;
  category: string | null;
  subtype: string | null;
  color: string | null;
  pattern: string | null;
  formality: string | null;
  season: string | null;
  tags: string[];
};

export type OutfitDraft = {
  name: string;
  itemIds: string[];
  reason: string;
};

export function describeItem(i: CatalogItem): string {
  return [i.color && i.color !== "unknown" ? i.color : null, i.subtype ?? i.category]
    .filter(Boolean)
    .join(" ");
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    outfits: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          item_ids: { type: "ARRAY", items: { type: "STRING" } },
          reason: { type: "STRING" },
        },
        required: ["name", "item_ids", "reason"],
        propertyOrdering: ["name", "item_ids", "reason"],
      },
    },
  },
  required: ["outfits"],
};

export async function generateOutfits(args: {
  items: CatalogItem[];
  occasion: string;
  note: string;
  count: number;
  history: { liked: string[]; disliked: string[]; recentIds: string[] };
}): Promise<OutfitDraft[]> {
  const { items, occasion, note, count, history } = args;

  // Short ids (i1, i2...) keep the prompt small and stop the AI inventing ids.
  const shortToId = new Map<string, string>();
  const idToShort = new Map<string, string>();
  const catalog = items.map((it, idx) => {
    const sid = `i${idx + 1}`;
    shortToId.set(sid, it.id);
    idToShort.set(it.id, sid);
    return [
      sid,
      it.category ?? "other",
      it.subtype ?? "-",
      it.color ?? "-",
      it.pattern ?? "-",
      it.formality ?? "-",
      it.tags.slice(0, 5).join(", ") || "-",
    ].join(" | ");
  });

  const recent = history.recentIds
    .map((id) => idToShort.get(id))
    .filter((x): x is string => Boolean(x));

  const prompt = `You are a personal stylist with good, modern, wearable taste.
Build ${count} DIFFERENT outfits for this occasion: "${occasion}".${note ? `\nExtra request from the user: "${note}"` : ""}

Use ONLY items from the catalog below, referenced by their id (like i3).
Catalog columns: id | category | type | color | pattern | formality | tags
${catalog.join("\n")}

Rules:
- Every outfit needs either exactly one "one_piece" item, OR exactly one "top" plus exactly one "bottom".
- Add exactly one "footwear" item if the catalog has footwear that suits the look.
- "outerwear", "bag" and "accessory" items are optional. Add them only if they clearly improve the outfit.
- Match formality to the occasion. Never mix clashing formality (for example formal trousers with athletic shorts).
- Good colour harmony: neutrals mix freely; use at most one bold colour or one bold pattern per outfit.
- Do not repeat the same combination, and spread different items across outfits when the catalog is large enough.
${recent.length ? `- RECENTLY WORN, avoid these when other options exist: ${recent.join(", ")}.\n` : ""}${history.liked.length ? `- The user LIKED outfits like: ${history.liked.join(" | ")}. Prefer similar combinations.\n` : ""}${history.disliked.length ? `- The user DISLIKED outfits like: ${history.disliked.join(" | ")}. Avoid similar combinations.\n` : ""}
For each outfit return: a short catchy name (max 4 words), the item ids, and one friendly sentence (max 25 words) explaining why it works, written to the user.`;

  // Try the smarter model first, fall back to the lighter one if it is busy.
  const models = OUTFIT_MODEL === TAG_MODEL ? [OUTFIT_MODEL] : [OUTFIT_MODEL, TAG_MODEL];
  let raw: Record<string, unknown> | undefined;
  let lastErr: unknown;
  for (const model of models) {
    try {
      raw = await callGeminiJson({
        model,
        parts: [{ text: prompt }],
        schema: SCHEMA,
        temperature: 0.9,
      });
      break;
    } catch (e) {
      lastErr = e;
      if (e instanceof GeminiError && [404, 429, 503].includes(e.status)) continue;
      throw e;
    }
  }
  if (!raw) throw lastErr;

  // Check the AI's work: real items, valid structure, no duplicates.
  const byId = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const out: OutfitDraft[] = [];
  const list = Array.isArray(raw.outfits) ? (raw.outfits as Record<string, unknown>[]) : [];

  for (const o of list) {
    const ids: string[] = Array.isArray(o.item_ids)
      ? o.item_ids
          .map((x: unknown) => shortToId.get(String(x).trim().toLowerCase()))
          .filter((x: string | undefined): x is string => Boolean(x))
      : [];
    const uniq = Array.from(new Set(ids));
    const cats = uniq.map((id) => byId.get(id)?.category ?? "other");
    const n = (c: string) => cats.filter((x) => x === c).length;

    const isOnePiece = n("one_piece") === 1 && n("top") === 0 && n("bottom") === 0;
    const isPair = n("top") === 1 && n("bottom") === 1 && n("one_piece") === 0;
    if (!isOnePiece && !isPair) continue;
    if (n("footwear") > 1 || n("outerwear") > 1 || n("bag") > 1) continue;

    const key = [...uniq].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name: String(o.name ?? "").trim().slice(0, 40) || "Outfit",
      itemIds: uniq,
      reason: String(o.reason ?? "").trim().slice(0, 220),
    });
  }
  return out.slice(0, count);
}
