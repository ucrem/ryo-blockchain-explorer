import { z } from "zod";

export const uint64 = z
  .string()
  .refine(
    (s) =>
      /^(0|[1-9][0-9]{0,19})$/.test(s) && BigInt(s) <= 18446744073709551615n,
  );
export const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const cursor = z
  .string()
  .max(106)
  .regex(/^(0|[1-9][0-9]{0,19})\.[0-9a-f]{64}\.(0|[1-9][0-9]{0,19})$/);
export const meta = z.object({
  network: z.enum(["mainnet", "testnet", "stagenet"]),
  chain_height: uint64,
});
export const block = z.object({
  height: uint64,
  hash,
  previous_hash: hash,
  timestamp_unix: uint64,
  size_bytes: uint64,
  major_version: z.number().int().min(0).max(255),
  minor_version: z.number().int().min(0).max(255),
  nonce: z.number().int().min(0).max(4294967295),
  transaction_count: z.number().int().min(1).max(4294967295),
  coinbase_hash: hash,
});
export const networkResponse = z
  .object({
    meta,
    data: z.object({
      source: z.literal("native_lmdb"),
      tip: block,
      tip_difficulty: uint64,
      overview: z
        .object({
          issued_atomic: uint64.nullable(),
          tip_coinbase_atomic: uint64,
          median_block_size_bytes: uint64,
          median_sample_blocks: z.number().int().min(1).max(100),
          confirmed_transactions: uint64,
          pool_transactions: uint64.nullable(),
          pool_size_bytes: uint64.nullable(),
        })
        .optional(),
      target_block_time_seconds: z.number().int().min(1).max(4294967295),
      units: z.object({
        symbol: z.literal("RYO"),
        atomic_decimals: z.literal(9),
        atomic_units_per_coin: z.literal("1000000000"),
      }),
      explorer_version: z.string().min(1).max(128),
      native_core_version: z.string().min(1).max(128),
      api_version: z.literal("2"),
    }),
  })
  .refine(
    (r) =>
      uint64.safeParse(r.data.tip.height).success &&
      uint64.safeParse(r.meta.chain_height).success &&
      BigInt(r.data.tip.height) + 1n === BigInt(r.meta.chain_height),
  );
export const blocksResponse = z
  .object({
    meta,
    data: z.object({
      items: z.array(block).min(1).max(20),
      anchor_height: uint64,
      anchor_hash: hash,
      next_cursor: cursor.nullable(),
    }),
  })
  .refine((r) => {
    const { items, anchor_height } = r.data;
    if (
      !uint64.safeParse(r.meta.chain_height).success ||
      !uint64.safeParse(anchor_height).success ||
      items.some((b) => !uint64.safeParse(b.height).success)
    )
      return false;
    return (
      BigInt(r.meta.chain_height) > BigInt(anchor_height) &&
      items.every(
        (b, i) =>
          BigInt(b.height) <= BigInt(anchor_height) &&
          (i === 0 ||
            (BigInt(items[i - 1].height) === BigInt(b.height) + 1n &&
              items[i - 1].previous_hash === b.hash)),
      )
    );
  });
export type BlockSummary = z.infer<typeof block>;
export type NetworkResponse = z.infer<typeof networkResponse>;
export type BlocksResponse = z.infer<typeof blocksResponse>;
export const intervalWindow = z.enum(["1h", "24h", "7d", "30d"]);
export type IntervalWindow = z.infer<typeof intervalWindow>;
export const intervalSeconds: Record<IntervalWindow, number> = {
  "1h": 3600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
};
const signedSeconds = z
  .string()
  .refine(
    (value) =>
      /^(0|-?[1-9][0-9]{0,19})$/.test(value) &&
      uint64.safeParse(value.replace(/^-/, "")).success,
  );
