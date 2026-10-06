import { z } from "zod";
import { hash, uint64 } from "./contracts";
const count = z.preprocess(
  (value) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? String(value)
      : value,
  uint64,
);
export const rpcInfo = z
  .object({
    status: z.literal("OK"),
    untrusted: z.literal(false).optional(),
    height: count,
    target_height: count,
    difficulty: count,
    top_block_hash: hash,
    target: z.number().int().min(1).max(4294967295),
    incoming_connections_count: count,
    outgoing_connections_count: count,
    is_ready: z.boolean(),
    offline: z.boolean(),
    mainnet: z.boolean(),
    testnet: z.boolean(),
    stagenet: z.boolean(),
  })
  .refine(
    (data) =>
      [data.mainnet, data.testnet, data.stagenet].filter(Boolean).length === 1,
  );
export function publicNodeStatus(value: unknown) {
  const data = rpcInfo.parse(value);
  return {
    network: data.mainnet ? "mainnet" : data.testnet ? "testnet" : "stagenet",
    height: data.height,
    targetHeight: data.target_height,
    difficulty: data.difficulty,
    targetSeconds: data.target,
    hash: data.top_block_hash,
    incoming: data.incoming_connections_count,
    outgoing: data.outgoing_connections_count,
    ready: data.is_ready,
    offline: data.offline,
  };
}
export type NodeStatus = ReturnType<typeof publicNodeStatus>;

export type NodeObservation = NodeStatus & {
  checkedAt: string;
  stale: boolean;
};
