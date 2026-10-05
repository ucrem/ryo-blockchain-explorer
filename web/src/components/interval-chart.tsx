import { Activity } from "lucide-react";
import type { BlockSummary } from "@/lib/contracts";
import { integer, intervals } from "@/lib/format";

export function IntervalChart({
  items,
  target,
}: {
  items: BlockSummary[];
  target: number | null;
}) {
  const samples = intervals(items);
  const max =
    samples.reduce(
      (m, s) => (s.seconds > m ? s.seconds : m),
      BigInt(target ?? 1),
    ) || 1n;
  const avg = samples.length
    ? samples.reduce((sum, s) => sum + s.seconds, 0n) / BigInt(samples.length)
    : null;
  const y = (value: bigint) => 122 - Number((value * 10000n) / max) / 100;
  const points = samples
    .map(
      (s, i) =>
        `${24 + (i * 552) / Math.max(1, samples.length - 1)},${y(s.seconds)}`,
    )
    .join(" ");
  return (
    <section className="interval-panel" aria-labelledby="interval-title">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">OBSERVED ON THIS PAGE</span>
          <h2 id="interval-title">Block intervals</h2>
        </div>
        <Activity size={20} aria-hidden="true" />
      </div>
      {samples.length >= 2 ? (
        <>
          <div className="chart-summary">
            <strong>
              {integer(avg!)}
              <span> s</span>
            </strong>
            <span>Mean across {samples.length} intervals · whole seconds</span>
          </div>
          <svg
            viewBox="0 0 600 150"
            role="img"
            aria-label={`Observed block intervals, oldest to newest. Mean ${avg} seconds, maximum ${max} seconds.`}
          >
            {[22, 72, 122].map((line) => (
              <line
                key={line}
                x1="24"
                x2="576"
                y1={line}
                y2={line}
                className="chart-grid"
              />
            ))}
            {target && (
              <line
                x1="24"
                x2="576"
                y1={y(BigInt(target))}
                y2={y(BigInt(target))}
                className="chart-target"
              />
            )}
            <polyline points={points} fill="none" className="chart-line" />
            {samples.map((s, i) => (
              <circle
                key={s.height}
                cx={24 + (i * 552) / Math.max(1, samples.length - 1)}
                cy={y(s.seconds)}
                r="3"
                className="chart-point"
              >
                <title>{`Block ${s.height}: ${s.seconds} seconds`}</title>
              </circle>
            ))}
          </svg>
          <div className="chart-legend">
            <span>Block {integer(samples[0].height)}</span>
            <span>
              <i />
              Observed interval{" "}
              {target && (
                <>
                  <b />
                  Target {integer(target)} s
                </>
              )}
            </span>
            <span>Block {integer(samples.at(-1)!.height)}</span>
          </div>
        </>
      ) : (
        <div className="chart-empty">
          <Activity size={28} aria-hidden="true" />
          <strong>More blocks, more perspective.</strong>
          <p>
            At least three blocks with recorded, nondecreasing timestamps are
            needed for this chart.
          </p>
        </div>
      )}
      <p className="chart-footnote">
        Block timestamps are miner supplied. This window is not a network-wide
        performance estimate.
      </p>
    </section>
  );
}
