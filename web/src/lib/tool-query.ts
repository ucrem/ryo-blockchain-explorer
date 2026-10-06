import { hash, publicAddress } from "./contracts";
import type { ViewQuery } from "./view-pages";
export type ToolQuery = {
  tool: "key-image" | "output" | "address";
  value?: string;
  transaction?: string;
};
export function toolQuery(query: ViewQuery): ToolQuery | null {
  if (
    Object.keys(query).some(
      (key) => !["tool", "value", "transaction"].includes(key),
    ) ||
    Object.values(query).some((value) => typeof value !== "string")
  )
    return null;
  const tool = query.tool;
  if (!["key-image", "output", "address"].includes(tool as string)) return null;
  const value = query.value as string | undefined;
  const transaction = query.transaction as string | undefined;
  if (
    (value !== undefined && value.length > 256) ||
    (transaction !== undefined && transaction.length > 64)
  )
    return null;
  const normalized = value?.trim();
  if (
    normalized &&
    !(tool === "address"
      ? publicAddress.safeParse(normalized).success
      : hash.safeParse(normalized.toLowerCase()).success)
  )
    return null;
  if (
    transaction !== undefined &&
    (tool !== "output" || !hash.safeParse(transaction.toLowerCase()).success)
  )
    return null;
  if (normalized && tool === "output" && !transaction) return null;
  return {
    tool: tool as ToolQuery["tool"],
    value: normalized
      ? tool === "address"
        ? normalized
        : normalized.toLowerCase()
      : undefined,
    transaction: transaction?.toLowerCase(),
  };
}
