// Isolated browser-test fixture: synthetic headers, not consensus-valid blocks.
// This server is never imported by application code or included in production.
import { createServer, type IncomingHttpHeaders } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
const logPath = new URL(
  "../../build/v04-node-health-fixture.log",
  import.meta.url,
);
writeFileSync(logPath, "");
const examples = JSON.parse(
  readFileSync(
    new URL("../../docs/api-v2.examples.json", import.meta.url),
    "utf8",
  ),
);
let mode = "normal";
let reads = 0;
let observed: { url: string; headers: IncomingHttpHeaders; body: string }[] = [];
const receiveFixtures = JSON.parse(readFileSync(new URL("./fixtures/receive.json", import.meta.url), "utf8"));
const anchor = 9007199254741023n;
const makeHash = (height: bigint) => height.toString(16).padStart(64, "0");
const makeBlock = (height: bigint) => {
  const i = Number((((anchor - height) % 20n) + 20n) % 20n);
  return {
    ...examples.NetworkResponse.data.tip,
    height: height.toString(),
    hash: makeHash(height),
    previous_hash: makeHash(height - 1n),
    coinbase_hash: makeHash(height + (1n << 80n)),
    timestamp_unix: (
      1791200000 +
      Number(height - anchor) * 240 +
      (i % 3) * 40
    ).toString(),
    size_bytes: (1800 + i * 321).toString(),
    transaction_count: (i % 7) + 1,
  };
};
createServer((req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1:3101");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/__control") {
    if (url.searchParams.has("mode")) {
      mode = url.searchParams.get("mode")!;
      reads = 0;
      observed = [];
    }
    res.end(JSON.stringify({ reads, observed }));
    return;
  }
  const observation = { url: req.url!, headers: req.headers, body: "" };
  observed.push(observation);
  req.on("data", (chunk) => { observation.body += chunk.toString(); });
  if (url.pathname === "/get_info") {
    if (mode === "node-outage") {
      res.statusCode = 503;
      res.end("{}");
      return;
    }
    writeFileSync(
      logPath,
      mode === "node-error"
        ? `${new Date().toISOString().replace("T", " ").slice(0, 19)} [ERROR/LOG0] synthetic peer-private-marker transaction verification failed on NOTIFY_RESPONSE_GET_OBJECTS, tx_id = ${"b".repeat(64)}, dropping connection\n`
        : "",
    );
    res.end(
      JSON.stringify({
        status: "OK",
        untrusted: false,
        height: (anchor + (mode === "node-recovered" ? 2n : 1n)).toString(),
        target_height: (anchor + 5000n).toString(),
        difficulty: 63526812,
        target: 240,
        top_block_hash: makeHash(
          anchor + (mode === "node-recovered" ? 1n : 0n),
        ),
        incoming_connections_count: 0,
        outgoing_connections_count: 2,
        is_ready: false,
        offline: false,
        mainnet: mode !== "node-wrong-network",
        testnet: mode === "node-wrong-network",
        stagenet: false,
        bootstrap_daemon_address: "internal-node-address-must-not-be-exposed",
      }),
    );
    return;
  }
  reads++;
  if (mode === "outage") {
    res.statusCode = 503;
    res.end('{"error":{"code":"unavailable","message":"Unavailable"}}');
    return;
  }
  if (url.pathname.startsWith("/api/v2/raw/transaction/")) {
    const hash = url.pathname.split("/").at(-1);
    const fixture = receiveFixtures.find((item: { request: { hash?: string } }) => item.request.hash === hash);
    if (fixture) {
      const raw = mode === "receive-wrong-blob"
        ? receiveFixtures.find((item: { name: string }) => item.name === "v2-kind0").request.blob_hex
        : fixture.request.blob_hex;
      res.end(JSON.stringify({ meta: { ...examples.NetworkResponse.meta,
        network: mode === "receive-wrong-network" ? "testnet" : "mainnet" },
        data: { hash, native_json: "{}", blob_hex: raw } }));
    } else {
      res.statusCode = 404;
      res.end('{"error":{"code":"not_found","message":"Transaction not found."}}');
    }
    return;
  }
  if (url.pathname === "/api/v2/mempool") {
    const empty = ["pool-empty", "genesis"].includes(mode);
    const snapshot = makeHash(mode === "pool-mutated" ? 999n : 998n);
    const cursor = url.searchParams.get("cursor");
    if (cursor && !cursor.startsWith(snapshot + ".")) {
      res.statusCode = 409;
      res.end('{"error":{"code":"chain_changed","message":"Pool changed."}}');
      return;
    }
    const count = empty ? 0 : mode === "pool-mutated" ? 54 : 53;
    const offset = cursor ? Number(cursor.slice(65)) : 0;
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const end = Math.min(count, offset + limit);
    const items = Array.from({ length: Math.max(0, end - offset) }, (_, i) => ({
      ...examples.BlockResponse.data.transactions[0],
      hash: makeHash(1000n + BigInt(offset + i)),
      coinbase: false,
      fee_atomic: "30000000",
      local_received_timestamp_unix:
        mode === "pool-time-unknown" ? null : "1791291000",
      size_bytes: "4500",
      input_count: 2,
      output_count: 2,
      inspection: {
        ring_size_min: "25",
        ring_size_max: "25",
        payment_id_types: ["uniform"],
      },
    }));
    res.end(
      JSON.stringify({
        meta: { network: "mainnet", chain_height: (anchor + 1n).toString() },
        data: {
          items,
          transaction_count: String(count),
          size_bytes: String(count * 4500),
          fee_atomic: String(count * 30000000),
          snapshot,
          next_cursor: end < count ? snapshot + "." + end : null,
        },
      }),
    );
    return;
  }
  if (url.pathname.startsWith("/api/v2/tools/")) {
    const data = url.pathname.includes("/key-images/")
      ? {
          ...examples.KeyImageResponse.data,
          key_image: url.pathname.split("/").at(-1),
          spent: mode === "image-spent",
        }
      : url.pathname.includes("/outputs/")
        ? {
            ...examples.OutputCheckResponse.data,
            transaction_hash: url.pathname.split("/").at(-2),
            public_key: url.pathname.split("/").at(-1),
            output_indices: mode === "output-absent" ? [] : [0],
          }
        : {
            ...examples.AddressResponse.data,
            address: url.pathname.split("/").at(-1),
            ...(mode === "address-valid"
              ? {
                  valid: true,
                  network: "mainnet",
                  matches_reader: true,
                  kind: "standard",
                  spend_public_key: "a".repeat(64),
                  view_public_key: "b".repeat(64),
                }
              : {}),
          };
    res.end(JSON.stringify({ meta: examples.NetworkResponse.meta, data }));
    return;
  }
  if (url.pathname === "/api/v2/block-intervals") {
    if (mode === "genesis") {
      const result = structuredClone(examples.BlockIntervalsResponse);
      result.data.window_seconds = (
        { "1h": 3600, "24h": 86400, "7d": 604800, "30d": 2592000 } as Record<
          string,
          number
        >
      )[url.searchParams.get("window") ?? "1h"];
      res.end(JSON.stringify(result));
      return;
    }
    const window = url.searchParams.get("window") ?? "1h";
    const seconds = (
      { "1h": 3600, "24h": 86400, "7d": 604800, "30d": 2592000 } as Record<
        string,
        number
      >
    )[window];
    const tip = url.searchParams.has("anchor")
      ? BigInt(`0x${url.searchParams.get("anchor")}`)
      : mode === "advanced"
        ? anchor + 1n
        : anchor;
    const end = Number(makeBlock(tip).timestamp_unix);
    const count =
      window === "1h" &&
      ["interval-four", "interval-ten", "interval-twenty"].includes(mode)
        ? (
            {
              "interval-four": 4,
              "interval-ten": 10,
              "interval-twenty": 20,
            } as Record<string, number>
          )[mode]
        : (
            { "1h": 12, "24h": 80, "7d": 120, "30d": 180 } as Record<
              string,
              number
            >
          )[window];
    const spacing = window === "1h" && count > 15 ? 120 : 240;
    const times = Array.from(
      { length: count },
      (_, i) => end - (count - 1 - i) * spacing,
    );
    times[1] = times[0] - 30;
    const points = Array.from({ length: count }, (_, i) => {
      const height = tip - BigInt(count - 1 - i),
        time = times[i];
      const previous = i === 0 ? time - spacing : times[i - 1];
      const interval = time - previous;
      return {
        height: height.toString(),
        timestamp_unix: String(time),
        previous_timestamp_unix: String(previous),
        interval_seconds: String(interval),
      };
    });
    res.end(
      JSON.stringify({
        meta: { network: "mainnet", chain_height: (tip + 1n).toString() },
        data: {
          anchor_height: tip.toString(),
          anchor_hash: makeHash(tip),
          anchor_timestamp_unix: String(end),
          window_seconds: seconds,
          start_timestamp_unix: String(end - seconds),
          scanned_from_height: (tip - BigInt(count) + 1n).toString(),
          scanned_count: count,
          oldest_timestamp_unix: points[0].timestamp_unix,
          history_limited: mode === "interval-limited",
          points,
        },
      }),
    );
    return;
  }
  const blockId = url.pathname.match(/^\/api\/v2\/blocks\/(.+)$/)?.[1];
  const txHash = url.pathname.match(/^\/api\/v2\/transactions\/(.+)$/)?.[1];
  if (blockId || txHash) {
    if (blockId && /^[0-9a-f]{64}$/.test(blockId)) {
      const height = BigInt(`0x${blockId}`);
      if (height >= anchor - 40n && height <= anchor + 1n) {
        if (mode === "tx-outage") {
          res.statusCode = 503;
          res.end(
            '{"error":{"code":"unavailable","message":"Fixture transaction read failure"}}',
          );
          return;
        }
        const header = makeBlock(height);
        res.end(
          JSON.stringify({
            meta: {
              network: mode === "tx-mismatch" ? "testnet" : "mainnet",
              chain_height: (anchor + 2n).toString(),
            },
            data: {
              header,
              transactions: Array.from(
                { length: header.transaction_count },
                (_, i) => ({
                  ...examples.BlockResponse.data.transactions[0],
                  hash:
                    i === 0
                      ? header.coinbase_hash
                      : makeHash((height << 8n) + (1n << 96n) + BigInt(i)),
                  inspection:
                    i === 0
                      ? examples.BlockResponse.data.transactions[0].inspection
                      : {
                          ring_size_min: "25",
                          ring_size_max: "25",
                          payment_id_types: ["uniform"],
                        },
                  coinbase: i === 0,
                  fee_atomic: i === 0 ? "0" : "9007199254740993",
                }),
              ),
            },
          }),
        );
        return;
      }
    }
    if (
      blockId === "0" ||
      blockId === examples.BlockResponse.data.header.hash
    ) {
      res.end(JSON.stringify(examples.BlockResponse));
      return;
    }
    if (txHash === examples.TransactionResponse.data.hash) {
      const result = structuredClone(examples.TransactionResponse);
      if (mode === "ringct" || mode === "mempool") {
        const t = result.data;
        t.coinbase = false;
        t.coinbase_height = null;
        t.ringct_type = 1;
        t.fee_atomic = "9007199254740993";
        t.input_count = 1;
        t.inputs = [
          {
            key_image: "a".repeat(64),
            key_offsets_relative: ["9007199254740993"],
            ring_candidates: [
              {
                public_key: "b".repeat(64),
                block_height: "0",
                timestamp_unix: "0",
              },
            ],
          },
        ];
        t.outputs = Array.from({ length: 51 }, (_, index) => ({
          ...t.outputs[0],
          index,
          amount_atomic: null,
        }));
        t.output_count = t.outputs.length;
        if (mode === "mempool")
          t.inclusion = {
            state: "mempool",
            block_height: null,
            timestamp_unix: null,
            confirmations: "0",
          };
      }
      res.end(JSON.stringify(result));
      return;
    }
    res.statusCode = mode === "partial-outage" && txHash ? 503 : 404;
    res.end(
      JSON.stringify({
        error: {
          code: res.statusCode === 404 ? "not_found" : "unavailable",
          message: "Fixture lookup response",
        },
      }),
    );
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
  const tip = mode === "advanced" ? anchor + 1n : anchor;
  const meta = { network: "mainnet", chain_height: (tip + 1n).toString() };
  if (url.pathname === "/api/v2/network") {
    res.end(
      JSON.stringify({
        ...examples.NetworkResponse,
        meta,
        data: {
          ...examples.NetworkResponse.data,
          tip: makeBlock(tip),
          overview: {
            ...examples.NetworkResponse.data.overview,
            pool_transactions: mode === "pool-changed" ? "1" : "0",
            pool_size_bytes: mode === "pool-changed" ? "4500" : "0",
          },
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
    const start = url.searchParams.has("cursor") ? anchor - 20n : tip;
    const items = Array.from({ length: 20 }, (_, i) =>
      makeBlock(start - BigInt(i)),
    );
    res.end(
      JSON.stringify({
        meta,
        data: {
          items,
          anchor_height: tip.toString(),
          anchor_hash: makeHash(tip),
          next_cursor: `${tip}.${makeHash(tip)}.${start - 20n}`,
        },
      }),
    );
    return;
  }
  if (url.pathname.startsWith("/api/v2/raw/")) {
    const literal = JSON.stringify(
      '<img src="/__unexpected" onerror="window.__jsonXss=true">',
    );
    res.end(
      `{"data":{"native_json":{"exact":18446744073709551615,"literal":${literal}},"blob_hex":"00"}}`,
    );
    return;
  }
  if (url.pathname === "/api/v2/openapi.json") {
    res.end('{"openapi":"3.1.1"}');
    return;
  }
  res.end(JSON.stringify(examples.BlockResponse));
}).listen(3101, "127.0.0.1");
