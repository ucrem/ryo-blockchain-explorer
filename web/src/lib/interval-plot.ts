import type { BlockIntervalsResponse } from "./contracts";
export type IntervalPoint = BlockIntervalsResponse["data"]["points"][number];
export const plotBounds = {
  left: 96,
  right: 972,
  top: 20,
  bottom: 248,
  width: 1000,
};
export const plotHeight = 440;
export function intervalPlot(
  points: IntervalPoint[],
  labelEveryBlock = false,
  width = 1000,
) {
  const bounds = {
    ...plotBounds,
    width,
    left: width < 600 ? 84 : 96,
    right: width - 12,
  };
  const slot = (bounds.right - bounds.left) / Math.max(1, points.length);
  const indexes = new Map(points.map((point, i) => [point.height, i]));
  const first = BigInt(points[0]?.height ?? "0"),
    last = BigInt(points.at(-1)?.height ?? "0");
  let low = 0n,
    high = 1n;
  for (const point of points) {
    const value = BigInt(point.interval_seconds);
    if (value < low) low = value;
    if (value > high) high = value;
  }
  if (high === low) high = low + 1n;
  const roughStep = (high - low) / 4n || 1n;
  let magnitude = 1n;
  while (magnitude * 10n <= roughStep) magnitude *= 10n;
  const step =
    [1n, 2n, 5n, 10n].find((value) => value * magnitude >= roughStep)! *
    magnitude;
  low = low < 0n ? -((-low + step - 1n) / step) * step : (low / step) * step;
  high = ((high + step - 1n) / step) * step;
  const x = (height: string | bigint) =>
    bounds.left + ((indexes.get(height.toString()) ?? 0) + 0.5) * slot;
  const y = (value: string | bigint) =>
    plotBounds.bottom -
    (Number(((BigInt(value) - low) * 1000000n) / (high - low)) / 1000000) *
      (plotBounds.bottom - plotBounds.top);
  const barWidth = Math.max(0.01, slot * 0.7);
  const baseline = y("0");
  // One closed subpath per block keeps large native windows inexpensive to render.
  const path = points
    .map((point) => {
      const left = x(point.height) - barWidth / 2;
      const top = Math.min(baseline, y(point.interval_seconds));
      const height = Math.max(
        0.8,
        Math.abs(y(point.interval_seconds) - baseline),
      );
      return `M${left.toFixed(2)},${top.toFixed(2)}h${barWidth.toFixed(2)}v${height.toFixed(2)}h-${barWidth.toFixed(2)}Z`;
    })
    .join(" ");
  const tickCount = last.toString().length > 12 ? 2 : 4;
  const xTicks = labelEveryBlock
    ? points.map((point) => point.height)
    : [
        ...new Set(
          Array.from(
            { length: Math.min(points.length, tickCount + 1) },
            (_, i) =>
              points[
                Math.round(
                  (i * (points.length - 1)) /
                    Math.min(points.length - 1, tickCount || 1),
                ) || 0
              ]?.height,
          ).filter((height): height is string => height !== undefined),
        ),
      ];
  const yTicks: string[] = [];
  for (let value = low; value <= high; value += step)
    yTicks.push(value.toString());
  return { x, y, first, last, path, xTicks, yTicks, bounds, slot };
}
export function axisSeconds(value: string) {
  const negative = value.startsWith("-"),
    digits = negative ? value.slice(1) : value;
  return digits.length <= 7
    ? BigInt(value).toLocaleString("en-US")
    : `${negative ? "−" : ""}${digits[0]}.${digits.slice(1, 3)}e${digits.length - 1}`;
}
