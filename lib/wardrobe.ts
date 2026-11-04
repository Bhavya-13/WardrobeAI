// Shared lists and helpers used by both the browser and the server.

export const CATEGORIES = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "footwear",
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

// Order in which clothes are shown inside an outfit card.
export const CATEGORY_ORDER: Record<string, number> = {
  outerwear: 0,
  top: 1,
  one_piece: 1,
  bottom: 2,
  footwear: 3,
  bag: 4,
  accessory: 5,
  other: 6,
};

export const pretty = (s: string) => s.replace(/_/g, " ");
