import type { NodeObservation } from "@/lib/node-status";
import { integer, hashrate } from "@/lib/format";
export function NodeStatusPanel({
  status,
  network,
}: {
  status: NodeObservation | "unavailable" | null;
  network?: string;
}) {
  if (status === null) return null;
  if (status === "unavailable" || (network && status.network !== network))
    return (
      <section className="node-status-panel" aria-label="Node connection">
        <strong>Node status unavailable</strong>
        <p>
          Chain data remains available. The node connection will be checked
          again on refresh.
        </p>
      </section>
    );
  const syncing = BigInt(status.targetHeight) > BigInt(status.height);
  const progress = syncing
    ? (BigInt(status.height) * 10000n) / BigInt(status.targetHeight)
    : 10000n;
  return (
    <section className="node-status-panel" aria-label="Node connection">
      <div className="node-status-heading">
        <strong>
          {status.offline
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
        {status.stale ? " · delayed; retrying on refresh" : ""}
      </p>
      <p>
        Next-block difficulty {integer(status.difficulty)} · estimated hashrate{" "}
        {hashrate(status.difficulty, status.targetSeconds)}
      </p>
    </section>
  );
}
