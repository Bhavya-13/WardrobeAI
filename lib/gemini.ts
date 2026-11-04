// Calls the Gemini API (server-side only). The key is read from GEMINI_API_KEY
// and is never sent to the browser.

import { CATEGORIES, PATTERNS, FORMALITY, SEASONS } from "./wardrobe";

export const TAG_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const OUTFIT_MODEL = process.env.GEMINI_OUTFIT_MODEL || "gemini-3.8-flash";

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Sends one request and returns the parsed JSON answer.
export async function callGeminiJson(opts: {
  model: string;
  parts: unknown[];
  schema: unknown;
  temperature?: number;
}): Promise<Record<string, unknown>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // 401 = treated as a configuration problem by the API routes
    throw new GeminiError("GEMINI_API_KEY is not set on the server", 401);
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ parts: opts.parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: opts.temperature ?? 0.2,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new GeminiError(`Gemini ${res.status}: ${text.slice(0, 300)}`, res.status);
  }

  const json = await res.json();
  const parts: { text?: string }[] = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  if (!text) {
    throw new GeminiError("Gemini returned no answer", 422);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini returned an unreadable answer", 422);
  }
}

// ---------- Tagging one clothing photo ----------

export type ClothingTags = {
  category: string;
  subtype: string | null;
  color: string;
  pattern: string;
  formality: string;
  season: string;
  tags: string[];
};

const TAG_PROMPT = `You are a fashion expert cataloguing a personal wardrobe.
The photo shows ONE clothing item or accessory (it may be on a bed, hanger, floor or a person). Describe only the main item.
Rules:
- category: top (shirts, tees, polos, kurtas, sweaters), bottom (jeans, trousers, skirts, shorts), one_piece (dresses, sarees, jumpsuits), outerwear (jackets, coats, blazers, hoodies), footwear, bag, accessory (watch, belt, scarf, jewellery, cap), or other.
- subtype: the specific garment type in 1-2 lowercase words, e.g. t-shirt, polo, shirt, kurta, jeans, chinos, shorts, joggers, sneakers, sandals, jacket, hoodie. Be careful to tell shorts apart from long trousers.
- color: the main color in 1-2 plain words, e.g. "navy blue", "off white", "olive green".
- pattern: the visible pattern.
- formality: how dressy it is. Use "traditional" for ethnic or festive Indian wear.
- season: when it is best worn.
- tags: 3 to 6 short lowercase words describing the type and style, e.g. ["oversized", "cotton", "streetwear"].`;

const TAG_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: { type: "STRING", enum: [...CATEGORIES] },
    subtype: { type: "STRING" },
    color: { type: "STRING" },
    pattern: { type: "STRING", enum: [...PATTERNS] },
    formality: { type: "STRING", enum: [...FORMALITY] },
    season: { type: "STRING", enum: [...SEASONS] },
    tags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["category", "subtype", "color", "pattern", "formality", "season", "tags"],
  propertyOrdering: [
    "category",
    "subtype",
    "color",
    "pattern",
    "formality",
    "season",
    "tags",
  ],
};

function pick<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  const v = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}

function normalize(raw: Record<string, unknown>): ClothingTags {
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((t) => String(t).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const subtype = String(raw.subtype ?? "").toLowerCase().trim().slice(0, 30);
  return {
    category: pick(raw.category, CATEGORIES, "other"),
    subtype: subtype || null,
    color: String(raw.color ?? "").toLowerCase().trim().slice(0, 40) || "unknown",
    pattern: pick(raw.pattern, PATTERNS, "other"),
    formality: pick(raw.formality, FORMALITY, "casual"),
    season: pick(raw.season, SEASONS, "all_season"),
    tags,
  };
}

export async function tagClothing(
  base64Image: string,
  mimeType: string
): Promise<ClothingTags> {
  const raw = await callGeminiJson({
    model: TAG_MODEL,
    parts: [
      { text: TAG_PROMPT },
      { inline_data: { mime_type: mimeType, data: base64Image } },
    ],
    schema: TAG_SCHEMA,
    temperature: 0.2,
  });
  return normalize(raw);
}
