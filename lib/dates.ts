// Diary dates are stored as plain "YYYY-MM-DD" text, so time zones can never
// shift a date by a day.

const pad = (n: number) => String(n).padStart(2, "0");

// Today's date on THIS device. Call it from a click handler, not while rendering.
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "Wed, 4 Nov"
export function formatWornDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// "2026-11"
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

// "November 2026"
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
