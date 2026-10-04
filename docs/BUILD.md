# Native foundation build

Reference: Ubuntu 24.04 LTS, GCC 13, CMake 3.28, Boost 1.83, OpenSSL 3.
The current project builds a selected native C++ library and fixture executables.
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

```bash
bash scripts/build-baseline.sh .deps/ryo-core build/native 2
```

The helper verifies the core pin, configures CMake with `RYO_CORE_DIR` and
`RYO_CORE_BUILD_DIR`, builds `ryo_explorer_core` plus the fixture executables,
and runs CTest. A failed required archive lookup aborts configuration.
CTest includes native parsing/hash checks and offline LMDB/RPC integration;
see [TESTING.md](TESTING.md) for the exact coverage and limitations.

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
or secret input is needed. Production packaging and HTTP deployment are future
work; native development does not require Docker.
