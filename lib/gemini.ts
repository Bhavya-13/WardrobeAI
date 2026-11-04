// Calls the Gemini API (server-side only) to describe one clothing photo.
// The API key is read from GEMINI_API_KEY and is never sent to the browser.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const CATEGORIES = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "footwear",
  "bag",
  "accessory",
  "other",
] as const;
const PATTERNS = [
  "solid",
  "striped",
  "checked",
  "floral",
  "graphic",
  "printed",
  "textured",
  "embroidered",
  "other",
] as const;
const FORMALITY = [
  "casual",
  "smart_casual",
  "formal",
  "party",
  "athletic",
  "lounge",
  "traditional",
] as const;
const SEASONS = ["summer", "winter", "monsoon", "all_season"] as const;

export type ClothingTags = {
  category: string;
  color: string;
  pattern: string;
  formality: string;
  season: string;
  tags: string[];
};

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const PROMPT = `You are a fashion expert cataloguing a personal wardrobe.
The photo shows ONE clothing item or accessory (it may be on a bed, hanger, floor or a person). Describe only the main item.
Rules:
- category: top (shirts, tees, kurtas, sweaters), bottom (jeans, trousers, skirts, shorts), one_piece (dresses, sarees, jumpsuits), outerwear (jackets, coats, blazers, hoodies), footwear, bag, accessory (watch, belt, scarf, jewellery, cap), or other.
- color: the main color in 1-2 plain words, e.g. "navy blue", "off white", "olive green".
- pattern: the visible pattern.
- formality: how dressy it is. Use "traditional" for ethnic or festive Indian wear.
- season: when it is best worn.
- tags: 3 to 6 short lowercase words describing the type and style, e.g. ["t-shirt", "oversized", "cotton", "streetwear"].`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    category: { type: "STRING", enum: [...CATEGORIES] },
    color: { type: "STRING" },
    pattern: { type: "STRING", enum: [...PATTERNS] },
    formality: { type: "STRING", enum: [...FORMALITY] },
    season: { type: "STRING", enum: [...SEASONS] },
    tags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["category", "color", "pattern", "formality", "season", "tags"],
  propertyOrdering: [
    "category",
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
  return {
    category: pick(raw.category, CATEGORIES, "other"),
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
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // 401 = treated as a configuration problem by the API route
    throw new GeminiError("GEMINI_API_KEY is not set on the server", 401);
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64Image } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.2,
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
    throw new GeminiError("Gemini returned no answer for this photo", 422);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini returned an unreadable answer", 422);
  }
  return normalize(parsed);
}
