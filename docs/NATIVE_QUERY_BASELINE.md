# Native query diagnostic reference

Measured on 2026-10-04, before service/HTTP extraction. This is a diagnostic of the
selected v0.1.0 implementations, not a production performance claim. No auxiliary
index or database is justified by this run.

## Environment and method

- Baseline: v0.1.0 / `afe5a8e`, pinned Ryo core
  `185dd1fa33ba88c88bb22df9069ad368c0f9a27e`, with the documented Ubuntu patch.
- Ubuntu 24.04.5 userspace under PRoot on an Ubuntu 26.04 host, sharing the host's
  Linux 7.0.0-38 kernel. GCC 13.3, CMake 3.28.3, Release build, C++14, Boost 1.83.
  This is **not** a natively booted Ubuntu 24.04 performance environment.
- Host: four virtual CPUs, Intel Core i7-11700K reported by KVM; 7.3 GiB RAM,
  no swap; ext4 on virtual storage. PRoot syscall overhead and host scheduling
  affect comparisons, particularly LMDB accesses and loopback RPC.
- A newly created, disposable mainnet genesis LMDB: height 1; block hash
  `6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac`.
  The daemon is offline and loopback-only; no full-chain sync or submission.
- One calling thread, warm cache, ten warmups followed by 100 samples per
  operation. `steady_clock` records elapsed microseconds; nearest-rank percentiles.
  Each call checks its result. RPC refresh includes the existing network-info
  RPC operations, not just reading a cached value.

The executable is `tests/native_lookup_benchmark.cpp`. Reproduction commands are
in [TESTING.md](TESTING.md#optional-native-query-diagnostics). The recorded
[JSON output](benchmarks/native-genesis-2026-10-04.json) retains all measurements
and explicitly unmeasured operations. The optional target is compiled in CI;
timings are not CI assertions.

## Results

All values below are microseconds, rounded to three decimal places.

| Operation | p50 | p95 | p99 |
| --- | ---: | ---: | ---: |
| Block by height | 1.430 | 1.464 | 2.262 |
| Block by hash | 1005.619 | 1257.565 | 1297.471 |
| Transaction by hash | 2.516 | 2.544 | 3.362 |
| Output key in a known block | 1058.250 | 1279.926 | 1426.866 |
| Latest single block | 2.320 | 2.339 | 2.346 |
| Empty native mempool refresh | 4467.228 | 5659.001 | 5802.382 |
| Existing genesis emission range | 984.867 | 1243.410 | 1273.587 |
| Daemon network RPC refresh | 163292.776 | 686169.515 | 1165107.750 |
| Cached network snapshot | 0.073 | 0.090 | 0.100 |

Network refresh has substantially higher elapsed time than a cached snapshot in
this environment. This identifies a scenario to profile on native Linux, not
the cause of the cost or evidence that a new store is needed. A known-block output
scan and a latest-single-block read are deliberately narrow operations; they are
not unrestricted output search or paginated latest-block performance.

## Missing scenarios and next measurements

Genesis has no spent key-image inputs, no ordinary transactions, and an empty
mempool. The foundation has no search dispatch service. These cases are explicitly
unmeasured, rather than represented by fake timings or empty successful searches.

Before optimizing, measure representative historical/current mainnet reads,
spent-key-image lookup, nonempty pools, bounded latest-block pages, ordinary
RingCT transactions, emission ranges, and real search implementations. Record
hardware/storage, chain tip/size, warm versus cold cache, threads/concurrency,
daemon state, distributions, and failure behavior. Repeat on native Ubuntu
24.04 and inspect the existing Ryo/LMDB indexes and actual bottleneck first.
Measure service/serialization/HTTP overhead only after those layers exist.

The existing native genesis and offline integration tests still pass. This
diagnostic does not establish mapping-growth/reorg safety, historical completeness,
production throughput, or latency budgets.
