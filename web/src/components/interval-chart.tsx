"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Activity, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  blockIntervalsResponse,
  intervalSeconds,
  type BlockIntervalsResponse,
  type IntervalWindow,
} from "@/lib/contracts";
import { integer, timestamp } from "@/lib/format";
import { axisSeconds, intervalPlot, plotHeight } from "@/lib/interval-plot";

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
}: {
  initial: BlockIntervalsResponse | null;
  anchor: string | null;
  network: string | null;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [window, setWindow] = useState<IntervalWindow>("1h");
  const [reply, setReply] = useState<{
    key: string;
    data: BlockIntervalsResponse | null;
    error: boolean;
  } | null>(null);
  const [inspection, setInspection] = useState<{
    data: BlockIntervalsResponse;
    window: IntervalWindow;
    network: string | null;
    index: number;
  } | null>(null);
  const key = `${anchor ?? "latest"}.${network ?? "reader"}.${window}`;
  const latestData =
    window === "1h" && initial
      ? initial
      : reply?.key === key
        ? reply.data
        : null;
  const inspecting =
    inspection !== null &&
    inspection.window === window &&
    inspection.network === network;
  const data = inspecting ? inspection.data : latestData;
  const displayKey = data
    ? `${data.data.anchor_hash}.${data.meta.network}.${window}`
    : key;
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
  const plot = useMemo(
    () => intervalPlot(points, window === "1h", width),
    [points, window, width],
  );
  const index = inspecting ? inspection.index : points.length - 1;
  const point = points[index];
  const mean = useMemo(
    () =>
      points.length
        ? points.reduce((sum, p) => sum + BigInt(p.interval_seconds), 0n) /
          BigInt(points.length)
        : null,
    [points],
  );
  const hasPoints = points.length > 0;
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth > 0) setWidth(element.clientWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPoints]);
  function inspect(index: number) {
    if (data) setInspection({ data, window, network, index });
  }
  function inspectPointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * plot.bounds.width;
    const y = ((event.clientY - rect.top) / rect.height) * plotHeight;
    // Axis labels and the fixed Y axis are not block hit targets.
    if (
      y < plot.bounds.top ||
      y > plot.bounds.bottom ||
      event.clientX <
        (viewport.current?.getBoundingClientRect().left ?? 0) +
          plot.bounds.left ||
      x < plot.bounds.left ||
      x > plot.bounds.right
    )
      return;
    inspect(
      Math.max(
        0,
        Math.min(
          points.length - 1,
          Math.floor((x - plot.bounds.left) / plot.slot),
        ),
      ),
    );
  }
  const loading = !data && !error;
  return (
    <section className="interval-panel" aria-labelledby="interval-title">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">TIME BETWEEN CONSECUTIVE BLOCKS</span>
          <h2 id="interval-title">Block intervals</h2>
        </div>
        {inspecting ? (
          <Button
            variant="outline"
            className="chart-live-button"
            onClick={() => setInspection(null)}
          >
            <Radio aria-hidden="true" /> Back to live
          </Button>
        ) : (
          <Activity size={20} aria-hidden="true" />
        )}
      </div>
      <div className="chart-periods" role="group" aria-label="Chart period">
        {periods.map((period) => (
          <Button
            key={period.value}
            variant={window === period.value ? "default" : "outline"}
            aria-pressed={window === period.value}
            onClick={() => {
              setWindow(period.value);
              setInspection(null);
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
            <span className="chart-block-count">
              <b>{integer(points.length)} blocks shown</b>
              <span>Mean interval · one bar per block</span>
            </span>
          </div>
          <div
            ref={viewport}
            className="interval-plot"
            tabIndex={0}
            role="slider"
            aria-label="Inspect a block interval"
            aria-valuemin={0}
            aria-valuemax={points.length - 1}
            aria-valuenow={index}
            aria-valuetext={`Block ${point.height}: ${point.interval_seconds} seconds`}
            onKeyDown={(event) => {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? points.length - 1
                    : event.key === "ArrowRight" || event.key === "ArrowUp"
                      ? Math.min(points.length - 1, index + 1)
                      : event.key === "ArrowLeft" || event.key === "ArrowDown"
                        ? Math.max(0, index - 1)
                        : null;
              if (next === null) return;
              event.preventDefault();
              inspect(next);
            }}
          >
            <div
              className="chart-y-axis"
              aria-hidden="true"
              style={{ width: plot.bounds.left }}
            >
              <svg
                viewBox={`0 0 ${plot.bounds.left} ${plotHeight}`}
                style={{ width: plot.bounds.left }}
              >
                {plot.yTicks.map((tick) => (
                  <text
                    key={tick}
                    x={plot.bounds.left - 12}
                    y={plot.y(tick) + 5}
                    textAnchor="end"
                    className="chart-tick"
                  >
                    {axisSeconds(tick)}
                  </text>
                ))}
                <line
                  x1={plot.bounds.left - 1}
                  x2={plot.bounds.left - 1}
                  y1={plot.bounds.top}
                  y2={plot.bounds.bottom}
                  className="chart-axis"
                />
                <text
                  transform="translate(22,134) rotate(-90)"
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  Seconds since previous block
                </text>
              </svg>
            </div>
            <svg
              viewBox={`0 0 ${plot.bounds.width} ${plotHeight}`}
              style={{ width: "100%" }}
              preserveAspectRatio="none"
              role="img"
              aria-label={`Observed block intervals. X axis: block number. Y axis: seconds since the previous block. ${points.length} intervals.`}
              onPointerMove={inspectPointer}
              onPointerDown={inspectPointer}
            >
              {plot.yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={plot.bounds.left}
                    x2={plot.bounds.right}
                    y1={plot.y(tick)}
                    y2={plot.y(tick)}
                    className={tick === "0" ? "chart-axis" : "chart-grid"}
                  />
                </g>
              ))}
              <line
                x1={plot.bounds.left}
                x2={plot.bounds.left}
                y1={plot.bounds.top}
                y2={plot.bounds.bottom}
                className="chart-axis"
              />
              <line
                x1={plot.bounds.left}
                x2={plot.bounds.right}
                y1={plot.bounds.bottom}
                y2={plot.bounds.bottom}
                className="chart-axis"
              />
              <g
                key={displayKey}
                className={inspecting ? undefined : "chart-series"}
                style={{ "--chart-step": `${plot.slot}px` } as CSSProperties}
              >
                <path
                  d={plot.path}
                  className="chart-bars"
                  data-bar-count={points.length}
                />
                {plot.xTicks.map((tick) => (
                  <text
                    key={tick}
                    x={plot.x(tick)}
                    y={window === "1h" ? plot.bounds.bottom + 18 : 276}
                    textAnchor={window === "1h" ? "end" : "middle"}
                    transform={
                      window === "1h"
                        ? `rotate(-90 ${plot.x(tick)} ${plot.bounds.bottom + 18})`
                        : undefined
                    }
                    data-block-height={tick}
                    className={
                      window === "1h"
                        ? "chart-tick chart-block-tick"
                        : "chart-tick"
                    }
                  >
                    {integer(tick)}
                  </text>
                ))}
              </g>
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
          <p className="chart-x-caption">Block number</p>
          <div className="chart-inspector">
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
        Each bar is the timestamp of block N minus the timestamp of block N−1.
      </p>
    </section>
  );
}
