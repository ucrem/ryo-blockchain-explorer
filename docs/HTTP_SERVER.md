# Native services and read-only HTTP server

The executable is an opt-in, usable read-only API subset. It does not include the
old website, HTML templates, browser assets, or frontend. The remaining legacy
inventory is a migration reference, not a claim of complete endpoint parity.

## Build and run

Use the pinned core and Ubuntu 24.04 dependencies from [BUILD.md](BUILD.md):

```bash
RYO_BUILD_HTTP=ON bash scripts/build-baseline.sh .deps/ryo-core build/native 2
build/native/ryo_explorer_http --bc-path /path/to/ryo/lmdb02 \
  --bind-ip 127.0.0.1 --port 8081 --enable-json-api
curl http://127.0.0.1:8081/health
curl http://127.0.0.1:8081/api/block/0
```

The server never creates or synchronizes a blockchain. Supply an existing database
and select `--testnet` or `--stagenet` when applicable; the flags are mutually
exclusive. Startup checks the actual genesis against native Ryo configuration.
`--bc-path`, `--port`, and `--enable-json-api` preserve relevant legacy spellings.
The default bind is loopback, port 8081. No daemon URL is needed for these routes:
confirmed and pool objects come from native LMDB. Use `--help` for supported flags.

The HTTP application opens `DBF_RDONLY` through Ryo's DB API. Native LMDB readers
remain registered; it does not request `MDB_NOLOCK`. The process needs permission
to participate in the database's LMDB lock file, while chain data remains read-only.
Use the same database identity/path as its daemon, retain a compatible core pin,
and do not replace or remove live database files. Deployment/TLS packaging and
production capacity validation remain later work.

## Implemented routes

| GET route | Behavior |
| --- | --- |
| `/health` | Real native DB check, chain height, selected network, product version |
| `/api/block/{height-or-hash}` | Native block metadata and coinbase/transaction summaries |
| `/api/rawblock/{height-or-hash}` | Native Ryo JSON object, not a hexadecimal blob |
| `/api/transaction/{hash}` | Confirmed/native-pool lookup, metadata, outputs, ring candidates |
| `/api/rawtransaction/{hash}` | Native Ryo transaction JSON object |
| `/api/version` | Legacy packed API version 65537, source/core version fields, chain height |

The legacy routes above require `--enable-json-api`; `/health` is always available.
v0.3 adds independently enabled `/api/v2/` routes with `--enable-api-v2`:
native-reader network state, bounded block pagination, block/transaction detail,
raw JSON/hex and bundled OpenAPI. See [API_V2.md](API_V2.md) for the exact contract.
Both flags default to off and can be enabled together. Unknown, disabled and
unimplemented routes return 404. Dashboard, mempool listing, search, emission
API, tools and transaction submission remain future work.

## Compatibility and deliberate differences

Supported successful block/transaction/raw response fields, native integer atomic
units, UTC format, JSend envelope, and legacy null/array conventions are preserved.
Existing public genesis captures are compared directly after normalizing only
height/confirmations to the disposable chain. The legacy `mixin` field retains
its existing ring-size meaning. Hidden RingCT amount zeroes retain the legacy
numeric convention; native metadata explicitly marks amount visibility.

Malformed/missing block or transaction queries retain HTTP 200 with JSend
`status: fail`; clients must inspect the body. Transient database, chain-consistency,
serialization, and resource failures use HTTP 503 with `status: error` rather
than becoming an uncaught server failure. Error text is concise and does not
expose native exception details. HTTP methods other than GET return 405; bodies,
oversized headers/targets, and legacy query/fragment/encoded targets are rejected.
Only enabled v2 block pagination accepts its bounded `limit`/`cursor` parameters;
other v2 queries and private-key parameters remain rejected. V2 transport errors
use its own documented error envelope. Existing legacy error shapes remain.

Pool lookup preserves native object/hash provenance and zero confirmations.
Unlike the old explorer, **node-local receive/relay times are not exposed**:
pool `timestamp`/`block_height` are zero and `timestamp_utc` is the epoch string.
This privacy change is explicit; zero is not a claim of a chain inclusion time.
There is no new public propagation metadata, peer list, private-key input, or
key-bearing URL. `Cache-Control: no-store` applies to responses. Wildcard CORS
from the old server is not enabled in this initial subset.

## Architecture, bounds, and limits

`TransactionMetadata` reuses native Ryo hashes, fees, serialization, extra/payment
IDs, public/additional keys, RingCT and input/output summaries. `BlockService`
and `TransactionService` return owned native results. A shared `QueryContext`
serializes query sections and brackets each one with the actual Ryo read
transaction API. Services do not nest read scopes or call each other while one
is held. Results remain valid after the read transaction ends or a tip changes.

`LegacyJson` owns field names, JSend, raw-object JSON, and UTC presentation.
`ApiV2` owns the independent v2 DTOs and error mapping; `ApiRouter` dispatches
both adapters. `NetworkService` reads native chain state and `BlockService::list`
provides bounded anchored headers without loading all ordinary transactions.
Boost.Beast/Asio owns transport in a separate executable. There is one process,
one application-owned native reader, one I/O loop, and two fixed query workers.
No legacy pool/network/emission monitor or application cache is started.
Native Blockchain initialization retains its own internal worker, which is
stopped through native `deinit` during teardown.

Limits: 64 active connections, 64 pending queries, 4 KiB request headers,
1 KiB targets, no request body, 8 MiB block/serialized response limit, five-second
socket read/write deadlines, and ten-second connection lifetime. Each connection
handles one request and closes. Query slots remain counted until completion even
when a client disconnects, preventing an unbounded queue of expired requests.
SIGINT/SIGTERM stops acceptance, closes clients, and joins native/query workers.
Native DB calls themselves are not forcibly interrupted by socket deadlines.
The pinned core compatibility patch skips sync for a read-only environment;
native shutdown otherwise attempted to flush it and failed with a permission error.

Tests cover public native genesis and RingCT blobs, historical coinbase, isolated
pool/confirmation/reorg storage transitions, result ownership, native errors,
concurrent reads, live daemon/offline HTTP contracts, bounds, slow clients,
configuration, and shutdown. See [TESTING.md](TESTING.md). This does not establish
full-chain capacity, mapping-growth recovery, comprehensive historical/ring
coverage, testnet/stagenet fixture coverage, consensus validity of synthetic
storage transitions, or production readiness. No new database or index is justified.

OpenAPI/API v2 is implemented in v0.3.0; Next.js remains the v0.4.0 milestone.
