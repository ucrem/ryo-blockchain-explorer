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

export function hashrate(difficulty: string, target: number): string {
  const hashMilli = (BigInt(difficulty) * 1000n) / BigInt(target);
  const scale =
    hashMilli >= 1000000000000n
      ? 1000000000n
      : hashMilli >= 1000000000n
        ? 1000000n
        : hashMilli >= 1000000n
          ? 1000n
          : 1n;
  const unit =
    scale === 1000000000n
      ? "GH/s"
      : scale === 1000000n
        ? "MH/s"
        : scale === 1000n
          ? "kH/s"
          : "H/s";
  const milli = hashMilli / scale;
  return `${integer(milli / 1000n)}.${(milli % 1000n).toString().padStart(3, "0")} ${unit}`;
}

export function feePerKiB(fee: string, size: string): string | null {
  const bytes = BigInt(size);
  return bytes === 0n
    ? null
    : coins(((BigInt(fee) * 1024n) / bytes).toString());
}

export function ringSize(
  value:
    | { ring_size_min: string | null; ring_size_max: string | null }
    | null
    | undefined,
) {
  if (!value || value.ring_size_min === null || value.ring_size_max === null)
    return "—";
  return value.ring_size_min === value.ring_size_max
    ? integer(value.ring_size_min)
    : `${integer(value.ring_size_min)}–${integer(value.ring_size_max)}`;
}
export function paymentIdTypes(types: string[] | undefined) {
  if (!types) return "—";
  return types.length
    ? types
        .map((type) =>
          type === "legacy"
            ? "Legacy"
            : type === "uniform"
              ? "Uniform"
              : "Encrypted",
        )
        .join(" · ")
    : "None";
}

export function poolAge(value: string, now: string): string {
  const elapsed = BigInt(now) - BigInt(value);
  if (elapsed < 0n) return "Clock difference";
  if (elapsed < 60n) return `${integer(elapsed)} s ago`;
  if (elapsed < 3600n) return `${integer(elapsed / 60n)} min ago`;
  if (elapsed < 86400n) return `${integer(elapsed / 3600n)} h ago`;
  return `${integer(elapsed / 86400n)} d ago`;
}