export const blockIntervalsResponse = z
  .object({
    meta,
    data: z.object({
      anchor_height: uint64,
      anchor_hash: hash,
      anchor_timestamp_unix: uint64,
      window_seconds: z.union([
        z.literal(3600),
        z.literal(86400),
        z.literal(604800),
        z.literal(2592000),
      ]),
      start_timestamp_unix: uint64,
      scanned_from_height: uint64,
      scanned_count: z.number().int().min(0).max(50000),
      oldest_timestamp_unix: uint64,
      history_limited: z.boolean(),
      points: z
        .array(
          z.object({
            height: uint64,
            timestamp_unix: uint64,
            previous_timestamp_unix: uint64,
            interval_seconds: signedSeconds,
          }),
        )
        .max(50000),
    }),
  })
  .refine(({ data: d, meta: m }) => {
    const decimal = /^(0|[1-9][0-9]{0,19})$/;
    if (
      ![
        d.anchor_height,
        d.anchor_timestamp_unix,
        d.start_timestamp_unix,
        d.scanned_from_height,
        m.chain_height,
      ].every((value) => decimal.test(value)) ||
      !Number.isInteger(d.scanned_count) ||
      d.scanned_count < 0 ||
      d.scanned_count > 50000 ||
      d.points.length > 50000 ||
      !d.points.every(
        (point) =>
          decimal.test(point.height) &&
          decimal.test(point.timestamp_unix) &&
          decimal.test(point.previous_timestamp_unix) &&
          /^(0|-?[1-9][0-9]{0,19})$/.test(point.interval_seconds),
      )
    )
      return false;
    const anchor = BigInt(d.anchor_height),
      end = BigInt(d.anchor_timestamp_unix),
      duration = BigInt(d.window_seconds);
    const start = BigInt(d.start_timestamp_unix),
      first = BigInt(d.scanned_from_height);
    if (
      anchor >= BigInt(m.chain_height) ||
      start !== (end > duration ? end - duration : 0n) ||
      d.points.length > d.scanned_count
    )
      return false;
    if (
      anchor === 0n
        ? first !== 0n || d.scanned_count !== 0
        : first < 1n ||
          first > anchor ||
          anchor - first + 1n !== BigInt(d.scanned_count)
    )
      return false;
    return d.points.every((point, i) => {
      const time = BigInt(point.timestamp_unix),
        previous = BigInt(point.previous_timestamp_unix),
        height = BigInt(point.height);
      return (
        height >= first &&
        height <= anchor &&
        (height !== anchor || time === end) &&
        time > 0n &&
        previous > 0n &&
        time >= start &&
        time <= end &&
        BigInt(point.interval_seconds) === time - previous &&
        (i === 0 ||
          (height > BigInt(d.points[i - 1].height) &&
            (height !== BigInt(d.points[i - 1].height) + 1n ||
              previous === BigInt(d.points[i - 1].timestamp_unix))))
      );
    });
  });
export type BlockIntervalsResponse = z.infer<typeof blockIntervalsResponse>;

const count = z.number().int().min(0).max(4294967295);
const transactionSummary = z.object({
  hash,
  version: z.number().int().min(0).max(255),
  ringct_type: z.number().int().min(0).max(255),
  coinbase: z.boolean(),
  size_bytes: uint64,
  fee_atomic: uint64,
  input_count: count,
  output_count: count,
});
export const blockResponse = z
  .object({
    meta,
    data: z.object({
      header: block,
      transactions: z.array(transactionSummary).min(1),
    }),
  })
  .refine((r) => {
    const { header, transactions } = r.data;
    return (
      uint64.safeParse(header.height).success &&
      uint64.safeParse(r.meta.chain_height).success &&
      BigInt(header.height) < BigInt(r.meta.chain_height) &&
      transactions.length > 0 &&
      transactions.length === header.transaction_count &&
      transactions[0].coinbase &&
      transactions[0].hash === header.coinbase_hash &&
      transactions.slice(1).every((t) => !t.coinbase) &&
      new Set(transactions.map((t) => t.hash)).size === transactions.length
    );
  });
