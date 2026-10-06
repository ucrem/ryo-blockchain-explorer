import type { BlockIntervalsResponse } from "./contracts";
export type IntervalPoint = BlockIntervalsResponse["data"]["points"][number];
export const plotBounds = {
  left: 96,
  right: 972,
  top: 20,
  bottom: 248,
  width: 1000,
};
export function intervalPlot(points: IntervalPoint[], target: number | null) {
  const first = BigInt(points[0]?.height ?? "0"),
    last = BigInt(points.at(-1)?.height ?? "0");
  let low = 0n,
    high = BigInt(target ?? 1);
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
    first === last
      ? (plotBounds.left + plotBounds.right) / 2
      : plotBounds.left +
        (Number(((BigInt(height) - first) * 1000000n) / (last - first)) /
          1000000) *
          (plotBounds.right - plotBounds.left);
  const y = (value: string | bigint) =>
    plotBounds.bottom -
    (Number(((BigInt(value) - low) * 1000000n) / (high - low)) / 1000000) *
      (plotBounds.bottom - plotBounds.top);
  const commands = points.map((point, i) => {
    const start =
      i === 0 || BigInt(point.height) !== BigInt(points[i - 1].height) + 1n;
    const isolated =
      start &&
      (i === points.length - 1 ||
        BigInt(points[i + 1].height) !== BigInt(point.height) + 1n);
    const px = x(point.height),
      py = y(point.interval_seconds);
    return isolated
      ? `M${(px - 1).toFixed(2)},${py.toFixed(2)}L${(px + 1).toFixed(2)},${py.toFixed(2)}`
      : `${start ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`;
  });
  const tickCount = last.toString().length > 12 ? 2 : 4;
  const xTicks = [
    ...new Set(
      Array.from({ length: tickCount + 1 }, (_, i) =>
        (first + ((last - first) * BigInt(i)) / BigInt(tickCount)).toString(),
      ),
    ),
  ];
  const yTicks: string[] = [];
  for (let value = low; value <= high; value += step)
    yTicks.push(value.toString());
  return { x, y, first, last, path: commands.join(" "), xTicks, yTicks };
}
export function nearestInterval(points: IntervalPoint[], height: bigint) {
  let low = 0,
    high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (BigInt(points[mid].height) < height) low = mid + 1;
    else high = mid;
  }
  if (
    low > 0 &&
    height - BigInt(points[low - 1].height) <
      BigInt(points[low].height) - height
  )
    return low - 1;
  return low;
}
export function axisSeconds(value: string) {
  const negative = value.startsWith("-"),
    digits = negative ? value.slice(1) : value;
  return digits.length <= 7
    ? BigInt(value).toLocaleString("en-US")
    : `${negative ? "−" : ""}${digits[0]}.${digits.slice(1, 3)}e${digits.length - 1}`;
}
