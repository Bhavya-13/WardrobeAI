"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OCCASIONS, GLASSES_MODES, type GlassesMode } from "@/lib/wardrobe";
import HangerLoader from "../components/HangerLoader";

const HINTS = [
  "Picking colours that work together...",
  "Checking what you wore recently...",
  "Matching shoes and glasses...",
  "Making sure it suits the occasion...",
];

export default function OutfitGenerator({
  initialGlasses,
}: {
  initialGlasses: GlassesMode;
}) {
  const router = useRouter();
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0]);
  const [note, setNote] = useState("");
  const [glasses, setGlasses] = useState<GlassesMode>(initialGlasses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hint, setHint] = useState(0);

  // Changes the little message while the AI works.
  useEffect(() => {
    if (!loading) return;
    setHint(0);
    const t = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2200);
    return () => clearInterval(t);
  }, [loading]);

  // Remember the glasses choice for next time.
  async function changeGlasses(value: GlassesMode) {
    setGlasses(value);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({
        user_id: user.id,
        glasses_mode: value,
        updated_at: new Date().toISOString(),
      });
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, note, count: 3, glasses }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
      } else {
        setNote("");
        if (body.warning) setNotice(body.warning);
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="card relative p-5 sm:p-6">
      <h2 className="font-display text-xl">What is the occasion?</h2>

      <div
        className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Occasion"
      >
        {OCCASIONS.map((o) => (
          <button
            key={o}
            onClick={() => setOccasion(o)}
            disabled={loading}
            aria-pressed={occasion === o}
            className="chip-btn"
          >
            {o}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={loading}
          maxLength={200}
          placeholder="Optional: something comfy, all dark colours..."
          className="input flex-1"
        />
        <button
          onClick={generate}
          disabled={loading}
          className="btn btn-primary sm:min-w-44"
        >
          {loading ? "Styling..." : "Make 3 outfits"}
        </button>
      </div>

      <label className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink/70">
        Glasses
        <select
          value={glasses}
          onChange={(e) => changeGlasses(e.target.value as GlassesMode)}
          disabled={loading}
          className="input !min-h-9 !w-auto !py-1 !text-sm"
        >
          {GLASSES_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      {notice && (
        <p className="mt-4 rounded-2xl bg-blush/50 px-4 py-3 text-sm">{notice}</p>
      )}
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {/* the hanger swings while the AI styles your outfits */}
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-3xl bg-paper/90">
          <HangerLoader size={64} label={HINTS[hint]} />
        </div>
      )}
    </div>
  );
}
