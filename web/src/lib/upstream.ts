// Imported by the server-only API facade; no browser upstream configuration.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
// Share capacity across the separately bundled page and route-handler entries.
const processState = globalThis as typeof globalThis & {
  ryoExplorerReads?: { inFlight: number };
};
const capacity = (processState.ryoExplorerReads ??= { inFlight: 0 });
const MAX_BODY = 8 * 1024 * 1024;

export function upstreamOrigin(
  value = process.env.RYO_API_URL ?? "http://127.0.0.1:8081",
): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new ApiError(503, "unavailable", "The chain reader is unavailable.");
  return url.origin;
}

export async function upstreamRead(
  path: string,
  query = new URLSearchParams(),
): Promise<{ status: number; text: string }> {
  if (capacity.inFlight >= 16)
    throw new ApiError(
      503,
      "unavailable",
      "The chain reader is busy. Try again shortly.",
    );
  capacity.inFlight++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const url = new URL(`/api/v2/${path}`, upstreamOrigin());
    url.search = query.toString();
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (
      ![200, 400, 404, 405, 409, 503].includes(response.status) ||
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      throw new Error("Unexpected upstream response");
    const length = response.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || BigInt(length) > BigInt(MAX_BODY)))
      throw new Error("Body limit");
    if (!response.body) throw new Error("Missing body");
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) throw new Error("Body limit");
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      status: response.status,
      text: new TextDecoder("utf-8", { fatal: true }).decode(body),
    };
  } catch {
    throw new ApiError(
      503,
      "unavailable",
      "The chain reader is unavailable. Try again shortly.",
    );
  } finally {
    controller.abort();
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        /* Already closed or aborted. */
      }
    }
    clearTimeout(timer);
    capacity.inFlight--;
  }
}
