"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OCCASIONS } from "@/lib/wardrobe";

export default function OutfitGenerator() {
  const router = useRouter();
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, note, count: 3 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
      } else {
        setNote("");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Make me outfits</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          disabled={loading}
          className="rounded-xl border border-[#1F1F1F]/20 bg-white px-3 py-2 text-sm"
        >
          {OCCASIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={loading}
          maxLength={200}
          placeholder="Optional: e.g. something comfy, all dark colours"
          className="flex-1 rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-sm"
        />
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-xl bg-[#1F1F1F] px-5 py-2 text-sm text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Styling..." : "Make 3 outfits"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
