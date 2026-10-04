# Phase 0 discovery and native foundation report

Recorded 2026-10-04. **v0.1.0 native foundation validated.** The user selected an independent repository
containing reusable native C++ components, tests, and documentation, without the
old website/templates. [IMPORT_SCOPE.md](IMPORT_SCOPE.md) defines that boundary.
This report distinguishes upstream discovery from the active project's results.

## Environment, Git, and ownership

The initially empty workspace is `/home/dev/projects/ryo-blockchain-explorer`.
Official upstream `2e334724f9921e813e787b09f9365d53020a6286` (2025-08-04) was
cloned with its full 970-commit mainline history; the clone is non-shallow.
The existing ancestry and source notices are preserved. The active tree selectively
retains native components; it does not ship the upstream website.

```text
origin   https://github.com/ucrem/ryo-blockchain-explorer.git
upstream https://github.com/ryo-currency/ryo-blockchain-explorer.git
```

GitHub CLI login was verified as `ucrem`. The target repository is independent and
public: GitHub reports `isFork=false`, `isPrivate=false`, and no parent. `main` is
the project's integration branch, with `remote.pushDefault=origin`. No upstream
push, force push, or history rewrite was performed. The copied `master` and topic branches were removed from the target after
verifying that they contained only the original imports; `main` is its only branch.
Their original refs/history remain available locally and in official upstream.

An initial setup fork was renamed and archived as `ryo-blockchain-explorer-setup-fork`
when the user clarified that the project must be independent. It contains no
modernization work. Its deletion was unavailable because the credential lacks
`delete_repo`; no additional authentication was requested merely to remove it.

| Check | Initial observation |
| --- | --- |
| OS / kernel | Ubuntu 26.04 LTS, x86-64, Linux 7.0.0-38-generic |
| GCC / Clang / CMake | Missing on host |
| Git | 2.53.0 |
| Node / npm | 24.21.0 / 11.19.0; unused by the native foundation |
| Docker / gh | Missing initially; CLI later downloaded under `/tmp` |
| Passwordless sudo | Unavailable |
| Supplied LMDB / daemon | None identified; disposable offline genesis DB used instead |
| Command sandbox | Initially failed to initialize; later disabled by the user |

A temporary Canonical Ubuntu noble OCI filesystem was verified against its
published SHA256SUMS: `6fb36aacf06bfa77b8b624c63f07c04b85d76ad66d3bd3d9f101462537e770e3`.
It reports Ubuntu 24.04.5 LTS, GCC 13.3.0, CMake 3.28.3, Boost 1.83, and OpenSSL 3.
PRoot ran with acceleration disabled after an initial signal-4 failure. This is
Ubuntu 24.04 userspace sharing the Ubuntu 26.04 host kernel, not a native boot/VM
validation. The native GitHub Ubuntu 24.04 runner also passed; its kernel was
6.17.0-1022-azure, GCC 13.3.0, and CMake 3.31.6.

## Requested discovery inventory

| Area | Observed upstream behavior / canonical reference |
| --- | --- |
| Repository tree | `main.cpp`, `src/`, `ext/`, `cmake/`, templates/JS; [architecture](ARCHITECTURE_CURRENT.md) |
| Entry/build | CMake C++14 `xmrblocks`, separately built Ryo archives |
| HTTP/rendering | Multithreaded Crow, mstch, startup template map; not imported |
| Routes | 46 explicit routes plus implicit static route; [feature matrix](FEATURE_MATRIX.md) |
| API | 13 flag-gated JSON GET endpoints plus HTML `/api`; [API inventory](API_LEGACY.md) |
| Dependencies | Native Ryo, Boost, fmt, OpenSSL/curl/unbound/unwind; Crow/mstch/cache/browser code excluded from active tree |
| LMDB | Native `BlockchainLMDB`, `MDB_RDONLY | MDB_NOLOCK`, `lmdb02` |
| Daemon RPC | Network/hard-fork snapshots; optional submission and additional wrappers |
| Background workers | Five-second native pool refresh; roughly 60-second network refresh; optional emission scanner |
| Cache | Optional FIFO 200 blocks / LRU 1,000 tx; partial reorg checks, temporary lock-guard lifetime defects; not imported |
| Pool | Native LMDB-backed pool, receive-time sorting, stale snapshot on failure |
| Emission | Existing 10,000-block scanner/checkpoint, three-block tip gap, Ryo genesis adjustment |
| Synchronization/reorgs | Shared read-only/no-lock DB assumptions; incomplete cache/checkpoint reorg coverage |
| Browser verification | Optional bundled crypto JS, historical/version parity unverified; not imported |
| Privacy | Legacy secret-bearing URLs/response echo and node-local pool times; [privacy model](PRIVACY_MODEL.md) |
| Configuration | Optional JSON/JS/pusher/key/output/emission/cache/autorefresh flags default false |
| Networks | Mutually exclusive testnet/stagenet flags with network-specific DB paths/config |
| Submission | Optional/default-off legacy pusher; native helper not exposed as a public endpoint here |
| Existing delivery tooling | Original application lacked an integrated test suite, CI, helper scripts, and Docker packaging |
| Licenses | Upstream BSD notice retained; selected JSON header retains embedded MIT notice; [provenance](../THIRD_PARTY_NOTICES.md) |
| Reusable components | MicroCore, native utilities, RPC, pool/network snapshots, emission implementation |
| Further extraction | Real Ryo logic still coupled inside upstream `page.h`; bring it over incrementally without importing the website |
| Assumption differences | Pool primarily native, existing browser crypto, no public address history/balance or reverse-key API |

