"use client";
import { useEffect, useState } from "react";
import { nodeStatusResponse, type NodeObservation } from "@/lib/node-status";
import { integer, hashrate } from "@/lib/format";
export function NodeStatusPanel({
  status: initial,
  network,
}: {
  status: NodeObservation | "unavailable" | null;
  network?: string;
}) {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    if (initial === null) return;
    let active = true,
      busy = false;
    let controller: AbortController | undefined;
    const check = async () => {
      if (!active || busy || document.hidden) return;
      busy = true;
      controller = new AbortController();
      const deadline = setTimeout(() => controller?.abort(), 5000);
      try {
        const response = await fetch(
          `/api/node-status${network ? `?network=${network}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Node status unavailable");
        const result = nodeStatusResponse.parse(await response.json());
        if (active) setStatus(result.status);
      } catch {
        if (active)
          setStatus((current) =>
            current &&
            current !== "unavailable" &&
            Date.now() - Date.parse(current.checkedAt) <= 60000
              ? { ...current, stale: true }
              : "unavailable",
          );
      } finally {
        clearTimeout(deadline);
        busy = false;
      }
    };
    const timer = setInterval(check, 10000);
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initial, network]);
  if (status === null) return null;
  if (status === "unavailable" || (network && status.network !== network))
    return (
      <section className="node-status-panel" aria-label="Node connection">
        <strong>Node status unavailable</strong>
        <p>
          Chain data remains available. The node connection will be checked
          again automatically every 10 seconds.
        </p>
      </section>
    );
  const syncing = BigInt(status.targetHeight) > BigInt(status.height);
  const problem = ["error", "stalled", "offline"].includes(status.health.state);
  const progress = syncing
    ? (BigInt(status.height) * 10000n) / BigInt(status.targetHeight)
    : 10000n;
  return (
    <section
      className={`node-status-panel${problem ? " node-status-problem" : ""}`}
      aria-label="Node connection"
    >
      <div className="node-status-heading">
        <strong>
          {status.health.state === "error"
            ? "Synchronization error · retrying"
            : status.health.state === "stalled"
              ? "Synchronization stalled"
              : status.offline
                ? "Node offline"
                : syncing
                  ? "Synchronizing"
                  : status.ready
                    ? "Node ready"
                    : "Connecting to network"}
        </strong>
        <span>
          {status.network} ·{" "}
          {integer(BigInt(status.incoming) + BigInt(status.outgoing))} peers
        </span>
      </div>
      {status.health.state === "error" && status.health.error && (
        <div className="node-error-detail" role="status">
          <p>
            {status.health.error.code === "transaction_verification_failed"
              ? "The node rejected a downloaded transaction during verification and is retrying synchronization."
              : "The node rejected a downloaded block during verification and is retrying synchronization."}
          </p>
          <details>
            <summary>Error details</summary>
            <dl>
              <dt>Native error</dt>
              <dd>
                <code>
                  {status.health.error.code ===
                  "transaction_verification_failed"
                    ? "transaction verification failed on NOTIFY_RESPONSE_GET_OBJECTS"
                    : "Block verification failed, dropping connection"}
                </code>
              </dd>
              <dt>Last error · UTC</dt>
              <dd>
                {status.health.error.at.replace("T", " ").replace(".000Z", "")}
              </dd>
              <dt>Last stored block</dt>
              <dd>
                {status.height === "0"
                  ? "—"
                  : integer(BigInt(status.height) - 1n)}
              </dd>
              {status.health.error.blobHash && (
                <>
                  <dt>Transaction blob identifier</dt>
                  <dd>
                    <code>{status.health.error.blobHash}</code>
                  </dd>
                </>
              )}
            </dl>
            <p>
              Reported by the local node log. The blob identifier is not a
              confirmed transaction hash. Peer addresses and raw logs are
              excluded.
            </p>
          </details>
        </div>
      )}
      {status.health.state === "stalled" && (
        <p role="status">
          No local chain progress observed for at least 2 minutes while this
          node reports a higher target. This alone does not establish a
          validation error.
        </p>
      )}
      {status.health.diagnostics !== "available" && (
        <p>
          Detailed node errors{" "}
          {status.health.diagnostics === "disabled"
            ? "are not configured"
            : "are unavailable"}
          .
        </p>
      )}
      {syncing && (
        <>
          <progress
            value={Number(progress)}
            max={10000}
            aria-label="Node synchronization progress"
          />
          <p>
            {integer(status.height)} / {integer(status.targetHeight)} blocks ·{" "}
            {progress / 100n}.{(progress % 100n).toString().padStart(2, "0")}% ·
            target reported by this node
          </p>
        </>
      )}
      <p className="node-read-time">
        Last node read {status.checkedAt.slice(11, 19)} UTC
        {status.stale ? " · delayed; retrying automatically" : ""}
      </p>
      <p>
        Next-block difficulty {integer(status.difficulty)} · estimated hashrate{" "}
        {hashrate(status.difficulty, status.targetSeconds)}
      </p>
    </section>
  );
}
