# Native foundation build

Reference: Ubuntu 24.04 LTS, GCC 13, CMake 3.28, Boost 1.83, OpenSSL 3.
The current project builds selected native C++ services and fixture executables,
with a separate opt-in HTTP executable.
It does not build or install the old explorer website. See
[IMPORT_SCOPE.md](IMPORT_SCOPE.md) for the exact source boundary.

## Dependencies

Install on an Ubuntu 24.04 development host:

```bash
sudo apt-get update
sudo apt-get install --no-install-recommends \
  build-essential cmake git ca-certificates pkg-config python3 \
  libboost-system-dev libboost-filesystem-dev libboost-thread-dev \
  libboost-date-time-dev libboost-chrono-dev libboost-regex-dev \
  libboost-serialization-dev libboost-program-options-dev libboost-locale-dev \
  libssl-dev libunbound-dev libminiupnpc-dev libunwind-dev liblzma-dev \
  libreadline-dev libldns-dev libexpat1-dev libcurl4-openssl-dev \
  cppzmq-dev libzmq3-dev libsodium-dev
```

`cppzmq-dev` supplies `zmq.hpp`; `libzmq3-dev` alone is insufficient.
Node/npm, Docker, PostgreSQL, Redis, and WASM are not dependencies. Clang is
optional for this GCC baseline. `gh` is only needed for GitHub administration.
Run `bash scripts/environment-report.sh` for non-secret diagnostics.

## Build the pinned official Ryo core

Use a separate checkout. Do not replace existing source or a chain database:

```bash
git clone https://github.com/ryo-currency/ryo-currency.git .deps/ryo-core
git -C .deps/ryo-core checkout 185dd1fa33ba88c88bb22df9069ad368c0f9a27e
bash scripts/build-ryo-core.sh .deps/ryo-core 2
```

The pin is recorded in `scripts/ryo-core-revision.txt`. The helper applies
`scripts/patches/ryo-ubuntu24.patch` only to the clean pinned checkout, or accepts
that exact patch already applied. It refuses staged/unexpected tracked changes.
Compatibility fixes add a direct Boost MPL include, qualify bind placeholders,
correct indentation, and supply a missing explicit native template instantiation.
The patch also makes native LMDB sync a no-op for a read-only environment, so
native shutdown does not fail by trying to flush a `DBF_RDONLY` database.
Consensus and cryptographic algorithms are unchanged. GCC's `deprecated-copy`
and `misleading-indentation` diagnostics remain visible as warnings; other
existing warning/error settings remain in effect.

The helper builds `wallet` (the required archive), `daemon`, and their dependencies.
It does not build the standalone wallet CLI/RPC applications, whose exploratory
all-target build exposed additional errors outside this foundation's scope.
Source headers, generated files, and matching archives are required; a daemon
binary alone is insufficient. Use Ryo, not current Monero. Start with two jobs
on modest machines because compilation consumes substantial RAM.

## Build and validate this project

If upgrading an existing v0.1.0 core checkout, the helper intentionally refuses
its older applied patch as an unexpected difference. Remove only that exact
reviewed patch before applying the new one; stop if `cmp` reports any difference:

```bash
set -e
mkdir -p build
git show v0.1.0:scripts/patches/ryo-ubuntu24.patch > build/ryo-v0.1.patch
git -C .deps/ryo-core diff --binary > build/ryo-core-current.patch
cmp build/ryo-v0.1.patch build/ryo-core-current.patch
git -C .deps/ryo-core diff --cached --exit-code
git -C .deps/ryo-core apply --reverse --check "$PWD/build/ryo-v0.1.patch"
git -C .deps/ryo-core apply --reverse "$PWD/build/ryo-v0.1.patch"
bash scripts/build-ryo-core.sh .deps/ryo-core 2
```

This requires the project's existing v0.1.0 tag and the pinned core revision.
Do not reset an independently modified dependency checkout. A fresh separate
checkout using the earlier instructions is also supported.

```bash
bash scripts/build-baseline.sh .deps/ryo-core build/native 2
```

The helper verifies the core pin, configures CMake with `RYO_CORE_DIR` and
`RYO_CORE_BUILD_DIR`, builds `ryo_explorer_core` plus the fixture executables,
and runs CTest. A failed required archive lookup aborts configuration.
CTest includes native parsing/hash checks and offline LMDB/RPC integration;
see [TESTING.md](TESTING.md) for the exact coverage and limitations.

An optional native query diagnostic can be built with
`RYO_BUILD_BENCHMARKS=ON`. The default is `OFF`; timing runs are separate from
CTest. See [TESTING.md](TESTING.md#optional-native-query-diagnostics).

Equivalent manual commands:

```bash
cmake -S . -B build/native -DCMAKE_BUILD_TYPE=Release \
  -DRYO_CORE_DIR="$PWD/.deps/ryo-core" -DBUILD_TESTING=ON
cmake --build build/native --parallel 2
ctest --test-dir build/native --output-on-failure
```

The offline test creates its own temporary genesis-only LMDB, binds loopback
ports, performs native read-only checks, and cleans up only its own processes and
files. It never synchronizes or submits to mainnet. No supplied database, wallet,
or secret input is needed. Production packaging is future work; native
development does not require Docker.

## Optional read-only HTTP executable

```bash
sudo apt-get install -y --no-install-recommends python3-yaml python3-jsonschema
RYO_BUILD_HTTP=ON bash scripts/build-baseline.sh .deps/ryo-core build/native 2
```

The default is `OFF`, preserving the native-library development workflow. The
opt-in builds `ryo_explorer_http` and runs its real HTTP contract test in addition
to the three native fixtures and an OpenAPI/DTO schema check. PyYAML bundles
the OpenAPI contract into the executable at build time; jsonschema validates
actual native/HTTP responses in tests. These Python packages are development
dependencies for the HTTP option, not runtime dependencies of the binary or
requirements of the default native-library build. Existing Boost 1.83 provides Beast/Asio; no new
vendored library is required. See [HTTP_SERVER.md](HTTP_SERVER.md) for startup,
implemented routes, compatibility changes, resource limits, and deployment gaps.
API v2 is independently enabled with `--enable-api-v2`; see [API_V2.md](API_V2.md).
Upgrading from v0.2 needs no new core pin or compatibility patch, only a rebuilt
explorer and the documented HTTP build/test dependencies.
