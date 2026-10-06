"use client";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  blockIntervalsResponse,
  intervalSeconds,
  type BlockIntervalsResponse,
  type IntervalWindow,
} from "@/lib/contracts";
import { integer, timestamp } from "@/lib/format";
import {
  axisSeconds,
  intervalPlot,
  nearestInterval,
  plotBounds,
} from "@/lib/interval-plot";

const periods: { value: IntervalWindow; label: string }[] = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];
const emptyPoints: BlockIntervalsResponse["data"]["points"] = [];
export function IntervalChart({
  initial,
  anchor,
  network,
  target,
}: {
  initial: BlockIntervalsResponse | null;
  anchor: string | null;
  network: string | null;
  target: number | null;
}) {
  const [window, setWindow] = useState<IntervalWindow>("1h");
  const [reply, setReply] = useState<{
    key: string;
    data: BlockIntervalsResponse | null;
    error: boolean;
  } | null>(null);
  const [selection, setSelection] = useState<{
    key: string;
    index: number;
  } | null>(null);
  const key = `${anchor ?? "latest"}.${network ?? "reader"}.${window}`;
  const data =
    window === "1h" && initial
      ? initial
      : reply?.key === key
        ? reply.data
        : null;
  const error = !data && reply?.key === key && reply.error;

  useEffect(() => {
    if (window === "1h" && initial) return;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 5000);
    let disposed = false;
    async function load() {
      try {
        const query = new URLSearchParams({ window });
        if (anchor) query.set("anchor", anchor);
        const response = await fetch(`/api/v2/block-intervals?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Interval read unavailable");
        const result = blockIntervalsResponse.parse(await response.json());
        if (
          result.data.window_seconds !== intervalSeconds[window] ||
          (anchor && result.data.anchor_hash !== anchor) ||
          (network && result.meta.network !== network)
        )
          throw new Error("Interval read changed identity");
        if (!disposed) setReply({ key, data: result, error: false });
      } catch {
        if (!disposed) setReply({ key, data: null, error: true });
      } finally {
        clearTimeout(deadline);
      }
    }
    void load();
    return () => {
      disposed = true;
      clearTimeout(deadline);
      controller.abort();
    };
  }, [window, initial, anchor, network, key]);

  const points = data?.data.points ?? emptyPoints;
  const plot = useMemo(() => intervalPlot(points, target), [points, target]);
  const index =
    selection?.key === key
      ? Math.min(selection.index, points.length - 1)
      : points.length - 1;
  const point = points[index];
  const mean = useMemo(
    () =>
      points.length
        ? points.reduce((sum, p) => sum + BigInt(p.interval_seconds), 0n) /
          BigInt(points.length)
        : null,
    [points],
  );
  const loading = !data && !error;
  return (
    <section className="interval-panel" aria-labelledby="interval-title">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">TIME BETWEEN CONSECUTIVE BLOCKS</span>
          <h2 id="interval-title">Block intervals</h2>
        </div>
        <Activity size={20} aria-hidden="true" />
      </div>
      <div className="chart-periods" role="group" aria-label="Chart period">
        {periods.map((period) => (
          <Button
            key={period.value}
            variant={window === period.value ? "default" : "outline"}
            aria-pressed={window === period.value}
            onClick={() => {
              setWindow(period.value);
              setSelection(null);
            }}
          >
            {period.label}
          </Button>
        ))}
      </div>
      {data && (
        <p className="chart-period-end">
          Period ending at block {integer(data.data.anchor_height)} ·{" "}
          {timestamp(data.data.anchor_timestamp_unix)}
        </p>
      )}
      {points.length ? (
        <>
          <div className="chart-summary">
            <strong>
              {integer(mean!)}
              <span> s</span>
            </strong>
            <span>Mean across {integer(points.length)} block intervals</span>
          </div>
          <div
            className="interval-plot"
            tabIndex={0}
            role="region"
            aria-label="Block interval plot"
          >
            <svg
              viewBox="0 0 1000 320"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Observed block intervals. X axis: block number. Y axis: seconds since the previous block. ${points.length} intervals.`}
              onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const coordinate =
                  ((event.clientX - rect.left) / rect.width) * plotBounds.width;
                const fraction = Math.max(
                  0,
                  Math.min(
                    1,
                    (coordinate - plotBounds.left) /
                      (plotBounds.right - plotBounds.left),
                  ),
                );
                const height =
                  plot.first +
                  ((plot.last - plot.first) *
                    BigInt(Math.round(fraction * 1000000))) /
                    1000000n;
                setSelection({ key, index: nearestInterval(points, height) });
              }}
            >
              {plot.yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={plotBounds.left}
                    x2={plotBounds.right}
                    y1={plot.y(tick)}
                    y2={plot.y(tick)}
                    className={tick === "0" ? "chart-axis" : "chart-grid"}
                  />
                  <text
                    x={plotBounds.left - 12}
                    y={plot.y(tick) + 5}
                    textAnchor="end"
                    className="chart-tick"
                  >
                    {axisSeconds(tick)}
                  </text>
                </g>
              ))}
              <line
                x1={plotBounds.left}
                x2={plotBounds.left}
                y1={plotBounds.top}
                y2={plotBounds.bottom}
                className="chart-axis"
              />
              <line
                x1={plotBounds.left}
                x2={plotBounds.right}
                y1={plotBounds.bottom}
                y2={plotBounds.bottom}
                className="chart-axis"
              />
              {target && (
                <line
                  x1={plotBounds.left}
                  x2={plotBounds.right}
                  y1={plot.y(BigInt(target))}
                  y2={plot.y(BigInt(target))}
                  className="chart-target"
                />
              )}
              <path d={plot.path} fill="none" className="chart-line" />
              {plot.xTicks.map((tick, i) => (
                <text
                  key={tick}
                  x={plot.x(tick)}
                  y={276}
                  textAnchor={
                    i === 0
                      ? "start"
                      : i === plot.xTicks.length - 1
                        ? "end"
                        : "middle"
                  }
                  className="chart-tick"
                >
                  {integer(tick)}
                </text>
              ))}
              <text
                x={534}
                y={310}
                textAnchor="middle"
                className="chart-axis-label"
              >
                Block number
              </text>
              <text
                transform="translate(22,134) rotate(-90)"
                textAnchor="middle"
                className="chart-axis-label"
              >
                Seconds since previous block
              </text>
              {point && (
                <circle
                  cx={plot.x(point.height)}
                  cy={plot.y(point.interval_seconds)}
                  r="4"
                  className="chart-point"
                >
                  <title>{`Block ${point.height}: ${point.interval_seconds} seconds since block ${BigInt(point.height) - 1n}`}</title>
                </circle>
              )}
            </svg>
          </div>
          <div className="chart-inspector">
            <label htmlFor="interval-point">Inspect a block interval</label>
            <input
              id="interval-point"
              type="range"
              min={0}
              max={points.length - 1}
              step={1}
              value={index}
              aria-valuetext={`Block ${point.height}: ${point.interval_seconds} seconds`}
              onChange={(event) =>
                setSelection({ key, index: Number(event.target.value) })
              }
            />
            <p>
              <a href={`/blocks/${point.height}`} className="height-link">
                Block {integer(point.height)}
              </a>
              <span>
                {integer(point.interval_seconds)} s since block{" "}
                {integer(BigInt(point.height) - 1n)}
              </span>
            </p>
            {BigInt(point.interval_seconds) < 0n && (
              <p className="chart-period-end">
                This block’s timestamp precedes its predecessor.
              </p>
            )}
          </div>
          {target && (
            <p className="chart-period-end">
              Dashed line: target interval {integer(target)} s
            </p>
          )}
        </>
      ) : (
        <div className="chart-empty" aria-busy={loading}>
          <Activity size={28} aria-hidden="true" />
          <strong>
            {loading
              ? "Reading block intervals…"
              : error
                ? "Block intervals unavailable"
                : "More blocks, more perspective."}
          </strong>
          <p>
            {error
              ? "Try another period or refresh the page."
              : loading
                ? "Loading the selected period."
                : "No intervals with recorded timestamps in this period."}
          </p>
        </div>
      )}
      {data?.data.history_limited && (
        <p className="chart-coverage">
          Partial history for this period. Available from{" "}
          {timestamp(data.data.oldest_timestamp_unix)}.
        </p>
      )}
      <p className="chart-footnote">
        Each point is the timestamp of block N minus the timestamp of block N−1.
      </p>
    </section>
  );
}
