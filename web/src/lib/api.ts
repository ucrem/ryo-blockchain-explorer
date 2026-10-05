import "server-only";
import { z } from "zod";
import {
  blockResponse,
  blocksResponse,
  hash,
  networkResponse,
  publicIdentifier,
  publicPath,
  transactionResponse,
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
