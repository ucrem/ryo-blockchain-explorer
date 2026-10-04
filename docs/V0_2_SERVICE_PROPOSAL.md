# v0.2.0 proposal: native services and a separate read-only HTTP adapter

Status: **proposed; architectural implementation awaits user approval**.
Reference baseline: v0.1.0 / `afe5a8e`. Source changes in this preparation branch
add optional read-only diagnostics and testing support only.

## Current implementation and problem

The public project contains selected native C++ implementations compiled into
`ryo_explorer_core`. `MicroCore` owns native Blockchain/tx-pool objects and opens
Ryo LMDB read-only with `MDB_NOLOCK`. Utilities provide existing Ryo metadata,
address/extra/payment-ID/ring/key-image helpers. RPC, pool/network snapshots, and
emission code are imported but retain legacy defaults and global worker state.
There is no HTTP application, public API, renderer, or frontend in this baseline.

The upstream reference still couples block/transaction metadata and JSON contracts
to a 6,745-line `page.h`. Copying that file would bring the old website back into
the project. A service boundary must import the actual native calculations while
keeping their results independent of HTTP, JSON envelopes, and HTML.

## Proposed scope and sequence

Implement this in short, reviewable changes rather than a whole-portal rewrite:

1. Extract real transaction metadata from upstream `get_tx_details` and
   `get_tx_json`, using existing native Ryo functions for serialization, hashes,
   fees, extra/public keys, payment IDs, RingCT, and input/output/ring summaries.
   Return owned native values with integer atomic units and explicit amount
   visibility. Preserve all underlying native transaction data.
2. Implement concrete `BlockService` and `TransactionService` around the selected
   MicroCore/native DB operations. Resolve block height/hash, coinbase and other
   transactions, block metadata, confirmations, and native raw objects. Define
   explicit missing/invalid/database/chain-change results. Return values rather
   than references into temporary transactions or mutable caches.
3. Implement a small JSON compatibility adapter for supported read-only legacy
   block/transaction contracts. It consumes service results and owns field names,
   JSend envelopes, UTC strings, HTTP mappings, and null/array compatibility.
   Services do not construct HTML or public HTTP responses.
4. Add a separate C++ HTTP executable using Boost.Beast/Asio from the already
   required Ubuntu Boost package. It owns startup, routing, bounded HTTP parsing,
   connection lifecycle, and shutdown. A single process owns its LMDB reader and
   services; there is no new microservice deployment or external database.

The initial reviewed slice is steps 1–2, protected by native tests. Steps 3–4
follow as a separate reviewed change within the same documented v0.2.0 scope.
Approval of this proposal covers these boundaries; broader endpoint groups or
changes to emission accounting, crypto, worker semantics, or storage require
their own focused proposal.

## Responsibility and affected files

| Component / proposed files | Concrete responsibility |
| --- | --- |
| Existing `src/MicroCore.*`, `src/tools.*`, `src/monero_headers.h` | Preserve native DB/crypto access; only narrowly demonstrated fixes if needed |
| `src/services/TransactionMetadata.{h,cpp}` | Real imported transaction calculations, typed native values, no HTTP/HTML |
| `src/services/BlockService.{h,cpp}` | Height/hash lookup and a consistent block/transaction snapshot |
| `src/services/TransactionService.{h,cpp}` | Confirmed/native pool lookup and metadata/raw data with explicit provenance |
| `api/LegacyJson.{h,cpp}` | Compatibility serialization and JSend errors for implemented routes |
| `api/HttpServer.{h,cpp}`, `app/main.cpp` | HTTP transport and real executable startup/configuration/shutdown |
| `CMakeLists.txt`, build helpers, CI | Compile real service/API targets and their tests; no placeholder directories |
| Native/contract integration tests and fixture provenance | Protect hashes, metadata, raw objects, limits, and reorg behavior |
| Architecture/API/build/testing/changelog documentation | Describe implemented behavior, supported subset, and validation limits |

Services take an explicitly initialized MicroCore owned by the application.
Introduce only the concrete lifetime/read-scope code necessary to keep native
access valid. Do not add generic storage providers, consensus abstractions,
service interfaces with no implementation, or independent emission formulas.

## HTTP and compatibility boundary

The first HTTP slice targets GET `/api/block/{height-or-hash}`,
`/api/rawblock/{height-or-hash}`, `/api/transaction/{hash}`,
`/api/rawtransaction/{hash}`, and `/api/version`, plus a minimal `/health` endpoint.
Legacy field names, integer/string/null types, JSend envelopes, and the meaning
of raw JSON are protected by the existing public captures. Product SemVer and
the legacy packed API version remain distinct. Core results do not call hidden
amounts known zero; the legacy serializer can retain legacy numeric conventions
with their documented meaning.

Transaction lookup must preserve confirmed-versus-pool provenance. Native pool
blob lookup and failure behavior need isolated tests before the legacy transaction
endpoint is called compatible. No unsupported endpoint may return a fabricated
empty success response. Publish an explicit supported-route table; this server
is an incremental compatibility implementation, not a complete replacement for
an existing production explorer.

