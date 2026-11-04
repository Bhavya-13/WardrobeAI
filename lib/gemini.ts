// Calls the Gemini API (server-side only). The key is read from GEMINI_API_KEY
// and is never sent to the browser.

import { CATEGORIES, PATTERNS, FORMALITY, SEASONS } from "./wardrobe";

export const TAG_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const OUTFIT_MODEL = process.env.GEMINI_OUTFIT_MODEL || "gemini-3.8-flash";

// code explains WHY a request failed:
//   busy       rate limit or the AI service had a hiccup (worth retrying)
//   config     bad key, wrong model name, rejected request
//   blocked    the AI refused to look at the photo
//   cut_off    the AI ran out of room and its answer was cut short
//   bad_answer the AI answered with something unreadable or nothing at all
export class GeminiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const BLOCK_FINISH = [
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "IMAGE_SAFETY",
  "RECITATION",
];

// Sends one request and returns the parsed JSON answer.
export async function callGeminiJson(opts: {
  model: string;
  parts: unknown[];
  schema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<Record<string, unknown>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // 401 = treated as a configuration problem by the API routes
    throw new GeminiError("GEMINI_API_KEY is not set on the server", 401, "config");
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
          maxOutputTokens: opts.maxOutputTokens,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    const code =
      res.status === 429 || res.status >= 500
        ? "busy"
        : [400, 401, 403, 404].includes(res.status)
          ? "config"
          : "error";
    throw new GeminiError(`Gemini ${res.status}: ${text.slice(0, 300)}`, res.status, code);
  }

  const json = await res.json();
  const blockReason = json?.promptFeedback?.blockReason as string | undefined;
  const candidate = json?.candidates?.[0];
  const finish = candidate?.finishReason as string | undefined;
  const parts: { text?: string }[] = candidate?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");

  if (!text) {
    if (blockReason || (finish && BLOCK_FINISH.includes(finish))) {
      throw new GeminiError(
        `The AI declined to look at this (${blockReason ?? finish})`,
        422,
        "blocked"
      );
    }
    if (finish === "MAX_TOKENS") {
      throw new GeminiError("The AI ran out of room for its answer", 422, "cut_off");
    }
    throw new GeminiError(
      `The AI returned no answer${finish ? ` (${finish})` : ""}`,
      422,
      "bad_answer"
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    if (finish === "MAX_TOKENS") {
      throw new GeminiError("The AI's answer was cut off", 422, "cut_off");
    }
    throw new GeminiError("The AI's answer could not be read", 422, "bad_answer");
  }
}

// ---------- Shared labelling rules (used for single photos AND for photo extraction) ----------

export type ClothingTags = {
  category: string;
  subtype: string | null;
  color: string;
  pattern: string;
  formality: string;
  season: string;
  tags: string[];
  is_prescription: boolean | null;
};

export const TAG_FIELD_RULES = `- subtype: the specific garment type in 1-2 lowercase words, e.g. t-shirt, polo, shirt, kurta, jeans, chinos, shorts, joggers, sneakers, sandals, jacket, hoodie, glasses, sunglasses. Be careful to tell shorts apart from long trousers.
- color: the main color in 1-2 plain words, e.g. "navy blue", "off white", "olive green". For eyewear use the frame color.
- pattern: the visible pattern.
- formality: how dressy it is. Use "traditional" for ethnic or festive Indian wear.
- season: when it is best worn.
- tags: 3 to 6 short lowercase words describing the type and style, e.g. ["oversized", "cotton", "streetwear"].
- is_prescription: only for eyewear. true if it looks like clear-lens prescription glasses, false if the lenses are dark or tinted (sunglasses). For anything that is not eyewear, return false.`;

// Schema pieces for those fields (everything except category)
export const TAG_PROPS = {
  subtype: { type: "STRING" },
  color: { type: "STRING" },
  pattern: { type: "STRING", enum: [...PATTERNS] },
  formality: { type: "STRING", enum: [...FORMALITY] },
  season: { type: "STRING", enum: [...SEASONS] },
  tags: { type: "ARRAY", items: { type: "STRING" } },
  is_prescription: { type: "BOOLEAN" },
};

export const TAG_FIELD_NAMES = [
  "subtype",
  "color",
  "pattern",
  "formality",
  "season",
  "tags",
  "is_prescription",
];

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

// Cleans the AI's answer so the database only ever sees valid values.
export function normalizeTags(raw: Record<string, unknown>): ClothingTags {
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((t) => String(t).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const subtype = String(raw.subtype ?? "").toLowerCase().trim().slice(0, 30);
  const category = pick(raw.category, CATEGORIES, "other");
  return {
    category,
    subtype: subtype || null,
    color: String(raw.color ?? "").toLowerCase().trim().slice(0, 40) || "unknown",
    pattern: pick(raw.pattern, PATTERNS, "other"),
    formality: pick(raw.formality, FORMALITY, "casual"),
    season: pick(raw.season, SEASONS, "all_season"),
    tags,
    is_prescription: category === "eyewear" ? raw.is_prescription === true : null,
  };
}

// ---------- Tagging one clothing photo ----------

const TAG_PROMPT = `You are a fashion expert cataloguing a personal wardrobe.
The photo shows ONE clothing item or accessory (it may be on a bed, hanger, floor or a person, or be a loose crop from a larger photo). Describe only the main item.
Rules:
- category: top (shirts, tees, polos, kurtas, sweaters), bottom (jeans, trousers, skirts, shorts), one_piece (dresses, sarees, jumpsuits), outerwear (jackets, coats, blazers, hoodies), footwear, eyewear (glasses and sunglasses), bag, accessory (watch, belt, scarf, jewellery, cap), or other.
${TAG_FIELD_RULES}`;

const TAG_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: { type: "STRING", enum: [...CATEGORIES] },
    ...TAG_PROPS,
  },
  required: ["category", ...TAG_FIELD_NAMES],
  propertyOrdering: ["category", ...TAG_FIELD_NAMES],
};

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
  return normalizeTags(raw);
}
