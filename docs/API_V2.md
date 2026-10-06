# API v2

v0.4 retains the v0.3 route shapes and existing DTO fields while advancing product
metadata to 0.4.0. The new [web application](WEB.md) consumes this read-only API;
legacy clients and direct native API consumers remain supported.

v0.3.0 adds an explicitly enabled, read-only API for external clients and the
future frontend. Native Ryo/LMDB remains authoritative. The
[OpenAPI 3.1.1 contract](api-v2.openapi.yaml) describes the shipped subset, and
[public examples](api-v2.examples.json) illustrate the DTOs. Unsupported future
groups return 404.

## Enable and inspect

Build with the pinned core and [HTTP development dependencies](BUILD.md):

```bash
RYO_BUILD_HTTP=ON bash scripts/build-baseline.sh .deps/ryo-core build/native 2
build/native/ryo_explorer_http --bc-path /path/to/ryo/lmdb02 --enable-api-v2
curl http://127.0.0.1:8081/api/v2/network
curl 'http://127.0.0.1:8081/api/v2/blocks?limit=10'
curl http://127.0.0.1:8081/api/v2/blocks/0
curl http://127.0.0.1:8081/api/v2/openapi.json
```

Add `--enable-json-api` to serve the existing legacy subset alongside v2.
The two flags are independent, off by default. `/health` remains available.
Existing network selection/genesis validation, loopback defaults, LMDB identity
and lock-file access requirements apply. A daemon RPC URL is not required.
OpenAPI is bundled at build time; deployment does not require YAML files,
Python, external documentation assets or a runtime CDN.

| GET route | Result |
| --- | --- |
| `/api/v2/network` | This reader's chain height/tip/difficulty, optional native overview aggregates, configured units/target, explorer and linked core versions |
| `/api/v2/block-intervals?window=1h&anchor=...` | Exact consecutive timestamp differences for 1h, 24h, 7d or 30d ending at a native block; up to 50,000 timestamp reads |
| `/api/v2/blocks?limit=10&cursor=...` | At most 20 newest-first block summaries anchored to a validated native tip |
| `/api/v2/blocks/{id}` | Native header and coinbase-first transaction summaries |
| `/api/v2/mempool?limit=50&cursor=...` | Relayable local pool summaries, aggregate fees/size and membership-bound pagination |
| `/api/v2/tools/key-images/{image}` | Confirmed-chain public key-image membership |
| `/api/v2/tools/outputs/{transaction}/{key}` | Public output-key membership in an identified transaction |
| `/api/v2/tools/addresses/{address}` | Native public address checksum, format, network and public keys |
| `/api/v2/transactions/{hash}` | Confirmed or native-pool public metadata, extra/keys/payment IDs, inputs/outputs and ring candidates |
| `/api/v2/raw/block/{id}` | Native Ryo JSON and native serialized block hex |
| `/api/v2/raw/transaction/{hash}` | Native Ryo JSON and native serialized transaction hex |
| `/api/v2/openapi.json` | Bundled OpenAPI document without the success envelope |

Block `id` accepts a canonical decimal uint64 height or exactly 64 hex characters.
Use `0`, not `00`; hashes accept either case and responses use lowercase.
Transaction identifiers require 64 hex characters. A valid missing height/hash
returns 404; malformed/overflowing identifiers return 400. OpenAPI has one block
path template because height/hash are alternative identifiers for the same route.

## Precision, units and provenance

Success is `{data, meta}`. `meta.network` identifies the configured chain;
`meta.chain_height` is its native height sampled by that request, with genesis
at block height `0` and a genesis-only chain height of `1`. Related reads use
one native scope; separate HTTP requests are not one shared snapshot.

Unsigned 64-bit amounts, heights, sizes, timestamps, confirmations, difficulty
and unlock values are canonical decimal **strings**, including zero. Small
protocol versions, nonce, indices and bounded counts are JSON integers. The
schema bounds decimal strings to 20 digits; the application enforces uint64
range. Parse these strings using an exact integer representation. Never convert
money into floating point for accounting.

The pinned Ryo configuration uses **9 decimals**: one RYO is `1000000000` atomic
units. Fields ending in `_atomic` contain atomic units; `_bytes` contains bytes;
`timestamp_unix` contains seconds since Unix epoch. Block `size_bytes` is the
native DB block-size value, including transaction blobs, rather than the length
of the serialized block container. `transaction_count` includes coinbase;
`input_count` counts spend inputs and excludes the coinbase generation input.
Native unlock time can mean height or Unix time according to Ryo rules.

Hidden RingCT outputs have `amount_atomic: null`. A known public zero remains
`"0"`; the API does not turn hidden amounts into known zeroes. Native input
amount buckets are not described as the amount actually spent. Payment-ID
absence is `null`; a present all-zero ID remains its hex bytes. `payment_id8`
contains encrypted bytes, not decrypted recipient information. Extra and
additional public keys are preserved using native Ryo helpers. Raw native objects
retain the historical structures beyond the normalized DTO subset.

