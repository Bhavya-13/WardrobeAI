// Picture links from Supabase change every time a page loads, so the browser
// would download every picture again each visit. This keeps the same link for
// up to ~45 minutes so pictures come straight from the phone's memory.
//
// Pictures served by our own site (addresses starting with "/") never change,
// so they need no help from this cache.

const KEY = "outfi:signed-urls:v1";
const KEEP_MS = 55 * 60 * 1000; // links are valid for 60 minutes
const REUSE_MARGIN_MS = 10 * 60 * 1000; // stop reusing 10 minutes before expiry

type Entry = { url: string; exp: number };

let mem: Record<string, Entry> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Record<string, Entry> {
  if (mem) return mem;
  let parsed: Record<string, Entry> = {};
  try {
    parsed = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {}
  const now = Date.now();
  for (const k of Object.keys(parsed)) {
    if (!parsed[k] || parsed[k].exp < now) delete parsed[k];
  }
  mem = parsed;
  return parsed;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(mem ?? {}));
    } catch {}
  }, 600);
}

export function stableUrl(key: string, fresh: string): string {
  if (typeof window === "undefined" || !key || !fresh) return fresh;
  if (fresh.startsWith("/")) return fresh; // our own permanent address
  const cache = load();
  const now = Date.now();
  const hit = cache[key];
  if (hit && hit.exp > now + REUSE_MARGIN_MS) return hit.url;
  cache[key] = { url: fresh, exp: now + KEEP_MS };
  scheduleSave();
  return fresh;
}
