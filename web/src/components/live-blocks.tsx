"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { networkResponse } from "@/lib/contracts";
import { integer } from "@/lib/format";

// Observe the native reader, not a network-wide mining or synchronization signal.
export function LiveBlocks({
  tipHash,
  tipHeight,
  network,
}: {
  tipHash: string | null;
  tipHeight: string | null;
  network: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled || pending) return;
    let disposed = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const schedule = () => {
      timer = setTimeout(check, 10_000);
    };
    async function check() {
      if (disposed || busy) return;
      if (document.hidden) {
        schedule();
        return;
      }
      busy = true;
      controller = new AbortController();
      const deadline = setTimeout(() => controller?.abort(), 5_000);
      try {
        const response = await fetch("/api/v2/network", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Reader unavailable");
        const latest = networkResponse.parse(await response.json());
        if (disposed) return;
        setUnavailable(false);
        if (latest.meta.network !== network || latest.data.tip.hash !== tipHash) {
          const advanced =
            latest.meta.network === network &&
            tipHeight !== null &&
            BigInt(latest.data.tip.height) > BigInt(tipHeight);
          setNotice(
            advanced
              ? `Reader advanced to block ${integer(latest.data.tip.height)}.`
              : "Chain reader changed. Updating blocks.",
          );
          startTransition(() => router.refresh());
        }
      } catch {
        if (!disposed) setUnavailable(true);
      } finally {
        clearTimeout(deadline);
        busy = false;
        if (!disposed) schedule();
      }
    }
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void check();
      }
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, pending, tipHash, tipHeight, network, router]);

  return (
    <div className="live-blocks">
      <Button
        variant="outline"
        aria-pressed={enabled}
        aria-label={enabled ? "Pause live updates" : "Resume live updates"}
        onClick={() => setEnabled((value) => !value)}
      >
        {enabled ? <Radio aria-hidden="true" /> : <Pause aria-hidden="true" />}
        {enabled ? "Live · 10 s" : "Live paused"}
      </Button>
      <span className="live-status" role="status" aria-live="polite">
        {!enabled
          ? "Automatic updates paused"
          : unavailable
            ? "Reader unavailable · retrying"
            : pending
              ? "Updating blocks…"
              : notice || "Watching for new blocks"}
      </span>
    </div>
  );
}