Use explicit LMDB/network configuration, mutually exclusive testnet/stagenet
selection, loopback binding by default, and the documented legacy CLI spellings
where applicable. JSON routes remain explicitly enabled. Missing/unreadable or
wrong-network databases fail startup. This scope exposes no transaction push,
private view/transaction-key input, wallet export upload, pool propagation
metadata, or peer addresses. Native helpers remain available internally.

OpenAPI and the public `/api/v2/` contract belong to v0.3.0. Next.js belongs to
v0.4.0. The removed Crow/mstch website, templates, browser crypto, and images are
not re-imported. There is no PostgreSQL/Redis/queue, speculative PoS, or new cache.

## Read consistency, migration risks, and safeguards

- **Native transactions/reorgs:** the installed Ryo DB exposes
  `block_txn_start(bool readonly)`, `block_txn_stop`, and `block_txn_abort`.
  Verify their LMDB thread/nesting semantics before using a native read scope;
  keep related block/transaction reads consistent and copy results before ending
  the scope. A shared application guard may initially serialize native query
  sections. It cannot coordinate with an external daemon or fix `MDB_NOLOCK` by
  itself. Detect mapping/DB/chain changes and return bounded failures, not stale
  objects or indefinite retries.
- **Lifetime/concurrency:** the application outlives its services; request results
  own their data. Test concurrent reads, shutdown, and mapping/error paths before
  claiming live-daemon or production concurrency readiness. Legacy cache locks
  and mutable worker references are not imported into the service boundary.
- **Historical interpretation:** keep native Ryo versions, RingCT types, extra,
  payment IDs, subaddresses/additional keys, and historical ring sizes. Preserve
  per-source attribution for extracted code. JSON captures do not substitute
  for native blob/signature or secret-key decoding fixtures.
- **Input/resource bounds:** GET-only public reads, bounded request target/headers,
  body rejection, socket deadlines, bounded connections/workers, and clean signal
  shutdown. Beast supplies protocol parsing primitives; the application must
  implement these limits. No per-connection detached thread growth.
- **Scope/upgrade:** v0.1.0 native consumers continue to build. v0.2.0 adds concrete
  services and an opt-in read-only executable. Existing explorer operators keep
  their current deployments until their required endpoints are implemented and
  validated. Do not advertise missing pages/tools or full legacy parity.

## Validation and release acceptance

1. Existing native genesis and offline LMDB/RPC/emission tests continue passing.
2. Compare service metadata and raw objects with the known genesis fixtures;
   test height/hash lookup, upper bounds, malformed/missing hashes, coinbase,
   confirmations, extra, output keys, and atomically represented amounts.
3. Obtain a real ordinary version-3/RingCT native blob with recorded public hash,
   parse/round-trip it through Ryo, and test extracted metadata. Keep capture-only
   fixture gaps explicit; do not claim historical completeness from genesis.
4. Exercise native pool add/remove/confirm/failure semantics on a disposable
   isolated chain before exposing pool fallback as compatible. Never submit to
   public mainnet or use real private keys/wallet files for testing.
5. Exercise DB read-scope lifetimes and reorg/mapping/error behavior on an isolated
   writable test DB with recorded valid public block fixtures. Synthetic state
   transitions test reader consistency, not consensus or PoW validation.
6. Run HTTP contract tests for enabled/disabled routes, legacy success/fail/raw
   response shapes, input limits, health/startup, concurrent reads, and shutdown.
7. Measure the implemented queries and serialization/HTTP overhead. The optional
   native genesis diagnostic is a starting reference, not representative mainnet
   throughput or justification for an index/database.
   See [the measured baseline and missing scenarios](NATIVE_QUERY_BASELINE.md).
8. Native Ubuntu 24.04 CI passes the actual release source. Update build, supported
   routes, privacy, tests, changelog, and upgrade notes. Publish v0.2.0 as both an
   annotated tag and real GitHub Release only after its stated scope is complete.

## Sources and approval requirement

Native source: the selected v0.1.0 components and official explorer
`2e334724f9921e813e787b09f9365d53020a6286`, particularly upstream `json_block`,
`json_rawblock`, `json_transaction`, `json_rawtransaction`, `get_tx_details`, and
`get_tx_json`. See [the legacy API inventory](API_LEGACY.md) and
[import boundaries](IMPORT_SCOPE.md).

Boost.Beast is a header-only HTTP/1 foundation using Boost.Asio, rather than a
ready-made server. The Boost 1.83 package is already present in the reference
environment; no additional HTTP library needs vendoring. See
[Boost 1.83 Beast introduction](https://www.boost.org/doc/libs/1_83_0/libs/beast/doc/html/beast/introduction.html).

The initial user request explicitly requires: **"wait for approval before
implementing if the change materially alters architecture or behavior"**.
This proposal introduces the service/HTTP boundary, so implementation waits for
approval of this concrete scope. Optional diagnostics, testing support, and
proposal documentation do not implement that architecture.
