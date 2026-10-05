import type { BlockSummary } from "./contracts";

export function integer(value: string | bigint | number): string {
  return BigInt(value).toLocaleString("en-US");
}
export function coins(value: string): string {
  const atomic = BigInt(value);
  return `${integer(atomic / 1000000000n)}.${(atomic % 1000000000n).toString().padStart(9, "0")} RYO`;
}
export function bytes(value: string): string {
  const n = BigInt(value);
  if (n < 1024n) return `${integer(n)} B`;
  return `${integer(n / 1024n)}.${((n % 1024n) * 10n) / 1024n} KiB`;
}
export function timestamp(value: string): string {
  if (value === "0") return "Not recorded";
  const seconds = BigInt(value);
  if (seconds > 8640000000000n) return `${integer(value)} Unix seconds`;
  return new Date(Number(seconds) * 1000)
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", " UTC");
}
export function intervals(items: BlockSummary[]) {
  const result: { height: string; seconds: bigint }[] = [];
  for (let i = items.length - 2; i >= 0; i--) {
    const newer = items[i],
      older = items[i + 1];
    if (
      older.timestamp_unix !== "0" &&
      BigInt(newer.timestamp_unix) >= BigInt(older.timestamp_unix)
    )
      result.push({
        height: newer.height,
        seconds: BigInt(newer.timestamp_unix) - BigInt(older.timestamp_unix),
      });
  }
  return result;
}
