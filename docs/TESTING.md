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

With `RYO_BUILD_HTTP=ON`, `ryo_http_contracts` starts the real HTTP executable
alongside the offline daemon. It compares all four block/transaction/raw genesis
contracts with captured JSON, normalizing only changing chain height/confirmations.
It tests version fields, JSend failures, unknown/disabled routes, wrong startup
configuration, non-GET/body/header/target rejection, 24 concurrent queries, a slow
partial client deadline, health after errors, and signal shutdown with an open
client. The runner owns all temporary files/processes; no supplied DB is modified.
See [the implemented HTTP subset and limits](HTTP_SERVER.md).

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

## Coverage required as functionality is brought over

The v0.3 preparation provides a proposed OpenAPI contract and
[public examples](api-v2.examples.json). Check their local references, schema
shapes, fixture amounts/keys/raw bytes, precision and privacy rejection cases:

```bash
sudo apt-get install -y --no-install-recommends python3-jsonschema python3-yaml
python3 scripts/check-api-v2-contract.py
```

These are developer/CI dependencies, not C++ runtime dependencies. The separate
Ubuntu 24.04 contract workflow performs this bounded check without building Ryo.
The draft was also checked locally against the official
[OpenAPI 3.1 structural schema](https://spec.openapis.org/oas/3.1/schema/2025-09-15).
The recurring check validates DTOs/references/examples and selected structural
invariants; it is not a complete OpenAPI standards validator. Examples project
the known genesis onto a one-block chain and use explicit example software
metadata. The hidden-output example is a known public RingCT output, and the
pool/error examples describe proposed semantics. These checks do not exercise
v2 HTTP routes, native cursor/reorg behavior or a new network service: those
remain acceptance tests for the [pending implementation](V0_3_API_PROPOSAL.md).

- Historical ordinary versions, current RingCT, payment IDs, subaddresses,
  additional keys, different ring sizes, unusual objects, and public raw blobs.
- Pool add/remove/confirm/reorg/failure transitions and stale snapshots.
- Emission checkpoint corruption/restart, tip gap, small-chain arithmetic,
  and deep reorgs. The synchronous genesis adjustment test does not prove these.
- Native read-only LMDB lifecycle, mapping growth, concurrency, and reorgs.
- Testnet/stagenet-specific fixtures and database isolation.
- Future HTTP contracts, privacy-safe DTOs, bounded pagination/input, and optional
  submission gates when the server is implemented.
- Browser key isolation/parity only when local verification is implemented.

The Phase 0 legacy website smoke was run separately as discovery evidence. Its
HTTP checks are not this foundation's test suite, and its website is not shipped.
No full-chain performance or production security claim follows from a tiny
mainnet genesis fixture. Submission tests require an isolated test network.
