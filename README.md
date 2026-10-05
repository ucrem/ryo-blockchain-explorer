# Ryo Explorer & Network Intelligence Platform

An independent public project for the incremental modernization of Ryo's
blockchain explorer. This repository starts with **selected native C++ components,
real Ryo fixtures, and technical discovery documentation**, now extended with
concrete block/transaction services and a separate opt-in read-only HTTP server.
It does not include the old website or templates. v0.4 adds a new server-first
Next.js dashboard, block/transaction pages, public identifier search and developer
guide in `web/`, with bundled assets and a bounded
same-origin read-only API adapter. See [web operation](docs/WEB.md).

The current build produces `ryo_explorer_core`, a native static library for
read-only LMDB access, existing Ryo parsing/metadata utilities, daemon RPC,
mempool snapshots, and emission calculation. The official Ryo core is a pinned
external dependency. Cryptographic and consensus logic remain native Ryo code.

The new HTTP executable implements legacy block/transaction/raw/version JSON
routes, plus health. v0.3 adds independently enabled [API v2](docs/API_V2.md)
for native-reader chain state, anchored recent-block pagination, block/transaction
details and raw JSON/hex, with OpenAPI bundled into the executable. Its supported
subset, privacy differences, bounds and configuration are documented in
[HTTP_SERVER.md](docs/HTTP_SERVER.md).

## Build and test

Reference environment: Ubuntu 24.04 LTS, GCC 13, CMake 3.28, Boost 1.83, OpenSSL 3.
Install the dependencies listed in [BUILD.md](docs/BUILD.md), then:

```bash
git clone https://github.com/ryo-currency/ryo-currency.git .deps/ryo-core
git -C .deps/ryo-core checkout 185dd1fa33ba88c88bb22df9069ad368c0f9a27e
bash scripts/build-ryo-core.sh .deps/ryo-core 2
bash scripts/build-baseline.sh .deps/ryo-core build/native 2
```

CTest checks native genesis parsing/hashes and the imported implementations
against a disposable offline genesis LMDB: block/transaction/output lookups,
empty mempool, daemon network RPC, and Ryo's existing genesis emission adjustment.
No synchronization, transaction submission, private keys, or supplied chain
are required. See [TESTING.md](docs/TESTING.md) for coverage limits.

Build the opt-in HTTP server and its contract tests:

```bash
sudo apt-get install -y --no-install-recommends python3-yaml python3-jsonschema
RYO_BUILD_HTTP=ON bash scripts/build-baseline.sh .deps/ryo-core build/native 2
build/native/ryo_explorer_http --bc-path /path/to/ryo/lmdb02 --enable-json-api --enable-api-v2
curl http://127.0.0.1:8081/api/v2/openapi.json
```

The executable defaults to `127.0.0.1:8081` and validates the selected network's
genesis. Native services return owned results from read-only LMDB snapshots.
Tests add real historical/RingCT blobs, isolated storage transitions, concurrent
queries, HTTP contracts, input limits, and shutdown. No full-chain capacity or
production readiness claim follows from the disposable fixtures.

## Project documentation

- [Selective import and boundaries](docs/IMPORT_SCOPE.md)
- [Phase 0 findings and validation](docs/PHASE0_REPORT.md)
- [Upstream architecture reference](docs/ARCHITECTURE_CURRENT.md)
- [Upstream feature inventory](docs/FEATURE_MATRIX.md)
- [Legacy API reference](docs/API_LEGACY.md)
- [Implemented read-only HTTP subset](docs/HTTP_SERVER.md)
- [Privacy model](docs/PRIVACY_MODEL.md)
- [Modernization plan](docs/MODERNIZATION_PLAN.md)
- [v0.2.0 service/HTTP proposal](docs/V0_2_SERVICE_PROPOSAL.md)
- [Approved v0.3.0 API scope](docs/V0_3_API_PROPOSAL.md)
- [API v2 guide](docs/API_V2.md), [OpenAPI](docs/api-v2.openapi.yaml) and [examples](docs/api-v2.examples.json)
- [Native query diagnostic baseline](docs/NATIVE_QUERY_BASELINE.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Build setup](docs/BUILD.md), [testing](docs/TESTING.md), [release process](docs/RELEASING.md)
- [Contributing](CONTRIBUTING.md), [security reporting](SECURITY.md), [conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md), [license](LICENSE), [source attribution](THIRD_PARTY_NOTICES.md)

The architecture, feature, and API inventories describe the inspected official
explorer. The new server implements only the separately documented JSON subset.
Logic still coupled to upstream HTML will be imported in focused, tested changes
when its services are built. Phase 0 does not claim browser crypto parity,
full-chain/reorg correctness, production readiness, or completed analytics.

The v0.4 frontend uses Next.js, TypeScript, Tailwind CSS, and shadcn/ui, with
Server Components by default. Extended inspection and later tools remain
future milestones. LMDB remains authoritative;
there is no mandatory PostgreSQL, Redis, additional service infrastructure,
tracking, external runtime CDN, or speculative Proof of Stake functionality.

## Repository and release status

```text
origin   https://github.com/ucrem/ryo-blockchain-explorer.git
upstream https://github.com/ryo-currency/ryo-blockchain-explorer.git
```

The project is public and independent of GitHub's fork network. Original source
history and attribution are preserved; active source is selected rather than a
copy of the entire upstream website. Never push to upstream or force-push.

[v0.1.0 — Native Foundation](https://github.com/ucrem/ryo-blockchain-explorer/releases/tag/v0.1.0)
follows the user-selected import scope: compiled native components, fixtures,
reproducible build, and discovery documentation. Its Ubuntu 24.04
[build and native tests passed](https://github.com/ucrem/ryo-blockchain-explorer/actions/runs/37230032831).
[v0.2.0 — Native Services and Read-only HTTP](https://github.com/ucrem/ryo-blockchain-explorer/releases/tag/v0.2.0)
adds native services and the opt-in HTTP subset; the frontend follows later.
[Its release source passed Ubuntu 24.04 CI and all four native/HTTP tests](https://github.com/ucrem/ryo-blockchain-explorer/actions/runs/37234982307).
[v0.3.0 — API v2 and OpenAPI](https://github.com/ucrem/ryo-blockchain-explorer/releases/tag/v0.3.0)
adds exact public DTOs, native-reader chain state, anchored block pages and
native raw JSON/hex while preserving the legacy subset.
[Its release source passed Ubuntu 24.04 CI and all five tests](https://github.com/ucrem/ryo-blockchain-explorer/actions/runs/37239326835).
Each release includes
validation, a dated changelog, an annotated tag, and a real GitHub Release.

The v0.4 implementation provides a responsive light/dark
dashboard, readable block/transaction details, public height/hash search,
embedded formatted JSON/raw views,
native-reader chain status, ten-second live tip updates, recent block pagination, observed header
intervals and developer API access. See
[the scope](docs/V0_4_WEB_PROPOSAL.md) and [validation](docs/V0_4_VALIDATION.md).