Confirmed transaction inclusion contains its block height/timestamp and
`chain_height - block_height` confirmations, including its own block. A known
pool transaction has `state: mempool`, `confirmations: "0"` and `null` chain
height/timestamp. Pool storage membership does not imply confirmation or
consensus validation. Transaction details omit node-local receive/relay time,
peer/source information, private-key input, address balance/history inference
and transaction push. The separately authorized local receive timestamp is
limited to pool-list rows, as documented below. Ring candidates remain
alternatives; none is identified as the real spent output. An empty candidate array means unavailable in the queried snapshot.

`/network` reports the native reader's chain, not daemon synchronization,
network-wide peer counts or independently verified consensus. Its target
interval and currency units come from the pinned native configuration; tip
difficulty comes from LMDB. Software fields distinguish explorer and linked
Ryo core versions, rather than claiming the version of a separate daemon.

## Native network overview

The optional `data.overview` object is an additive v0.4 extension:

| Field | Definition |
| --- | --- |
| `issued_atomic` | Native already-generated counter plus eligible native dev-fund issuance through the tip, excluding fees. Null when the counter's accounting cap prevents a complete total. |
| `tip_coinbase_atomic` | Sum of the tip coinbase's public outputs, including fees and any dev-fund payout; not subsidy alone. |
| `median_block_size_bytes` | Native median of the last up to 100 DB block sizes, including the tip. |
| `median_sample_blocks` | Actual sample count, 1–100. |
| `confirmed_transactions` | Native confirmed transaction count minus one coinbase per block. |
| `pool_transactions` / `pool_size_bytes` | Local pool count and serialized size, excluding entries marked `do_not_relay`. Both null when the bounded aggregate is incomplete. |

All quantities except the small sample count are decimal strings. One native
read scope supplies these fields and the tip. Dev-fund issuance uses the
pinned core's `get_dev_fund_amount` and stored hard-fork metadata, with at most
the native configured payout slots; it introduces no full-chain emission scan.
Pool aggregation first bounds total membership to 10,000 entries and preserves
unknown metrics as null. Public issuance does not establish spendable circulating
supply; local pool membership is not a network-wide pending count.

The new frontend accepts older responses without `overview`, showing unavailable
aggregates. Existing fields and legacy responses are unchanged. Clients using
an old closed OpenAPI validator must update its schema to permit the added
optional object. Optional website daemon status is separate from this native
DTO and does not change `/network` into a daemon RPC proxy.

## Transaction inspection, mempool and public tools

Optional `inspection` on transaction summaries adds nullable decimal-string
`ring_size_min` and `ring_size_max`, computed from each native spend input's
relative offset count. Coinbase has no ring and uses null. `payment_id_types`
is an array of native extra-presence markers: `legacy`, `encrypted`, `uniform`.
An empty array means no detected ID; an omitted object means unsupported
metadata. Neither short encrypted nor uniform payloads are decrypted. Old
fields and legacy serialization remain unchanged; closed-schema clients must
update their contracts.

`GET /mempool` defaults to 50 summaries, with canonical `limit` 1–100 and optional
`cursor`. One native scope reads at most 10,000 pool metadata entries, excludes
`do_not_relay` and loads only the selected page's transaction blobs (each bounded
to 4 MiB). Native bytes must match hash, size and fee metadata. Hash sorting and
native `cn_fast_hash` over concatenated lowercase hashes form the membership
`snapshot`. Cursors contain `snapshot.offset`, at most 70 characters; offset is
canonical 1–10,000. Membership changes return 409 and require restarting. No
persistent snapshot is stored. The owner-authorized optional pool-row field
`local_received_timestamp_unix` reports this node's native `receive_time` as a
decimal string; zero/missing native time is null and older servers may omit it.
It is separate from block inclusion, transaction creation and network-wide
first-seen time. Relay/peer/source records stay excluded.
The response includes `items`, decimal-string `transaction_count`, `size_bytes`,
aggregate `fee_atomic`, `snapshot` and nullable `next_cursor`. Following cursors
to null traverses the entire relayable pool within the bound; larger/inconsistent
snapshots return 503, not partial success. Separate pages can have different
reader heights while membership remains unchanged.

Public tool paths accept exactly the documented public identifiers and no query
parameters. Key-image checks return `spent` and `scope: confirmed_chain` from
the native LMDB index; a negative result is not spendability or pending-pool
proof. Output checks parse an exact transaction hash/public key, return native
point-encoding `curve_valid`, matching output indices and inclusion state;
missing transactions return 404, missing keys within a found transaction return
an empty list. Membership does not prove recipient ownership. Address inspection
accepts bounded Base58 text and uses native decoding for all three networks.
Invalid native checksum/format returns `valid: false` and null metadata; valid
addresses report their actual network and `matches_reader`. Public address keys
and integrated ID are not wallet balances or private verification results.

## Pagination and errors