Important legacy debt: malformed default `http:://` URLs, bytes labeled kbytes,
hard-coded fee estimate, disabled-tool links, static directory mismatch, cache
reference/locking risks, checkpoint corruption/deep reorg/small-chain handling,
and a browser RingCT gate tied to transaction version 2. These are observations,
not claims that the active library resolves all of them.

## Upstream build/runtime discovery evidence

1. Initial host CMake attempt failed because CMake was absent.
2. Official Ryo was cloned separately at `185dd1fa33ba88c88bb22df9069ad368c0f9a27e`.
   Ubuntu 24.04 configuration initially lacked `zmq.hpp`; installing `cppzmq-dev`
   with `libzmq3-dev`/`libsodium-dev` resolved that dependency.
3. Modern Boost required direct MPL includes and qualified bind placeholders.
   GCC copy/indentation diagnostics remain warnings. Linking required an explicit
   native `get_transactions_blobs` template instantiation. The isolated core
   patch does not change crypto or consensus algorithms.
4. Required Ryo `wallet`/`daemon` targets and dependencies built. An exploratory
   all-target build also failed in unrelated standalone wallet applications;
   those applications are outside the supported foundation build.
5. The explorer probe required `fmt/ostream.h` before Ryo header instantiations.
   It linked with GCC 13.3/CMake 3.28.3 and passed native genesis/help checks.
6. The original application ran against a disposable offline mainnet genesis
   LMDB. Immutable block/tx/raw JSON, HTML pages, JS, empty pool, network, search,
   pagination, failure envelopes, and disabled feature gates were checked.
7. Logo/favicon initially returned 404; a packaging correction in the discovery
   probe made asset delivery pass. That website packaging is not imported here.

The separate legacy source snapshot was kept outside the project at
`/tmp/ryo-legacy-discovery`. Its website smoke is reference evidence, not a
shipped HTTP application or the active project's test suite.

Read-only public reference checks used `https://explorer.ryo-currency.com`.
Deployment reported `b5ba431`, `topic-css-tlc`, and Ryo `0.6.1.0-749a2ad/dev`, so
it differs from the exact upstream HEAD. Public fixture provenance is recorded
in [tests/fixtures/README.md](../tests/fixtures/README.md). Genesis block hash:
`6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac`.
Genesis tx hash: `ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88`.
Current observed ordinary transactions include version 3 / RingCT type 3.

## Active native foundation validation

The build compiles the five imported native implementations and required fmt
sources into `ryo_explorer_core`, with the single selected JSON header. C++14 is
explicitly selected: asking for a minimum C++14 feature alone would leave GCC's
newer default active and break Ryo's older serialization headers.

The documented native build helper completed successfully under Ubuntu 24.04
userspace. Both CTest checks passed: `ryo_mainnet_genesis` (1.03 seconds) and
`ryo_native_offline` (3.57 seconds), 2/2 total. The clean native Ubuntu 24.04
[CI run](https://github.com/ucrem/ryo-blockchain-explorer/actions/runs/37230032831)
passed on source commit `47b120b459a3b41909835a5afa88c479ca320da2`: core build,
selected components, both CTest checks (1.02 and 3.39 seconds), and syntax checks.
The release documentation commit changes Markdown only; the validated code,
workflow, dependency pin, and patch are identical. The fixture suite checks native parser/hash/round-trip/rejection behavior and real
MicroCore, pool/network RPC, and genesis emission code against an offline LMDB.
No HTTP server, legacy assets, frontend, database service, or crypto rewrite is
introduced. Scripts/syntax, documentation links, and tracked diffs are checked
separately. Build/probe logs stay under ignored `build/`.

## Milestone and follow-up scope

The user explicitly selected a native-only foundation without the old website.
The v0.1.0 milestone is refined accordingly: usable native components, real
fixtures/offline integration, reproducible Ubuntu 24.04 build, and discovery docs.
Its [v0.1.0 release notes](https://github.com/ucrem/ryo-blockchain-explorer/releases/tag/v0.1.0)
state this scope clearly. This is a native development foundation; it does not
provide HTTP pages/API or a frontend. [The plan](MODERNIZATION_PLAN.md) records
concrete native build/test work and the later service/API/frontend sequence.

Remaining coverage includes full-chain/reorg/concurrency/performance, historical
non-coinbase native blobs, RingCT/payment-ID/subaddress/browser parity, checkpoint
corruption/restart/tip-gap behavior, and testnet/stagenet-specific fixtures. No
numeric performance or production/security certification is implied.
