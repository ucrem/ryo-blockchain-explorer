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

export function publicPath(path: string, query: URLSearchParams): boolean {
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
