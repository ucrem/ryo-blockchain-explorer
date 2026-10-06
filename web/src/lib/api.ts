import "server-only";
import { z } from "zod";
import {
  mempoolResponse,
  keyImageResponse,
  outputCheckResponse,
  addressResponse,
  blockResponse,
  blocksResponse,
  hash,
  networkResponse,
  publicIdentifier,
  publicPath,
  transactionResponse,
  blockIntervalsResponse,
  intervalSeconds,
  type IntervalWindow,
} from "./contracts";
import { ApiError, upstreamRead } from "./upstream";
export { ApiError } from "./upstream";

export async function readPublic(path: string, query = new URLSearchParams()) {
  if (!publicPath(path, query))
    throw new ApiError(400, "invalid_request", "Invalid public API request.");
  return upstreamRead(path, query);
}
async function readData<T>(
  path: string,
  schema: z.ZodType<T>,
  query = new URLSearchParams(),
): Promise<T> {
  const response = await readPublic(path, query);
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      400: "Invalid public data request.",
      404: "API v2 is unavailable or the requested data was not found.",
      409: "The blockchain changed. Restart from the latest blocks.",
      503: "The chain reader is unavailable. Try again shortly.",
    };
    throw new ApiError(
      response.status,
      response.status === 404
        ? "not_found"
        : response.status === 409
          ? "chain_changed"
          : "unavailable",
      messages[response.status] ?? "The chain reader is unavailable.",
    );
  }
  try {
    return schema.parse(JSON.parse(response.text));
  } catch {
    throw new ApiError(
      503,
      "unavailable",
      "The chain reader returned an unsupported response.",
    );
  }
}
export function readNetwork() {
  return readData("network", networkResponse);
}
export async function readBlockIntervals(
  window: IntervalWindow = "1h",
  anchor?: string,
) {
  const query = new URLSearchParams({ window });
  if (anchor) query.set("anchor", anchor);
  const result = await readData(
    "block-intervals",
    blockIntervalsResponse,
    query,
  );
  if (
    result.data.window_seconds !== intervalSeconds[window] ||
    (anchor && result.data.anchor_hash !== anchor.toLowerCase())
  )
    throw new ApiError(
      503,
      "unavailable",
      "The chain reader returned a different interval window.",
    );
  return result;
}
export function readBlocks(value?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (value) params.set("cursor", value);
  return readData("blocks", blocksResponse, params);
}
export async function readBlock(value: string) {
  const id = publicIdentifier(value);
  if (!id)
    throw new ApiError(400, "invalid_request", "Invalid block identifier.");
  const result = await readData(`blocks/${id.value}`, blockResponse);
  if (
    (id.kind === "height"
      ? result.data.header.height
      : result.data.header.hash) !== id.value
  )
    throw new ApiError(
      503,
      "unavailable",
      "The chain reader returned a different block.",
    );
  return result;
}
export async function readTransaction(value: string) {
  if (!hash.safeParse(value).success)
    throw new ApiError(400, "invalid_request", "Invalid transaction hash.");
  const result = await readData(`transactions/${value}`, transactionResponse);
  if (result.data.hash !== value)
    throw new ApiError(
      503,
      "unavailable",
      "The chain reader returned a different transaction.",
    );
  return result;
}

export function readMempool(cursor?: string, limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return readData("mempool", mempoolResponse, query);
}
export async function checkKeyImage(value: string) {
  const result = await readData(`tools/key-images/${value}`, keyImageResponse);
  if (result.data.key_image !== value)
    throw new ApiError(
      503,
      "unavailable",
      "The reader returned a different key image.",
    );
  return result;
}
export async function checkOutput(transaction: string, key: string) {
  const result = await readData(
    `tools/outputs/${transaction}/${key}`,
    outputCheckResponse,
  );
  if (
    result.data.transaction_hash !== transaction ||
    result.data.public_key !== key
  )
    throw new ApiError(
      503,
      "unavailable",
      "The reader returned different output identifiers.",
    );
  return result;
}
export async function inspectAddress(value: string) {
  const result = await readData(`tools/addresses/${value}`, addressResponse);
  if (result.data.address !== value)
    throw new ApiError(
      503,
      "unavailable",
      "The reader returned a different address.",
    );
  return result;
}
