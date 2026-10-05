import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import {
  blocksResponse,
  networkResponse,
  publicPath,
  uint64,
} from "../src/lib/contracts";
import { bytes, integer, intervals, timestamp } from "../src/lib/format";
import { ApiError, upstreamOrigin, upstreamRead } from "../src/lib/upstream";

const examples = JSON.parse(
  readFileSync(
    new URL("../../docs/api-v2.examples.json", import.meta.url),
    "utf8",
  ),
);
test("public native examples parse; uint64 values never pass through floating point", () => {
  assert.equal(
    networkResponse.parse(examples.NetworkResponse).data.tip.height,
    "0",
  );
  assert.equal(
    blocksResponse.parse(examples.BlockPageResponse).data.items[0].height,
    "0",
  );
  assert.equal(integer("9007199254740993"), "9,007,199,254,740,993");
  assert.equal(integer("18446744073709551615"), "18,446,744,073,709,551,615");
  for (const value of [
    "00",
    "-1",
    "1e3",
    "18446744073709551616",
    9007199254740993,
  ])
    assert.equal(uint64.safeParse(value).success, false);
  const broken = structuredClone(examples.NetworkResponse);
  broken.meta.chain_height = "2";
  assert.equal(networkResponse.safeParse(broken).success, false);
  const hidden = structuredClone(examples.NetworkResponse);
  hidden.data.tip_difficulty = 9007199254740993;
  assert.equal(networkResponse.safeParse(hidden).success, false);
});
test("public route allowlist rejects secret queries, arbitrary targets and invalid pagination", () => {
  for (const path of [
    "network",
    "openapi.json",
    "blocks/0",
    "raw/block/0",
    `transactions/${"a".repeat(64)}`,
    `raw/transaction/${"a".repeat(64)}`,
  ])
    assert.equal(publicPath(path, new URLSearchParams()), true, path);
  for (const path of [
    "../network",
    "https://example.com",
    "outputs",
    "mempool",
    "raw/blocks/0",
    "block/0",
    "blocks/00",
    "transactions/0",
  ])
    assert.equal(publicPath(path, new URLSearchParams()), false, path);
  for (const q of [
    "viewkey=secret",
    "limit=0",
    "limit=21",
    "limit=01",
    "limit=10&limit=20",
    "cursor=",
    "cursor=invalid",
  ])
    assert.equal(publicPath("blocks", new URLSearchParams(q)), false, q);
  assert.equal(
    publicPath("network", new URLSearchParams("viewkey=secret")),
    false,
  );
  assert.equal(
    publicPath(
      "blocks",
      new URLSearchParams({ limit: "20", cursor: `20.${"a".repeat(64)}.0` }),
    ),
    true,
  );
});
test("timestamp and interval interpretation excludes absent genesis time and decreasing timestamps", () => {
  assert.equal(timestamp("0"), "Not recorded");
  assert.equal(
    timestamp("18446744073709551615"),
    "18,446,744,073,709,551,615 Unix seconds",
  );
  assert.equal(bytes("18446744073709551615"), "18,014,398,509,481,983.9 KiB");
  const base = examples.NetworkResponse.data.tip;
  const items = [
    { ...base, height: "3", timestamp_unix: "1000" },
    { ...base, height: "2", timestamp_unix: "760" },
    { ...base, height: "1", timestamp_unix: "800" },
    base,
  ];
  assert.deepEqual(intervals(items), [{ height: "3", seconds: 240n }]);
});
test("upstream origins are fixed HTTP(S) origins without credentials or paths", () => {
  assert.equal(
    upstreamOrigin("http://127.0.0.1:8081"),
    "http://127.0.0.1:8081",
  );
  for (const origin of [
    "file:///tmp/a",
    "https://user:pass@example.com",
    "http://example.com/api",
    "http://example.com?token=secret",
    "http://example.com/#x",
  ])
    assert.throws(() => upstreamOrigin(origin));
});

let server: Server;
let mode = "ok";
before(async () => {
  server = createServer((_req, res) => {
    if (mode === "redirect") {
      res.writeHead(302, { Location: "http://127.0.0.1:1/private" });
      res.end();
      return;
    }
    if (mode === "slow") return;
    res.setHeader(
      "Content-Type",
      mode === "html" ? "text/html" : "application/json",
    );
    if (mode === "body-slow") {
      res.write("{");
      return;
    }
    if (mode === "huge") {
      res.setHeader("Content-Length", 8 * 1024 * 1024 + 1);
      res.end("{}");
      return;
    }
    if (mode === "chunked") {
      res.write(" ".repeat(8 * 1024 * 1024));
      res.end("{}");
      return;
    }
    res.statusCode = mode === "reorg" ? 409 : 200;
    res.end(
      mode === "reorg"
        ? '{"error":{"code":"chain_changed","message":"The chain changed."}}'
        : '{"native_json":{"large":18446744073709551615}}',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.RYO_API_URL = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
test("bounded upstream reads preserve raw numeric tokens and reorg status", async () => {
  mode = "ok";
  assert.equal(
    (await upstreamRead("network")).text,
    '{"native_json":{"large":18446744073709551615}}',
  );
  mode = "reorg";
  assert.equal((await upstreamRead("blocks")).status, 409);
});
test("redirects, non-JSON and both declared and streamed oversized bodies fail safely", async () => {
  for (const value of ["redirect", "html", "huge", "chunked"]) {
    mode = value;
    await assert.rejects(
      upstreamRead("network"),
      (e: unknown) =>
        e instanceof ApiError &&
        e.status === 503 &&
        !e.message.includes("private"),
    );
  }
});
test("capacity and response deadline are bounded, including response body wait", async () => {
  mode = "slow";
  const pending = Array.from({ length: 16 }, () =>
    upstreamRead("network").catch((e) => e),
  );
  await assert.rejects(upstreamRead("network"), /busy/);
  const start = Date.now();
  const results = await Promise.all(pending);
  assert.ok(Date.now() - start < 8000);
  assert.ok(results.every((e) => e instanceof ApiError && e.status === 503));
  mode = "body-slow";
  await assert.rejects(
    upstreamRead("network"),
    (e: unknown) => e instanceof ApiError && e.status === 503,
  );
  mode = "ok";
  assert.equal((await upstreamRead("network")).status, 200);
});
