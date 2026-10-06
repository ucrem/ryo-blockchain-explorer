import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import {
  mempoolResponse,
  keyImageResponse,
  outputCheckResponse,
  addressResponse,
  transactionInspection,
  blockResponse,
  transactionResponse,
  publicIdentifier,
  blocksResponse,
  networkResponse,
  publicPath,
  uint64,
  blockIntervalsResponse,
} from "../src/lib/contracts";
import { publicNodeStatus } from "../src/lib/node-status";
import { intervalPlot } from "../src/lib/interval-plot";
import {
  ringSize,
  paymentIdTypes,
  bytes,
  coins,
  integer,
  timestamp,
  hashrate,
  feePerKiB,
} from "../src/lib/format";
import { ApiError, upstreamOrigin, upstreamRead } from "../src/lib/upstream";

import { viewPages, slicePage } from "../src/lib/view-pages";

import { prettyJson, JsonPreviewLimit } from "../src/lib/pretty-json";
import { toolQuery } from "../src/lib/tool-query";
import { recentTransactions } from "../src/lib/recent-transactions";

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
test("interval windows preserve exact signed deltas, continuity, axes and bounded query shapes", () => {
  const genesis = blockIntervalsResponse.parse(examples.BlockIntervalsResponse);
  assert.equal(genesis.data.points.length, 0);
  const result = structuredClone(genesis);
  const height = 9007199254740993n;
  result.meta.chain_height = (height + 3n).toString();
  Object.assign(result.data, {
    anchor_height: (height + 2n).toString(),
    anchor_timestamp_unix: "1030",
    start_timestamp_unix: "0",
    scanned_from_height: height.toString(),
    scanned_count: 3,
    oldest_timestamp_unix: "970",
    points: [
      {
        height: height.toString(),
        timestamp_unix: "1000",
        previous_timestamp_unix: "950",
        interval_seconds: "50",
      },
      {
        height: (height + 1n).toString(),
        timestamp_unix: "970",
        previous_timestamp_unix: "1000",
        interval_seconds: "-30",
      },
      {
        height: (height + 2n).toString(),
        timestamp_unix: "1030",
        previous_timestamp_unix: "970",
        interval_seconds: "60",
      },
    ],
  });
  const parsed = blockIntervalsResponse.parse(result);
  const plot = intervalPlot(parsed.data.points, true);
  assert.equal(plot.first, height);
  assert.equal(plot.last, height + 2n);
  assert.ok(plot.y("-30") > plot.y("50"));
  assert.ok(plot.yTicks.includes("0"));
  assert.ok(plot.x(height + 1n) > plot.x(height));
  const invalid = structuredClone(result);
  invalid.data.points[1].interval_seconds = "0";
  assert.equal(blockIntervalsResponse.safeParse(invalid).success, false);
  invalid.data.points[1].interval_seconds = "-0";
  assert.equal(blockIntervalsResponse.safeParse(invalid).success, false);
  invalid.data.anchor_height = "unsupported";
  assert.equal(blockIntervalsResponse.safeParse(invalid).success, false);
  const separated = intervalPlot(
    [parsed.data.points[0], parsed.data.points[2]],
    true,
  );
  assert.equal((separated.path.match(/M/g) ?? []).length, 2);
  assert.equal((separated.path.match(/Z/g) ?? []).length, 2);
  assert.deepEqual(
    plot.xTicks,
    parsed.data.points.map((point) => point.height),
  );
  assert.ok(plot.x(plot.last) > plot.bounds.right - plot.slot);
  const single = intervalPlot([parsed.data.points[0]], true);
  assert.equal(single.xTicks.length, 1);
  assert.equal((single.path.match(/Z/g) ?? []).length, 1);
  for (const count of [4, 10, 20]) {
    const points = Array.from({ length: count }, (_, i) => ({
      ...parsed.data.points[0],
      height: (height + BigInt(i)).toString(),
    }));
    const fixed = intervalPlot(points, true, 312);
    assert.equal(fixed.bounds.width, 312);
    assert.equal((fixed.path.match(/M/g) ?? []).length, count);
    assert.equal(fixed.xTicks.length, count);
    assert.ok(fixed.x(points[0].height) > fixed.bounds.left);
    assert.ok(fixed.x(points.at(-1)!.height) < fixed.bounds.right);
  }
  for (const window of ["1h", "24h", "7d", "30d"])
    assert.equal(
      publicPath(
        "block-intervals",
        new URLSearchParams({ window, anchor: "a".repeat(64) }),
      ),
      true,
    );
  for (const query of [
    "window=2h",
    "window=1h&window=7d",
    "anchor=x",
    "viewkey=secret",
    "limit=50000",
  ])
    assert.equal(
      publicPath("block-intervals", new URLSearchParams(query)),
      false,
    );
});
test("reference dashboard metrics retain exact arithmetic and reject unsafe or untrusted node replies", () => {
  assert.equal(hashrate("63526812", 240), "264.695 kH/s");
  assert.equal(feePerKiB("30000000", "1024"), "0.030000000 RYO");
  assert.equal(feePerKiB("30000000", "0"), null);
  assert.equal(hashrate("18446744073709551615", 240), "76,861,433.640 GH/s");
  const sample = {
    status: "OK",
    untrusted: false,
    height: 20,
    target_height: 100,
    difficulty: 63526812,
    target: 240,
    top_block_hash: "a".repeat(64),
    incoming_connections_count: 0,
    outgoing_connections_count: 2,
    is_ready: false,
    offline: false,
    mainnet: true,
    testnet: false,
    stagenet: false,
    bootstrap_daemon_address: "never-public",
    extra_private_field: "must-not-leak",
  };
  const result = publicNodeStatus(sample);
  assert.equal(result.height, "20");
  assert.equal(result.network, "mainnet");
  assert.equal(JSON.stringify(result).includes("never-public"), false);
  assert.throws(() =>
    publicNodeStatus({ ...sample, height: 9007199254740992 }),
  );
  assert.throws(() => publicNodeStatus({ ...sample, untrusted: true }));
  assert.throws(() => publicNodeStatus({ ...sample, testnet: true }));
  assert.equal(
    publicNodeStatus({ ...sample, height: "18446744073709551615" }).height,
    "18446744073709551615",
  );
  const overview = networkResponse.parse(examples.NetworkResponse).data
    .overview!;
  assert.equal(overview.issued_atomic, "8800000000000000");
  const malformed = structuredClone(examples.NetworkResponse);
  malformed.data.overview.issued_atomic = 8800000000000000;
  assert.equal(networkResponse.safeParse(malformed).success, false);
});
test("dashboard transaction reads are bounded, exact and tied to the displayed native blocks", async () => {
  const genesis = blocksResponse.parse(examples.BlockPageResponse);
  const noRead = () => {
    throw new Error("Coinbase-only page should use its native headers");
  };
  const coinbase = await recentTransactions(genesis, noRead);
  assert.equal(coinbase.items[0].hash, genesis.data.items[0].coinbase_hash);
  assert.equal(coinbase.items[0].feeAtomic, null);
  const page = structuredClone(genesis);
  page.meta.chain_height = "20";
  page.data.items = Array.from({ length: 20 }, (_, index) => ({
    ...genesis.data.items[0],
    height: String(19 - index),
    hash: (index + 1).toString(16).padStart(64, "0"),
    coinbase_hash: (index + 30).toString(16).padStart(64, "0"),
    transaction_count: 2,
  }));
  let reads = 0;
  const read = async (hash: string) => {
    reads++;
    const header = page.data.items.find((block) => block.hash === hash)!;
    return {
      meta: page.meta,
      data: {
        header,
        transactions: [
          {
            ...examples.BlockResponse.data.transactions[0],
            hash: header.coinbase_hash,
          },
          {
            ...examples.BlockResponse.data.transactions[0],
            hash: (BigInt(header.height) + 100n).toString(16).padStart(64, "0"),
            coinbase: false,
            fee_atomic: "9007199254740993",
          },
        ],
      },
    };
  };
  const result = await recentTransactions(page, read);
  assert.equal(reads, 4);
  assert.equal(result.items.length, 8);
  assert.equal(result.limited, true);
  assert.equal(result.items[1].feeAtomic, "9007199254740993");
  assert.equal(result.items[1].blockHeight, "19");
  await assert.rejects(
    recentTransactions(page, async (hash) => {
      const detail = await read(hash);
      return {
        ...detail,
        meta: { ...detail.meta, network: "testnet" as const },
      };
    }),
  );
  await assert.rejects(
    recentTransactions(page, async () => {
      throw new Error("Missing block after reorg");
    }),
  );
  page.data.items[0].transaction_count = 25;
  const capped = await recentTransactions(page, async (hash) => {
    const detail = await read(hash);
    detail.data.transactions = Array.from({ length: 25 }, (_, index) => ({
      ...detail.data.transactions[0],
      hash: (200 + index).toString(16).padStart(64, "0"),
      coinbase: index === 0,
    }));
    detail.data.transactions[0].hash = detail.data.header.coinbase_hash;
    return detail;
  });
  assert.equal(capped.items.length, 20);
});
test("public route allowlist rejects secret queries, arbitrary targets and invalid pagination", () => {
  for (const path of [
    "network",
    "openapi.json",
    "mempool",
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
test("timestamp and byte formatting preserve absent genesis time and exact uint64 quantities", () => {
  assert.equal(timestamp("0"), "Not recorded");
  assert.equal(
    timestamp("18446744073709551615"),
    "18,446,744,073,709,551,615 Unix seconds",
  );
  assert.equal(bytes("18446744073709551615"), "18,014,398,509,481,983.9 KiB");
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

test("detail DTOs reject mismatched counts, invalid inclusion and disclosed RingCT amounts", () => {
  assert.equal(
    blockResponse.parse(examples.BlockResponse).data.header.height,
    "0",
  );
  assert.equal(
    transactionResponse.parse(examples.TransactionResponse).data.fee_atomic,
    "0",
  );
  const empty = structuredClone(examples.BlockResponse);
  empty.data.transactions = [];
  assert.equal(blockResponse.safeParse(empty).success, false);
  const bad = structuredClone(examples.TransactionResponse);
  bad.data.inclusion.confirmations = "2";
  assert.equal(transactionResponse.safeParse(bad).success, false);
  bad.data.inclusion.block_height = "1e3";
  assert.equal(transactionResponse.safeParse(bad).success, false);
  const ring = structuredClone(examples.TransactionResponse);
  ring.data.coinbase = false;
  ring.data.coinbase_height = null;
  ring.data.ringct_type = 1;
  ring.data.inclusion = {
    state: "mempool",
    block_height: null,
    timestamp_unix: null,
    confirmations: "0",
  };
  assert.equal(transactionResponse.safeParse(ring).success, false);
  ring.data.outputs[0].amount_atomic = null;
  assert.equal(
    transactionResponse.parse(ring).data.outputs[0].amount_atomic,
    null,
  );
  assert.equal(coins("9007199254740993"), "9,007,199.254740993 RYO");
  assert.equal(coins("18446744073709551615"), "18,446,744,073.709551615 RYO");
});
test("public search normalizes identifiers and rejects unbounded or non-public query shapes", () => {
  assert.deepEqual(publicIdentifier(" 00012 "), {
    kind: "height",
    value: "12",
  });
  assert.deepEqual(publicIdentifier("A".repeat(64)), {
    kind: "hash",
    value: "a".repeat(64),
  });
  assert.equal(
    publicIdentifier("18446744073709551615")?.value,
    "18446744073709551615",
  );
  for (const value of [
    "",
    "-1",
    "1e3",
    "18446744073709551616",
    "a".repeat(63),
    "https://example.com",
    "../0",
    ["0", "1"],
    "a".repeat(1000),
  ])
    assert.equal(publicIdentifier(value), null);
});
test("detail row pagination bounds HTML output and rejects duplicate or unsupported parameters", () => {
  assert.deepEqual(viewPages({}, ["page"]), { page: 1 });
  for (const query of [
    { page: "0" },
    { page: "01" },
    { page: ["1", "2"] },
    { page: "1000000" },
    { viewkey: "private" },
  ])
    assert.equal(viewPages(query, ["page"]), null);
  const page = slicePage(
    Array.from({ length: 51 }, (_, n) => n),
    2,
    50,
  )!;
  assert.deepEqual(page.items, [50]);
  assert.equal(page.pages, 2);
  assert.equal(slicePage([1], 2, 50), null);
});

test("JSON formatting preserves native numeric lexemes, strings, duplicate keys and empty containers", () => {
  const quoted = JSON.stringify(
    'spaces, [brackets]: "quotes" and\nnewlines <script>',
  );
  const source = `{"integer":18446744073709551615,"decimal":1.2300,"exponent":1e400,"negative":-0,"quoted":${quoted},"empty":{},"array":[true,null,[]]}`;
  assert.equal(
    prettyJson(source),
    `{
  "integer": 18446744073709551615,
  "decimal": 1.2300,
  "exponent": 1e400,
  "negative": -0,
  "quoted": ${quoted},
  "empty": {},
  "array": [
    true,
    null,
    []
  ]
}`,
  );
  assert.equal(
    prettyJson('{"duplicate":1,"duplicate":2}'),
    '{\n  "duplicate": 1,\n  "duplicate": 2\n}',
  );
  assert.equal(prettyJson('  "\\u0061" '), '"\\u0061"');
  assert.equal(prettyJson(" \n 123 \t"), "123");
});
test("JSON formatting rejects malformed syntax without decoding numbers", () => {
  for (const source of [
    "",
    "{",
    "[1,]",
    '{"a":1,}',
    '{"a" 1}',
    '{"a":}',
    "[01]",
    "[+1]",
    "[1.]",
    "[1e]",
    "[true false]",
    "{} {}",
    "{1:2}",
    '"bad\nstring"',
    '"\\x41"',
    '"\\u12xz"',
    "/* comment */{}",
  ])
    assert.throws(() => prettyJson(source), SyntaxError);
});
test("embedded JSON formatting has explicit size, depth and expansion bounds", () => {
  assert.throws(
    () => prettyJson(" ".repeat(1024 * 1024 + 1)),
    JsonPreviewLimit,
  );
  assert.throws(
    () => prettyJson("[".repeat(65) + "0" + "]".repeat(65)),
    JsonPreviewLimit,
  );
  const deepArray =
    "[".repeat(60) + Array(40000).fill("0").join(",") + "]".repeat(60);
  assert.throws(() => prettyJson(deepArray), JsonPreviewLimit);
});

test("pool pages and inspection tools preserve public scope, exact metadata and request bounds", () => {
  assert.equal(
    mempoolResponse.parse(examples.MempoolResponse).data.transaction_count,
    "0",
  );
  assert.equal(
    keyImageResponse.parse(examples.KeyImageResponse).data.scope,
    "confirmed_chain",
  );
  assert.deepEqual(
    outputCheckResponse.parse(examples.OutputCheckResponse).data.output_indices,
    [0],
  );
  assert.equal(
    addressResponse.parse(examples.AddressResponse).data.valid,
    false,
  );
  const inspection = {
    ring_size_min: "3",
    ring_size_max: "5",
    payment_id_types: ["uniform"],
  };
  assert.equal(transactionInspection.safeParse(inspection).success, true);
  assert.equal(ringSize(inspection), "3–5");
  assert.equal(paymentIdTypes(inspection.payment_id_types), "Uniform");
  assert.equal(ringSize(undefined), "—");
  assert.equal(paymentIdTypes(undefined), "—");
  assert.equal(
    transactionInspection.safeParse({ ...inspection, ring_size_min: "6" })
      .success,
    false,
  );
  assert.equal(
    transactionInspection.safeParse({
      ...inspection,
      payment_id_types: ["uniform", "uniform"],
    }).success,
    false,
  );
  const broken = structuredClone(examples.MempoolResponse);
  broken.data.items = [examples.BlockResponse.data.transactions[0]];
  assert.equal(mempoolResponse.safeParse(broken).success, false);
  for (const query of [
    "limit=101",
    "limit=0",
    "cursor=" + "a".repeat(64) + ".10001",
    "limit=1&limit=2",
    "viewkey=secret",
  ])
    assert.equal(publicPath("mempool", new URLSearchParams(query)), false);
  assert.equal(
    publicPath(
      "mempool",
      new URLSearchParams({ limit: "100", cursor: "a".repeat(64) + ".100" }),
    ),
    true,
  );
  assert.equal(
    publicPath("tools/key-images/" + "a".repeat(64), new URLSearchParams()),
    true,
  );
  assert.equal(
    publicPath(
      "tools/key-images/" + "a".repeat(64),
      new URLSearchParams("viewkey=secret"),
    ),
    false,
  );
  assert.equal(
    publicPath("tools/addresses/" + "1".repeat(201), new URLSearchParams()),
    false,
  );
  assert.deepEqual(toolQuery({ tool: "key-image", value: "A".repeat(64) }), {
    tool: "key-image",
    value: "a".repeat(64),
    transaction: undefined,
  });
  assert.equal(toolQuery({ tool: "output", value: "a".repeat(64) }), null);
  assert.equal(toolQuery({ tool: "key-image", value: ["a".repeat(64)] }), null);
  assert.equal(
    toolQuery({ tool: "address", value: "1".repeat(95), viewkey: "secret" }),
    null,
  );
});
