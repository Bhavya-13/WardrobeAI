"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TagResult = {
  result: "ok" | "failed" | "retry" | "fatal";
  error?: string;
};

async function tagOne(id: string): Promise<TagResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch("/api/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: id }),
      });
    } catch {
      return { result: "failed", error: "network error" };
    }
    if (res.ok) return { result: "ok" };

    const body = await res.json().catch(() => ({}));
    if (body.fatal || res.status === 401) {
      return { result: "fatal", error: body.error ?? "Not allowed" };
    }
    if (res.status === 429 || res.status === 503) {
      await sleep(6000 * (attempt + 1)); // free tier: wait and try again
      continue;
    }
    return { result: "failed", error: body.error };
  }
  return { result: "retry" };
}

export default function Tagger({
  pendingIds,
  failedIds,
}: {
  pendingIds: string[];
  failedIds: string[];
}) {
  const router = useRouter();
  const runningRef = useRef(false);
  const attempted = useRef<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState<string | null>(null);

  async function run(ids: string[]) {
    if (runningRef.current || ids.length === 0) return;
    runningRef.current = true;
    setRunning(true);
    setMessage(null);
    setProgress({ done: 0, total: ids.length });

    let done = 0;
    let stopMsg: string | null = null;
    for (const id of ids) {
      const r = await tagOne(id);
      if (r.result === "fatal") {
        stopMsg = `AI tagging stopped: ${r.error ?? "configuration problem"}`;
        break;
      }
      if (r.result === "retry") {
        stopMsg =
          "Hit the free rate limit. Wait a minute, then press the button to continue.";
        break;
      }
      done++;
      setProgress({ done, total: ids.length });
      await sleep(800); // be gentle with the free tier
    }

    runningRef.current = false;
    setRunning(false);
    setMessage(stopMsg);
    router.refresh();
  }

  // Automatically tag new photos once (never loops on failures).
  const pendingKey = pendingIds.join(",");
  useEffect(() => {
    const fresh = pendingIds.filter((id) => !attempted.current.has(id));
    if (fresh.length === 0 || runningRef.current) return;
    fresh.forEach((id) => attempted.current.add(id));
    void run(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  const allIds = [...pendingIds, ...failedIds];

  return (
    <div className="mt-4 text-sm">
      {running && (
        <p className="text-[#1F1F1F]/70">
          AI is tagging your clothes... {progress.done}/{progress.total}
        </p>
      )}
      {!running && allIds.length > 0 && (
        <button
          onClick={() => run(allIds)}
          className="rounded-xl border border-[#1F1F1F] px-4 py-2 transition hover:bg-[#1F1F1F] hover:text-white"
        >
          Tag {allIds.length} {allIds.length === 1 ? "item" : "items"} with AI
          {failedIds.length > 0 ? ` (${failedIds.length} failed before)` : ""}
        </button>
      )}
      {message && <p className="mt-2 text-red-700">{message}</p>}
    </div>
  );
}