const inclusion = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("confirmed"),
    block_height: uint64,
    timestamp_unix: uint64,
    confirmations: uint64,
  }),
  z.object({
    state: z.literal("mempool"),
    block_height: z.null(),
    timestamp_unix: z.null(),
    confirmations: z.literal("0"),
  }),
]);
export const transactionResponse = z
  .object({
    meta,
    data: transactionSummary.extend({
      inclusion,
      unlock_time: uint64,
      public_key: hash.nullable(),
      additional_public_keys: z.array(hash),
      payment_id: hash.nullable(),
      payment_id8: z
        .string()
        .regex(/^[0-9a-f]{16}$/)
        .nullable(),
      extra_hex: z.string().regex(/^(?:[0-9a-f]{2})*$/),
      coinbase_height: uint64.nullable(),
      inputs: z.array(
        z.object({
          key_image: hash,
          key_offsets_relative: z.array(uint64),
          ring_candidates: z.array(
            z.object({
              public_key: hash,
              block_height: uint64,
              timestamp_unix: uint64,
            }),
          ),
        }),
      ),
      outputs: z.array(
        z.object({
          index: count,
          public_key: hash,
          amount_atomic: uint64.nullable(),
        }),
      ),
    }),
  })
  .refine((r) => {
    const t = r.data,
      i = t.inclusion;
    if (!uint64.safeParse(r.meta.chain_height).success) return false;
    if (
      i.state === "confirmed" &&
      (!uint64.safeParse(i.block_height).success ||
        !uint64.safeParse(i.confirmations).success ||
        BigInt(i.block_height) >= BigInt(r.meta.chain_height) ||
        BigInt(i.confirmations) !==
          BigInt(r.meta.chain_height) - BigInt(i.block_height))
    )
      return false;
    return (
      t.inputs.length === t.input_count &&
      t.outputs.length === t.output_count &&
      t.outputs.every(
        (o, n) =>
          o.index === n &&
          (t.coinbase || t.ringct_type === 0 || o.amount_atomic === null),
      ) &&
      (t.coinbase
        ? t.input_count === 0 &&
          i.state === "confirmed" &&
          t.coinbase_height === i.block_height
        : t.coinbase_height === null)
    );
  });
export type BlockResponse = z.infer<typeof blockResponse>;
export type TransactionResponse = z.infer<typeof transactionResponse>;

// Public search accepts only bounded identifiers, never paths or target URLs.
export function publicIdentifier(
  value: unknown,
): { kind: "height" | "hash"; value: string } | null {
  if (typeof value !== "string" || value.length > 128) return null;
  const text = value.trim();
  if (/^[0-9a-fA-F]{64}$/.test(text))
    return { kind: "hash", value: text.toLowerCase() };
  if (/^[0-9]{1,20}$/.test(text)) {
    const canonical = BigInt(text).toString();
    if (uint64.safeParse(canonical).success)
      return { kind: "height", value: canonical };
  }
  return null;
}

export function publicPath(path: string, query: URLSearchParams): boolean {
  if (path === "block-intervals") {
    if (
      [...query.keys()].some((key) => !["window", "anchor"].includes(key)) ||
      query.getAll("window").length > 1 ||
      query.getAll("anchor").length > 1
    )
      return false;
    const window = query.get("window"),
      anchor = query.get("anchor");
    return (
      (window === null || intervalWindow.safeParse(window).success) &&
      (anchor === null || /^[0-9a-fA-F]{64}$/.test(anchor))
    );
  }
  if (path === "blocks") {
    if ([...query.keys()].some((k) => !["limit", "cursor"].includes(k)))
      return false;
    if (query.getAll("limit").length > 1 || query.getAll("cursor").length > 1)
      return false;
    const limit = query.get("limit");
    if (limit !== null && !/^(?:[1-9]|1[0-9]|20)$/.test(limit)) return false;
    const value = query.get("cursor");
    if (value !== null && !cursor.safeParse(value).success) return false;
    return true;
  }
  if (query.size) return false;
  return (
    /^(network|openapi\.json)$/.test(path) ||
    (/^(?:raw\/)?blocks?\/(?:0|[1-9][0-9]{0,19}|[0-9a-fA-F]{64})$/.test(path) &&
      (path.startsWith("blocks/") || path.startsWith("raw/block/"))) ||
    /^(?:transactions|raw\/transaction)\/[0-9a-fA-F]{64}$/.test(path)
  );
}
