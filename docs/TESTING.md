# Native foundation testing

The active project contains imported C++ implementations, native services, and
a separate opt-in HTTP application. [IMPORT_SCOPE.md](IMPORT_SCOPE.md) defines the boundary;
[PHASE0_REPORT.md](PHASE0_REPORT.md) records actual execution results.

## CTest coverage

`ryo_mainnet_genesis` uses Ryo's native parser, serialization, and hashing with
its public mainnet genesis transaction. It checks known block/transaction hashes,
coinbase version, unlock height, RingCT type, output key/amount, binary round trip,
and rejection of a truncated blob. Crypto is not implemented independently.

`ryo_native_offline` starts the pinned daemon with `--offline` in a disposable
temporary directory. `tests/native_chain_fixture.cpp` exercises the **imported
implementations**: MicroCore's LMDB block/transaction/output lookup, malformed
hash rejection, MempoolStatus's empty native pool and daemon network RPC, and
CurrentBlockchainStatus's existing Ryo genesis emission adjustment. No background
monitor is started, and no checkpoint is written. The Python runner manages its
own loopback ports and processes and does not use a supplied chain or wallet.

Run all checks through the documented build helper, or:

```bash
ctest --test-dir build/native --output-on-failure
```

Direct offline integration invocation:

```bash
python3 scripts/offline-native-test.py \
  .deps/ryo-core/build/release/bin/ryod build/native/ryo_native_chain_fixture
```

JSON captures retain real public genesis and version-3 RingCT response types.
[Fixture provenance](../tests/fixtures/README.md) records source endpoints and
limits. These captures establish references; they are not native signature or
secret-key decoding tests. No real private keys or wallet exports are included.

## Native service and HTTP coverage

`ryo_native_services` verifies a real version-3/RingCT transaction blob through
Ryo parsing, hash, binary round-trip, fee/size/ring metadata, and hidden-amount
visibility. It verifies a public historical block-1/version-2 coinbase and checks
genesis metadata, malformed/missing/overflow input, and wrong-network rejection.
Native `is_read_only()` assertions protect the actual DB open mode.

In a separate disposable LMDB, it exercises pool add/remove, synthetic confirmed
state, block removal/replacement, owned results after a reorg, concurrent queries,
and closed-database failures. A modified block container tests storage semantics,
not consensus/PoW validity. It never submits a transaction or mines a public block.

v0.3 extends this fixture with native tip/difficulty snapshots, bounded anchored
pagination at genesis/block 1, append above an anchor, anchor removal/replacement,
and owned results. It exercises v2 RingCT/pool/confirmed JSON, native raw bytes,
synthetic public ring references, native additional-key/payment-ID construction
(including present all-zero IDs), and 503 after DB close. Synthetic extra/ring
cases test native interpretation and storage, not signature/consensus validity.
When HTTP testing is enabled, the offline runner validates the saved native
responses against the exact DTO schemas through `--api-v2-contracts`.
An oversized native pool container is first read successfully, then rejected by
the API raw-size bound; this distinguishes resource rejection from a parse/DB
failure. Native raw block bytes are decoded and hashed again for a roundtrip check.

With `RYO_BUILD_HTTP=ON`, `ryo_http_contracts` starts the real HTTP executable
alongside the offline daemon. It compares all four block/transaction/raw genesis
contracts with captured JSON, normalizing only changing chain height/confirmations.
It tests version fields, JSend failures, unknown/disabled routes, wrong startup
configuration, non-GET/body/header/target rejection, 24 concurrent queries, a slow
partial client deadline, health after errors, and signal shutdown with an open
client. The runner owns all temporary files/processes; no supplied DB is modified.
See [the implemented HTTP subset and limits](HTTP_SERVER.md).

The HTTP test additionally checks every v2 route and response schema, exact
genesis amounts/raw bytes, uppercase hash equivalence, the bundled OpenAPI JSON,
400/404/409/405 mappings, v2 body/header errors, duplicate/unknown/empty/encoded
parameters, concurrent v2 pages and all four combinations of independent API
flags. `ryo_api_v2_schema` checks the repository schemas/examples. With HTTP
enabled, CTest therefore contains five checks; the default library build retains
the three native checks without requiring the HTTP Python packages.

Actual mapping-growth recovery, larger/live pool ring lookups, external-writer
load/reorg stress, full-chain capacity, broader historical fixtures, and positive
testnet/stagenet fixtures remain unverified. The native parse/roundtrip test is
not a full cryptographic signature/consensus validation test.

## Optional native query diagnostics

The diagnostic executable is disabled by default and does not change the library
or CTest suite. Build it explicitly and run it against a disposable offline daemon:

```bash
RYO_BUILD_BENCHMARKS=ON bash scripts/build-baseline.sh .deps/ryo-core build/native 2
python3 scripts/offline-native-test.py \
  .deps/ryo-core/build/release/bin/ryod build/native/ryo_native_lookup_benchmark \
  --timeout 120 --result-file build/native-query-baseline.json
```

The runner's existing fixture timeout remains 30 seconds; the diagnostic needs a
longer explicit timeout because it repeats daemon RPC requests. The optional
result path must have an existing parent directory. CI compiles the diagnostic
with the other native targets but does not use timing as a pass/fail threshold.
See [the measured reference and its limits](NATIVE_QUERY_BASELINE.md).

## OpenAPI and DTO checks

The v0.3 API provides an OpenAPI contract and
[public examples](api-v2.examples.json). Check their local references, schema
shapes, fixture amounts/keys/raw bytes, precision and privacy rejection cases:

```bash
sudo apt-get install -y --no-install-recommends python3-jsonschema python3-yaml
python3 scripts/check-api-v2-contract.py
```

These are developer/CI dependencies, not C++ runtime dependencies. The separate
Ubuntu 24.04 contract workflow performs this bounded check without building Ryo.
The document was also checked locally against the official
[OpenAPI 3.1 structural schema](https://spec.openapis.org/oas/3.1/schema/2025-09-15).
The recurring check validates DTOs/references/examples and selected structural
invariants; it is not a complete OpenAPI standards validator. Examples project
the known genesis onto a one-block chain and use explicit example software
metadata. The hidden-output example is a known public RingCT output, and the
pool/error examples describe API semantics. This static check alone does not
exercise runtime behavior; the native response/schema and HTTP checks described
above provide separate coverage for [API v2](API_V2.md).

## Coverage required as functionality is brought over

- Historical ordinary versions, current RingCT, payment IDs, subaddresses,
  additional keys, different ring sizes, unusual objects, and public raw blobs.
- Pool add/remove/confirm/reorg/failure transitions and stale snapshots.
- Emission checkpoint corruption/restart, tip gap, small-chain arithmetic,
  and deep reorgs. The synchronous genesis adjustment test does not prove these.
- Native read-only LMDB lifecycle, mapping growth, concurrency, and reorgs.
- Testnet/stagenet-specific fixtures and database isolation.
- Contracts/DTOs for later API groups, additional input/resource cases, and
  optional submission gates when those features are implemented.
- Browser key isolation/parity only when local verification is implemented.

The Phase 0 legacy website smoke was run separately as discovery evidence. Its
HTTP checks are not this foundation's test suite, and its website is not shipped.
No full-chain performance or production security claim follows from a tiny
mainnet genesis fixture. Submission tests require an isolated test network.
