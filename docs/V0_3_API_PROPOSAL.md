# v0.3.0 proposal: public API v2 and OpenAPI

Status: **approved by the user on 2026-10-04; implemented and released as v0.3.0**.
The [release](https://github.com/ucrem/ryo-blockchain-explorer/releases/tag/v0.3.0)
was published at 2026-10-04 22:27:03 UTC. Source commit
`b335672544d7d0de84175ad31e0d246e6f535ea0` passed the native Ubuntu 24.04
[build and all five tests](https://github.com/ucrem/ryo-blockchain-explorer/actions/runs/37239326835)
(25.74 seconds for CTest), plus the separate
[schema/example workflow](https://github.com/ucrem/ryo-blockchain-explorer/actions/runs/37239326900).
The user authorized the complete proposed milestone through release publication.
The preparation PR added documentation and contract checks only, preserving the
v0.2.0 runtime. The sections below record the approved scope and acceptance gates.

## Current behavior and problem

v0.2.0 provides owned native block/transaction snapshots and a separate bounded
HTTP executable. Its optional legacy endpoints retain JSend, numeric amounts,
HTTP 200 for missing/invalid lookups, and historical null/array conventions.
The transport accepts no query strings and is coupled to `LegacyJson`.

External clients and the future server-first frontend need an explicit contract:
exact integer precision, amount visibility, confirmation provenance, ordinary
HTTP errors, bounded recent-block pagination, and machine-readable documentation.
Changing the legacy serializer would break its captured compatibility contracts.

## Proposed usable scope

Add a separate v2 serializer and a concrete router in the existing process.
Reuse `QueryContext`, `BlockService`, and `TransactionService`. Add a real
`NetworkService` that reads the local chain's height/tip/difficulty in one native
read scope. Extend `BlockService` with bounded block-summary pagination; it must
not load every transaction merely to list headers. No service calls another
service while holding a read scope.

| GET path | Proposed behavior |
| --- | --- |
| `/api/v2/network` | Selected network, local LMDB chain height/tip/difficulty, native target interval, units and software versions |
| `/api/v2/blocks` | Newest-first block summaries; `limit` defaults to 10, maximum 20; optional anchored `cursor` |
| `/api/v2/blocks/{id}` | Complete block header and native transaction summaries; `id` is a canonical decimal height or a 64-character hexadecimal hash |
| `/api/v2/transactions/{hash}` | Confirmed or native-pool transaction, public keys/extra/payment IDs/inputs/outputs and ring candidates |
| `/api/v2/raw/block/{id}` | Native Ryo JSON object and native serialized block hex |
| `/api/v2/raw/transaction/{hash}` | Native Ryo JSON object and native serialized transaction hex |
| `/api/v2/openapi.json` | The checked OpenAPI contract bundled into the executable at build time |

The machine-readable [OpenAPI draft](api-v2.openapi.yaml) describes these exact
paths and DTOs. There is one `{id}` block route: OpenAPI does not allow separate
`{height}` and `{hash}` templates for the same path shape. Canonical heights are
`0` or a decimal integer without leading zeroes; hashes accept either hex case
and responses use lowercase. Invalid syntax/range returns 400; a valid identifier
absent from native storage returns 404.

This release establishes useful API v2 boundaries rather than advertising all
future groups. Mempool **listing**, search, emission, tools, SSE and Next.js are
later focused increments. Transaction lookup already covers a known pool hash;
it does not provide propagation metadata or claim pool inclusion is confirmation.
Unimplemented endpoints continue returning 404, with no fabricated successes.

## Public data and error contracts

- Success is `{data, meta}`. Metadata names the selected network and the native
  chain height sampled by that query. Independent requests need not share a tip.
- Unsigned 64-bit quantities, amounts, sizes, heights, confirmations, timestamps,
  difficulty and unlock values are **canonical decimal strings**. Small protocol
  versions, array indices and bounded counts are JSON integers. Clients must
  parse strings with an exact integer type, never floating-point money arithmetic.
- Ryo's pinned native configuration sets `CRYPTONOTE_DISPLAY_DECIMAL_POINT` to
  **9**: one RYO is `1000000000` atomic units. Native fee/amount logic is reused.
  Hidden RingCT output amounts are `null`, not zero. Public input amount buckets
  are not presented as the actual hidden amount spent.
- Pool transactions have `state: mempool`, zero confirmations, and `null` chain
  height/timestamp. Confirmed transactions use their actual block timestamp;
  confirmations include their own block (`chain_height - block_height`).
- Ring candidates are public alternatives. No candidate is labelled the real
  spend. Empty candidate results mean unavailable under the current snapshot.
  Extra/additional keys/payment IDs remain native-derived; absence is `null`.
- Errors are `{error: {code, message}}`. HTTP 400 covers invalid input; 404 covers
  absent/unsupported routes; 405 covers methods; 409 covers a replaced pagination
  anchor or inconsistent chain snapshot; 503 covers DB/capacity/resource/serialization
  failures. Public messages do not echo requests, keys or native exceptions.
- Raw objects remain native Ryo JSON, with its original number/field conventions;
  this is explicitly outside the decimal-string DTO guarantee. The accompanying
  hex is native serialization, not reconstructed JSON or new cryptography.

## Pagination and reorganization semantics

The first page anchors at the current tip. An opaque-to-clients cursor encodes
`anchor-height.anchor-hash.next-height` using unreserved ASCII, bounded to 106
characters. Each page validates the anchor's native hash, then reads at most 20
block summaries in one consistent read scope. New blocks above the anchor do not
move existing pages. A removed/replaced anchor returns 409 `chain_changed`;
clients restart without a cursor. There is no retained snapshot, cache, database
index or full-chain scan between requests. Exhaustion returns `next_cursor: null`.
Malformed/overflow/out-of-range cursor components return 400.

## Affected components and bounded input handling

| Component | Change |
| --- | --- |
| `src/services/NetworkService.{h,cpp}` | Real native chain snapshot and difficulty, owned result, no monitor threads |
| `src/services/BlockService.{h,cpp}` | Header summaries and anchored pagination inside one read scope |
| Existing transaction metadata/service | Preserve native interpretation; narrowly extend owned metadata only if required by documented fields |
| `api/ApiResponse.h`, `api/ApiRouter.{h,cpp}` | Shared response value and concrete legacy/v2/health routing |
| `api/ApiV2.{h,cpp}` | Exact v2 serialization, parameter parsing and error mapping |
| `api/HttpServer.*`, `app/main.cpp` | Route through the router; route-aware transport errors; explicitly enable v2 |
| `CMakeLists.txt`, generated build header | Compile the real targets and bundle the validated specification without runtime file/CDN dependencies |
| Native and HTTP contract tests, schema checks, CI | Real fixture comparisons, pagination transitions, schema/status/resource/privacy regressions |
| API/server/architecture/privacy/testing/build docs and changelog | Implemented support, upgrade guidance, evidence and release limitations |

Add `--enable-api-v2`, independent of the existing `--enable-json-api` flag.
Both remain off by default; health remains available. The HTTP executable still
requires the existing opt-in build flag. C++14, the core pin, read-only LMDB,
network startup validation, loopback defaults and native consumers remain intact.

Transport accepts a query string only for enabled `/api/v2/blocks`, with exactly
`limit` and/or `cursor`. Reject duplicate/unknown/empty parameters, percent escapes,
fragments, non-ASCII bytes and bodies. Other v2 and legacy paths still reject
query strings. Never treat private-key parameters as supported input. Transport
errors for recognizable v2 paths use the v2 error shape even when v2 is disabled.
Keep the current connection/worker/header/target/deadline bounds and the 8 MiB
serialized-response cap. Bound the native raw blob before hex expansion; limit
reached means 503 rather than partial/truncated success.

## Compatibility and migration risk

This is an additive opt-in API. Existing v0.2 legacy success/failure fixtures,
null conventions, enabled/disabled behavior and query rejection remain tests.
Only product-version metadata advances with the release. The legacy packed
API version remains distinct. Operators enable v2 explicitly; they can enable
both adapters without changing deployment topology or adding a daemon RPC URL.

Native scopes protect each response; they do not make separately queried endpoint
results one snapshot or prove daemon synchronization. `/network` explicitly
reports **this reader's chain**, not total network peers, node propagation,
daemon synchronization, or independently verified chain consensus. Empty/native
failure cases need explicit tests before publication.

Main risks are precision regressions, accidentally revealing hidden amounts or
node-local times, native serialization growth, off-by-one/genesis pagination,
anchor validation across tip append/replacement, and format/tooling drift. Raw
JSON remains available for low-level historical structures not normalized into
DTOs. Current fixture gaps (full-chain capacity, live mapping growth, historical
coverage and isolated testnet/stagenet) remain documented release limitations.

## Validation and release acceptance

1. Validate the OpenAPI document, all local references, schema shapes and examples;
   check large exact amounts and nullable hidden outputs against real fixtures.
   Preparation checks do not claim any endpoint already exists.
2. Native tests cover genesis/header metadata, historical version-2 coinbase and
   ordinary version-3/RingCT transactions, confirmed/pool provenance, exact fee
   and output amounts, extra/payment IDs/keys, raw hash/round-trips and DB failures.
3. On the disposable native writable fixture, paginate genesis and historical
   block 1 with limit 1; append above an anchor; pop/replace its tip and require
   chain_changed; reject malformed and overflowing cursors. Preserve owned results.
4. HTTP tests validate actual responses against the bundled OpenAPI DTOs, plus
   enabled/disabled flag combinations, hash/height equivalence, all listed routes,
   status mappings, parameter rejection, resource bounds and concurrent shutdown.
5. All legacy/native v0.2 checks continue passing. No public-chain submission or
   private-wallet fixtures are needed. Record bounded native list/serialization
   diagnostics without claiming production throughput or justifying new storage.
6. Pass native Ubuntu 24.04 CI on the exact release implementation. Update docs,
   changelog and upgrade notes; publish annotated `v0.3.0` and a real GitHub Release
   only after the approved scope is implemented and validated.

## References and approval boundary

Native sources: pinned Ryo core
`185dd1fa33ba88c88bb22df9069ad368c0f9a27e`, especially
`src/cryptonote_config.h`, the native BlockchainDB API and serialization helpers;
the selected services and [fixture provenance](../tests/fixtures/README.md).
The contract targets [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html), using
JSON Schema 2020-12-compatible DTOs. This stable tooling choice does not imply it
is the newest OpenAPI revision.

The original request states: **"wait for approval before implementing if the
change materially alters architecture or behavior"**. The previous approval
covered v0.2's service/legacy HTTP scope. This proposal adds public contracts,
query parsing and a new native snapshot/list operation. The user approved the
concrete v0.3 scope on 2026-10-04 and instructed completion through publication.
Documentation and non-invasive contract checks preceded approval; implementation,
validation and the resulting v0.3.0 release are now authorized without per-command
prompts. This proposal remains the scope reference, with [API_V2.md](API_V2.md)
describing the final behavior.
