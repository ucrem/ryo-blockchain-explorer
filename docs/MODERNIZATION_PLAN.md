# Modernization plan

The product will evolve into the Ryo Blockchain Explorer & Network Intelligence
Platform. Phase 0 establishes evidence before service extraction or frontend work.
Current behavior is documented in [ARCHITECTURE_CURRENT.md](ARCHITECTURE_CURRENT.md),
[FEATURE_MATRIX.md](FEATURE_MATRIX.md), and [API_LEGACY.md](API_LEGACY.md).
[DECISIONS.md](DECISIONS.md) records the accepted constraints.

The user selected an independent repository containing only reusable native C++
components, tests, and documentation. [IMPORT_SCOPE.md](IMPORT_SCOPE.md) defines
that implemented foundation. The old website and templates are not shipped.
The v0.1.0 milestone is refined to match that explicitly selected scope: a usable
native development foundation, without importing the legacy website. The prior
legacy runtime probe remains discovery evidence. v0.2 adds a focused read-only
HTTP subset described in [HTTP_SERVER.md](HTTP_SERVER.md), following the user-approved
[service proposal](V0_2_SERVICE_PROPOSAL.md).
v0.1.0, v0.2.0 and v0.3.0 are released. The foundation is a native library; the v0.2
executable is a usable JSON subset with the separately documented limitations.
The approved [v0.3 API scope](V0_3_API_PROPOSAL.md) and its
[OpenAPI contract](api-v2.openapi.yaml) are implemented;
[API_V2.md](API_V2.md) documents the released subset. The next milestone is
v0.4's server-first Next.js foundation/design system and initial dashboard.

## Target data flow

```text
ryod + blockchain LMDB
    → native Ryo access / daemon RPC
    → C++ explorer services with real extracted logic
    → documented REST JSON /api/v2/
    → Next.js server-first web application and external API clients
```

LMDB stays authoritative. There is no mandatory external database, queue, Redis,
Kafka, Kubernetes, new microservice layer, or speculative staking/PoS component.
Add `core/`, `api/`, and `web/` only as real implementation moves there. Do not
move the current source tree mechanically or add empty service abstractions.

## Migration sequence and milestones

| Version | Usable result | Exit criteria / dependencies |
| --- | --- | --- |
| v0.1.0 | Selected native C++ foundation | Preserved provenance/history, independent public ucrem repo, Ubuntu 24.04 native library build, offline LMDB/RPC/genesis tests, discovery/privacy/build docs, CI, changelog/tag/GitHub Release |
| v0.2.0 | Core/services/HTTP separation | Concrete block/transaction services and opt-in HTTP subset; captured supported contracts, explicit privacy/error differences, native fixture/storage-reorg/HTTP tests |
| v0.3.0 | API v2 and OpenAPI | Typed public DTOs/errors/pagination/units, documented privacy-safe output, legacy API retained, schema/contract tests |
| v0.4.0 | Next.js foundation/design system/dashboard | Next.js + TypeScript + Tailwind + shadcn/ui, Server Components by default, bundled assets, accessibility/light/dark/mobile verification |
| v0.5.0 | Modern block/transaction views | Preserve low-level data; basic/advanced presentation, API/raw links, historical transaction coverage |
| v0.6.0 | Advanced search/tools | Native lookup benchmarks and truthful coverage; configurable push; ring/key-image/output explanations; no public address-balance fiction |
| v0.7.0 | Realtime chain/pool/network | SSE first, disconnect/reconnect and reorg handling, bounded clients, privacy-safe payloads |
| v0.8.0 | Network intelligence/analytics/emission | Measured aggregates/history, observed block intervals, current reward/emission validation; justify any storage addition |
| v0.9.0 | Local verification; WASM if justified | Synthetic disclosed-key and historical fixture parity, no secret network traffic, explicit unsupported-version behavior |
| v1.0.0 | Production release | Security/performance/operational validation, upgrade guidance, supported deployment and complete release gates |

Dates are intentionally not promised. Each release is independently testable,
reviewable, documented, and published as both a Git tag and a GitHub Release.
The roadmap may change as measurements and protocol evidence warrant.

## v0.1.0 concrete work

1. Verify ownership/authentication, create an independent public repository only
   if the target is absent, preserve upstream commits/tags, and verify remote ancestry. Never
   overwrite an unrelated repository or push/force-push upstream.
2. Pin a compatible official Ryo core commit; build its required archives with
   Ubuntu 24.04. Record compiler/library versions and fix only demonstrated build
   problems. If core compatibility patches are needed, isolate and document them.