`limit` defaults to 10 and accepts canonical integers 1–20. The initial page
anchors at its current tip. Follow `data.next_cursor` unchanged until it is
`null`. The cursor contains anchor height/hash and the next descending height,
bounded to 106 unreserved ASCII characters. At most 20 native block headers
are read per request, without loading every ordinary transaction.

Every subsequent page checks that the anchor is still in the native chain.
Appended blocks above it do not shift the traversal. A removed/replaced anchor
returns 409 `chain_changed`; restart without a cursor. Requests retain no LMDB
snapshot, cache or auxiliary index between pages. Genesis exhausts pagination
without unsigned underflow. Cursor components are validated before native access.

Errors are `{error: {code, message}}` with concise, non-echoing messages:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | Malformed identifiers/parameters/targets, request body or oversized headers |
| 404 | `not_found` | Valid resource absent, disabled v2, or unsupported route |
| 405 | `method_not_allowed` | GET required; response includes `Allow: GET` |
| 409 | `chain_changed` | Replaced/removed anchor or inconsistent native snapshot |
| 503 | `unavailable` | DB, query-capacity, serialization or resource failure |

Only `/api/v2/blocks`, `/api/v2/mempool` and `/api/v2/block-intervals`
accept their documented query parameters, and only when enabled. Duplicate,
unknown, empty, noncanonical, percent-encoded or fragment-bearing parameters are
rejected. V2 targets reject non-ASCII bytes; legacy query rejection remains.
Bodies are rejected even for GET. Recognizable v2 transport errors use the v2
shape; parser failures before a recognizable target can close the connection.
Existing limits remain: 64 connections/queries, 4 KiB headers, 1 KiB targets,
5-second read/write deadlines, 10-second connection lifetime and 8 MiB serialized
response cap. Native raw blobs are bounded to 4 MiB before hex expansion; the
full JSON-plus-hex response can reach the outer cap earlier and returns 503.
Limits are resource bounds, not statements about maximum consensus-valid sizes.

Raw `native_json` deliberately preserves Ryo's original fields and JSON numbers,
outside the decimal-string DTO guarantee. Use an integer-preserving JSON parser
when consuming it. `blob_hex` is native serialization, never reconstructed
from JSON. Oversized responses fail as a whole; no partial success is returned.
All responses use `Cache-Control: no-store`; no wildcard CORS is enabled.

## Block interval windows (v0.4)

`window` accepts exactly `1h`, `24h`, `7d` or `30d`, defaulting to `1h`.
`anchor` optionally selects a native block hash; otherwise the current reader tip
is used. A missing/removed anchor returns 409. Periods end at the anchor timestamp
rather than wall-clock time, so an incomplete sync can inspect its actual history.
The response includes the anchor, selected duration/start, searched height range,
oldest scanned timestamp, count and `history_limited`, plus ascending-height points.

Each point carries decimal-string `height`, `timestamp_unix`,
`previous_timestamp_unix` and signed `interval_seconds`. The last field is exactly
`timestamp(N) - timestamp(N-1)`, including negatives and zero; its magnitude is
bounded to uint64. A point is included when the newer timestamp is within the
inclusive period and both timestamps are nonzero. The predecessor can fall before
the period boundary. Genesis/missing times are omitted, not interpreted as 1970.

One native read scope scans at most 50,000 consecutive block timestamps plus the
first predecessor, without decoding ordinary transactions. The height range is
scanned in full, because timestamp ordering is not guaranteed. No time index,
timestamp binary search, approximate target-based block counts or sampled points
are substituted for actual timestamps. Coverage is limited to the returned height
range; `history_limited` flags a scan boundary whose oldest recorded timestamp
still lies within the selected period. It does not prove global timestamp ordering
or network synchronization. Existing eight-MiB response and capacity bounds apply.

## Compatibility and validation limits

Supported legacy success/failure/null/raw contracts remain tested. V2 error
statuses and nullable/decimal types apply only to the new namespace. Health's
product version advances; the legacy packed API version remains 65537.
There is no old website, Next.js frontend, pool listing, search, emission API,
tools or SSE in v0.3.0.

Native fixture tests protect exact genesis and version-3/RingCT metadata,
historical coinbase, native raw bytes, pool/confirmation transitions, synthetic
public ring references, payment-ID presence/additional keys, anchored append/
pop/replacement and closed-DB errors. Their actual responses are checked against
the DTO schemas. HTTP tests cover all paths, the bundled spec, independent flags,
legacy compatibility, parameter/status/transport behavior, concurrent reads and
shutdown. See [TESTING.md](TESTING.md) and [fixture provenance](../tests/fixtures/README.md).

Synthetic storage transitions and extra/ring cases test interpretation/storage,
not signature, PoW or consensus validity. Full-chain capacity, live mapping
growth, external-writer stress, broad historical coverage and positive testnet/
stagenet fixtures remain follow-up work. Genesis diagnostics do not justify a
new database/index or a production readiness claim.
