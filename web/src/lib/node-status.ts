import { z } from "zod";
import { hash, uint64 } from "./contracts";
import { nodeHealth } from "./node-health";
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
    network: data.mainnet
      ? ("mainnet" as const)
      : data.testnet
        ? ("testnet" as const)
        : ("stagenet" as const),
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

export const nodeObservation = z.object({
  network: z.enum(["mainnet", "testnet", "stagenet"]),
  height: uint64,
  targetHeight: uint64,
  difficulty: uint64,
  targetSeconds: z.number().int().min(1).max(4294967295),
  hash,
  incoming: uint64,
  outgoing: uint64,
  ready: z.boolean(),
  offline: z.boolean(),
  checkedAt: z.iso.datetime(),
  stale: z.boolean(),
  health: nodeHealth,
});
export type NodeObservation = z.infer<typeof nodeObservation>;
export const nodeStatusResponse = z.object({
  status: nodeObservation.or(z.literal("unavailable")).nullable(),
});
