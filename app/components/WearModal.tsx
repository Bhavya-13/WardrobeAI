"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "./Modal";

// "Where did you wear it?" pop-up. Used when you tap "Wore it", "Wear again"
// or edit a diary entry.
export default function WearModal({
  title,
  subtitle,
  initialPlace = "",
  initialDate,
  maxDate,
  saveLabel = "Save",
  onSave,
  onClose,
}: {
  title: string;
  subtitle?: string;
  initialPlace?: string;
  initialDate: string; // YYYY-MM-DD
  maxDate: string; // you cannot log a day in the future
  saveLabel?: string;
  // return an error message to show, or null when it worked
  onSave: (place: string, date: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [place, setPlace] = useState(initialPlace);
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Places you typed before, so you can tap instead of typing again.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("outfit_wears")
        .select("place")
        .is("deleted_at", null)
        .not("place", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      const seen = new Set<string>();
      const list: string[] = [];
      for (const r of data ?? []) {
        const p = String(r.place ?? "").trim();
        const k = p.toLowerCase();
        if (p && !seen.has(k)) {
          seen.add(k);
          list.push(p);
        }
        if (list.length >= 6) break;
      }
      setSuggestions(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const msg = await onSave(place.trim(), date || initialDate);
    if (msg) {
      setError(msg);
      setSaving(false);
    } else {
      onClose();
    }
  }

  return (
    <Modal
      label={title}
      onClose={saving ? undefined : onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onClose} disabled={saving} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="btn btn-primary">
            {saving ? "Saving..." : saveLabel}
          </button>
        </div>
      }
    >
      <h3 className="font-display text-2xl">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}

      <label className="mt-5 block text-xs text-ink/70">
        Where did you wear it? (optional)
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          maxLength={120}
          autoFocus
          placeholder="e.g. Rahul's wedding, college fest, office party"
          className="input mt-1"
        />
      </label>

      {suggestions.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-ink/50">Worn before at</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlace(s)}
                aria-pressed={place.trim().toLowerCase() === s.toLowerCase()}
                className="chip-btn"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="mt-5 block text-xs text-ink/70">
        Date
        <input
          type="date"
          value={date}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
          className="input mt-1"
        />
      </label>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}
