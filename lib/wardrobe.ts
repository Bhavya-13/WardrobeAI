// Shared lists and helpers used by both the browser and the server.

export const CATEGORIES = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "footwear",
  "eyewear",
  "bag",
  "accessory",
  "other",
] as const;

export const PATTERNS = [
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

export const FORMALITY = [
  "casual",
  "smart_casual",
  "formal",
  "party",
  "athletic",
  "lounge",
  "traditional",
] as const;

export const SEASONS = ["summer", "winter", "monsoon", "all_season"] as const;

export const OCCASIONS = [
  "Casual day out",
  "College / everyday",
  "Office / work",
  "Date night",
  "Party / night out",
  "Festive / traditional",
  "Gym / sports",
  "Travel",
] as const;

export type GlassesMode = "always" | "sometimes" | "never";

export const GLASSES_MODES: { value: GlassesMode; label: string }[] = [
  { value: "always", label: "Always wear my glasses" },
  { value: "sometimes", label: "Sometimes (AI decides)" },
  { value: "never", label: "Never / I use contacts" },
];

// Order in which clothes are shown inside an outfit card.
export const CATEGORY_ORDER: Record<string, number> = {
  outerwear: 0,
  top: 1,
  one_piece: 1,
  bottom: 2,
  footwear: 3,
  eyewear: 4,
  bag: 5,
  accessory: 6,
  other: 7,
};

export const pretty = (s: string) => s.replace(/_/g, " ");

// ---------- Tagging settings (change these to tune re-checking) ----------

// Bump this number when you improve the tagging prompt. Items tagged with an
// older version are quietly re-checked, a few per visit.
export const TAG_VERSION = 2;

// AI-tagged items older than this many days are re-checked once.
export const RECHECK_DAYS = 90;

// Max items re-checked per page visit (keeps free-tier usage tiny).
export const RECHECK_BATCH = 5;

// A "tagging" claim older than this many minutes is treated as abandoned.
export const CLAIM_MINUTES = 3;

// ---------- Photo extraction settings ----------

// Extra space around each detected item, as a fraction of the item's size.
export const DEFAULT_MARGIN = 0.12;

// Glasses are small and the AI's box is less exact, so they get at least this.
export const EYEWEAR_MIN_MARGIN = 0.3;

// How long the Undo bar stays after removing something (milliseconds).
export const UNDO_MS = 6000;

// Soft-deleted items are erased for good this many minutes later.
export const PURGE_MINUTES = 2;
