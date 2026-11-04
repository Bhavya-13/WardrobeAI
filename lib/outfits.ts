// Asks Gemini (text only, no photos) to build outfits from the tagged wardrobe.

import {
  callGeminiJson,
  GeminiError,
  OUTFIT_MODEL,
  TAG_MODEL,
} from "./gemini";
import type { GlassesMode } from "./wardrobe";

export type CatalogItem = {
  id: string;
  category: string | null;
  subtype: string | null;
  color: string | null;
  pattern: string | null;
  formality: string | null;
  season: string | null;
  tags: string[];
  is_prescription: boolean | null;
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

// The code (not the AI) makes sure the glasses setting is respected.
function applyEyewear(
  ids: string[],
  mode: GlassesMode,
  byId: Map<string, CatalogItem>,
  rxIds: string[],
  usage: Map<string, number>
): string[] {
  const isEye = (id: string) => byId.get(id)?.category === "eyewear";
  const eye = ids.filter(isEye);
  const rest = ids.filter((id) => !isEye(id));

  let chosen: string | null = null;
  if (mode === "always" && rxIds.length > 0) {
    // keep the AI's prescription pick, else the pair used least so far
    chosen =
      eye.find((id) => rxIds.includes(id)) ??
      [...rxIds].sort((a, b) => (usage.get(a) ?? 0) - (usage.get(b) ?? 0))[0];
  } else if (mode === "never") {
    chosen = eye.find((id) => !byId.get(id)?.is_prescription) ?? null;
  } else {
    chosen = eye[0] ?? null;
  }

  if (chosen) {
    usage.set(chosen, (usage.get(chosen) ?? 0) + 1);
    return [...rest, chosen];
  }
  return rest;
}

export async function generateOutfits(args: {
  items: CatalogItem[];
  occasion: string;
  note: string;
  count: number;
  glassesMode: GlassesMode;
  history: { liked: string[]; disliked: string[]; recentIds: string[] };
}): Promise<OutfitDraft[]> {
  const { items, occasion, note, count, glassesMode, history } = args;

  // Short ids (i1, i2...) keep the prompt small and stop the AI inventing ids.
  const shortToId = new Map<string, string>();
  const idToShort = new Map<string, string>();
  const catalog = items.map((it, idx) => {
    const sid = `i${idx + 1}`;
    shortToId.set(sid, it.id);
    idToShort.set(it.id, sid);
    const rx =
      it.category === "eyewear" ? (it.is_prescription ? "prescription" : "sunglasses") : "-";
    return [
      sid,
      it.category ?? "other",
      it.subtype ?? "-",
      it.color ?? "-",
      it.pattern ?? "-",
      it.formality ?? "-",
      it.tags.slice(0, 5).join(", ") || "-",
      rx,
    ].join(" | ");
  });

  const recent = history.recentIds
    .map((id) => idToShort.get(id))
    .filter((x): x is string => Boolean(x));

  const rxIds = items
    .filter((i) => i.category === "eyewear" && i.is_prescription === true)
    .map((i) => i.id);
  const rxShort = rxIds.map((id) => idToShort.get(id)).filter(Boolean);

  const glassesRule =
    glassesMode === "always" && rxShort.length > 0
      ? `- The user wears prescription glasses every day. EVERY outfit MUST include exactly one prescription frame from: ${rxShort.join(", ")}. Pick the frame that suits that outfit best. Do not use sunglasses.\n`
      : glassesMode === "never" && rxShort.length > 0
        ? `- The user does not wear prescription glasses. Never use these prescription frames: ${rxShort.join(", ")}.\n`
        : "";

  const prompt = `You are a personal stylist with good, modern, wearable taste.
Build ${count} DIFFERENT outfits for this occasion: "${occasion}".${note ? `\nExtra request from the user: "${note}"` : ""}

Use ONLY items from the catalog below, referenced by their id (like i3).
Catalog columns: id | category | type | color | pattern | formality | tags | eyewear kind
${catalog.join("\n")}

Rules:
- Every outfit needs either exactly one "one_piece" item, OR exactly one "top" plus exactly one "bottom".
- Add exactly one "footwear" item if the catalog has footwear that suits the look.
- "outerwear", "bag", "accessory" and "eyewear" items are optional. Add them only if they clearly improve the outfit. At most one pair of eyewear per outfit.
${glassesRule}- Match formality to the occasion. Never mix clashing formality (for example formal trousers with athletic shorts).
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
  const usage = new Map<string, number>();
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

    const finalIds = applyEyewear(uniq, glassesMode, byId, rxIds, usage);

    const key = [...finalIds].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name: String(o.name ?? "").trim().slice(0, 40) || "Outfit",
      itemIds: finalIds,
      reason: String(o.reason ?? "").trim().slice(0, 220),
    });
  }
  return out.slice(0, count);
}
