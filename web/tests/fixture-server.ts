// Isolated browser-test fixture: synthetic headers, not consensus-valid blocks.
// This server is never imported by application code or included in production.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const examples = JSON.parse(
  readFileSync(
    new URL("../../docs/api-v2.examples.json", import.meta.url),
    "utf8",
  ),
);
let mode = "normal";
const anchor = 9007199254741023n;
const makeHash = (height: bigint) => height.toString(16).padStart(64, "0");
const makeBlock = (height: bigint, i: number) => ({
  ...examples.NetworkResponse.data.tip,
  height: height.toString(),
  hash: makeHash(height),
  previous_hash: makeHash(height - 1n),
  timestamp_unix: (
    1791200000 +
    Number(height - anchor) * 240 +
    (i % 3) * 40
  ).toString(),
  size_bytes: (1800 + i * 321).toString(),
  transaction_count: (i % 7) + 1,
});
createServer((req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1:3101");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/__control") {
    mode = url.searchParams.get("mode") ?? "normal";
    res.end("{}");
    return;
  }
  if (mode === "outage") {
    res.statusCode = 503;
    res.end('{"error":{"code":"unavailable","message":"Unavailable"}}');
    return;
  }
  if (mode === "genesis") {
    const result = url.pathname.endsWith("network")
      ? examples.NetworkResponse
      : url.pathname.endsWith("blocks")
        ? examples.BlockPageResponse
        : examples.BlockResponse;
    res.end(JSON.stringify(result));
    return;
  }
  const meta = { network: "mainnet", chain_height: (anchor + 1n).toString() };
  if (url.pathname === "/api/v2/network") {
    res.end(
      JSON.stringify({
        ...examples.NetworkResponse,
        meta,
        data: {
          ...examples.NetworkResponse.data,
          tip: makeBlock(anchor, 0),
          tip_difficulty: "18446744073709551615",
        },
      }),
    );
    return;
  }
  if (url.pathname === "/api/v2/blocks") {
    if (mode === "reorg" && url.searchParams.has("cursor")) {
      res.statusCode = 409;
      res.end(
        '{"error":{"code":"chain_changed","message":"The chain changed."}}',
      );
      return;
    }
    const start = url.searchParams.has("cursor") ? anchor - 20n : anchor;
    const items = Array.from({ length: 20 }, (_, i) =>
      makeBlock(start - BigInt(i), i),
    );
    res.end(
      JSON.stringify({
        meta,
        data: {
          items,
          anchor_height: anchor.toString(),
          anchor_hash: makeHash(anchor),
          next_cursor: `${anchor}.${makeHash(anchor)}.${start - 20n}`,
        },
      }),
    );
    return;
  }
  if (url.pathname.startsWith("/api/v2/raw/")) {
    res.end(
      '{"data":{"native_json":{"exact":18446744073709551615},"blob_hex":"00"}}',
    );
    return;
  }
  if (url.pathname === "/api/v2/openapi.json") {
    res.end('{"openapi":"3.1.1"}');
    return;
  }
  res.end(JSON.stringify(examples.BlockResponse));
}).listen(3101, "127.0.0.1");