3. Build the selected native library and run its native fixture/integration tests.
   The original explorer build/runtime probe remains separate discovery evidence;
   do not re-import its website merely to satisfy the former release definition.
4. Exercise the imported LMDB/RPC/pool/emission implementations against a
   disposable offline genesis database. Document limitations and later coverage.
5. Add meaningful genesis/historical transaction fixtures with provenance, native
   Ryo parsing checks, read-only smoke/contract tests, and an Ubuntu 24.04 build job.
6. Finish contributor, privacy/security, build/test, release, and changelog docs;
   retain existing attribution/licenses. Use clear English issues/PRs.
7. Publish v0.1.0 only when all mandatory checks pass; otherwise retain an
   unreleased change list and explicitly list unmet gates.

## Completed service extraction and next proposal

The approved [v0.2 proposal](V0_2_SERVICE_PROPOSAL.md) is implemented: native
block/transaction metadata and owned snapshots, legacy JSON adaptation, and
separate bounded HTTP transport. The legacy HTML-bound code remains an upstream
reference, outside this project. The approved v0.3 increment adds a native chain
snapshot, bounded block-summary pagination, v2 serialization/routing and OpenAPI;
pool listing, search, emission and verification remain later focused extraction.

Before implementation, provide a focused proposal with current behavior,
problem, affected files, compatibility impact, migration/reorg/thread risks,
fixture strategy, and approval. This document does not authorize substantial
extraction or behavior changes by itself. Build fixes and non-invasive tests
are separate from architectural work.

## Compatibility strategy

Use documented legacy route names, aliases, flags, field names, units,
null/array behavior, and optional-feature gates as compatibility references when
HTTP functionality is extended. The v0.2 supported subset already protects these
contracts; remaining inventory entries are migration references, not shipped routes.
Preserve testnet and
stagenet isolation, Ryo native serialization, transaction extra, historical
versions, RingCT, payment-ID variants, subaddresses, wallet export tools, and
client-side verification. Capture actual outputs before extracting calculations.

API v2 coexists under `/api/v2/`. Proposed groups are network, blocks,
transactions, mempool, search, emission, tools, and raw views. Define integer
precision, hash/height ambiguity, units, pagination bounds, error/status mapping,
freshness, and raw JSON versus hex explicitly in OpenAPI. Current packed legacy
API version and product SemVer are distinct.

Secret-bearing GET routes/response echoing, receive timestamps, and incorrect
legacy unit labels require documented privacy/compatibility remediation before
changing existing behavior. New v2 must avoid those contracts. Do not make the
new frontend send private keys to legacy endpoints by default.

## Main risks

- Ryo archive/header/ABI drift, modern Boost/OpenSSL/GCC compatibility, generated
  headers, and ambiguous source/build paths.
- The original raw DB flag mismatch (fixed with `DBF_RDONLY` in v0.2), mapping growth, daemon/explorer state
  divergence, incomplete chain snapshots, and reorganizations.
- Cache temporary locks/reference lifetimes, background state freshness,
  asynchronous request work, and shutdown/error paths.
- Genesis/burn and development-fund accounting, deep checkpoint reorgs, corruption,
  small-chain underflow, and mismatched network checkpoints.
- Legacy secret handling, expensive scans/PoW/crypto queries, raw-input parsing,
  HTML/browser escaping, and unbounded query/response sizes.
- Historical browser crypto compatibility and insufficient fixtures.
- Runtime asset directory mismatch and links advertising disabled capabilities.
- License/attribution obligations across vendored and linked dependencies.

## Measurement plan

Benchmark block height/hash lookup, transaction lookup, public key-image lookup,
output-key lookup, recent blocks, full/partial pool, network snapshot, emission
catch-up/tip reads, and each supported search type. Record pinned core/explorer
revisions, chain network/height/tip, CPU/RAM/storage, warm/cold cache, concurrency,
p50/p95/p99 latency, CPU, memory, and bytes returned. Distinguish supported native
lookups from full scans and record reorg/failure correctness alongside latency.

Investigate native Ryo/LMDB indexes and actual bottlenecks first. Only then propose
an embedded auxiliary index with rebuild/reorg semantics. Consider PostgreSQL
later for measured historical/relational analytics needs; do not duplicate the
entire chain. [Native genesis/service diagnostics](NATIVE_QUERY_BASELINE.md)
provide limited measurements, not full-chain or production capacity evidence.
