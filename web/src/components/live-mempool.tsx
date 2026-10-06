"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mempoolResponse } from "@/lib/contracts";
export function LiveMempool({
  snapshot,
  network,
  anchored,
}: {
  snapshot: string;
  network: string;
  anchored: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [notice, setNotice] = useState(
    "Checking local pool membership every 10 seconds.",
  );
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!enabled || pending) return;
    let timer: ReturnType<typeof setTimeout>,
      active = true;
    let controller: AbortController | undefined;
    const check = async () => {
      if (!active) return;
      if (document.hidden) {
        timer = setTimeout(check, 10000);
        return;
      }
      controller = new AbortController();
      const deadline = setTimeout(() => controller?.abort(), 5000);
      try {
        const response = await fetch("/api/v2/mempool?limit=1", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Pool unavailable");
        const pool = mempoolResponse.parse(await response.json());
        if (!active) return;
        if (pool.data.snapshot !== snapshot || pool.meta.network !== network) {
          setNotice("Pool membership changed. Updating transactions.");
          startTransition(() => {
            if (anchored) router.replace("/mempool", { scroll: false });
            else router.refresh();
          });
        } else
          setNotice(
            `Pool checked ${new Date().toISOString().slice(11, 19)} UTC.`,
          );
      } catch {
        if (active)
          setNotice(
            "Pool check unavailable. Retaining this page and retrying.",
          );
      } finally {
        clearTimeout(deadline);
        if (active) timer = setTimeout(check, 10000);
      }
    };
    timer = setTimeout(check, 10000);
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [enabled, pending, snapshot, network, anchored, router]);
  return (
    <div className="live-blocks">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEnabled(!enabled)}
        aria-label={enabled ? "Pause pool updates" : "Resume pool updates"}
      >
        {enabled ? "Pool live" : "Pool paused"}
      </Button>
      <span role="status" aria-live="polite">
        {enabled ? notice : "Automatic pool updates paused"}
      </span>
    </div>
  );
}
