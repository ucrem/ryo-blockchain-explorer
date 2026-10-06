# Native warning maintenance

## Baseline and scope

The v0.4 release build reports 132 C++ warning occurrences at 20 distinct source
locations in the pinned SDK: 125 deprecated declarations, five deprecated copies,
one initialization diagnostic and one misleading indentation diagnostic. Eleven
CMake diagnostics include old minimum versions/policies, package-name mismatch
and expected absence of optional Qt translation tooling. This is compiler/build
maintenance, not a vulnerability certification or a change to Ryo consensus.

Apply a third separately reviewed SDK patch to the existing pin. Keep the two
released compatibility/point-identity patches unchanged. Build in a separate SDK
checkout; the running development node continues using its released executable
and database. The website and HTTP/API contracts are unchanged.

## Changes and compatibility boundaries

- The core's pool/blockchain constructor relationship binds reciprocal references
  without reading the not-yet-constructed blockchain. Pass its storage address to
  a private pool constructor available to `core`; keep the public reference
  constructor, field layout, member order and destruction order. Both entry paths
  only bind the existing nonnull reference; no unbound state or deferred setter
  is introduced. This clarifies the intentional reference binding instead of
  disabling initialization diagnostics. See the [C++ lifetime rules](https://eel.is/c++draft/basic.life).
- Migrate supported-target Boost Bind includes and qualify the actual RPC
  placeholder. The excluded standalone CLI keeps its own legacy include so its
  existing bindings do not depend on namespace pollution from shared headers.
- Explicitly default the AES and connection-context copy constructors, preserving
  the implicit memberwise copy. Preserve connection assignment's existing
  identity/reset semantics. Replace deprecated function-object base classes with
  their equivalent public type aliases; preserve comparator/hash bodies.
- Use `std::streampos`, modern Boost copy options, and OpenSSL EVP SHA-256 with
  checked allocation/results and owned context cleanup. Preserve digest bytes,
  filename behavior and chunked reading. Use current cppzmq receive/send/options
  interfaces with the existing timeout/flags and message processing.
- Align SDK CMake minimums with the supported Ubuntu build, use Boost's config
  package, fix the actual extensionless RPC source and Miniupnpc package spelling.
  Expected absence of optional translations is an explicit status message;
  failure of an installed translation tool remains a warning. No Qt dependency
  becomes mandatory.
- Recognize only exact reviewed SDK patch subsets, then apply the missing patches.
  Reject staged/unrelated tracked changes before any SDK mutation. Restore normal
  compiler error behavior for deprecated copies and misleading indentation,
  including old cached exemptions while preserving unrelated operator flags;
  do not add warning-disable flags or blanket suppressions.

CMake/Boost support remains the documented native Linux foundation; untested
foreign platforms and all upstream standalone wallet applications are outside
this maintenance build. Upstream licenses and attribution remain intact.

## Required checks

Clean Ubuntu 24.04 core wallet/daemon build and explorer/HTTP build, plus configure
with CMake 3.31 used in release CI; inventory remaining diagnostics instead of
claiming a clean build from an incremental compile. Run the existing native,
HTTP/schema checks and add bounded SHA-256 memory/file known-answer cases,
connection copy/assignment compatibility and a real offline ZMQ request/timeout
check. Exercise native hash/proof regressions including software AES. Verify the
SDK guard's accepted subsets and preserved rejection of staged/unrelated edits.
Record actual results below before creating the PR. Full native CI remains
manual-only; do not restart the continuously syncing node for maintenance tests.

## Local validation

The isolated checkout is pinned to
`185dd1fa33ba88c88bb22df9069ad368c0f9a27e`. Validation uses Ubuntu 24.04,
GCC 13, Boost 1.83 and OpenSSL 3 in the existing development rootfs. CMake
3.31.6 matches the release CI version; its official distribution SHA-256 was
verified before use. CMake 3.28.3 separately configures both the SDK and explorer.

| Check | Result |
| --- | --- |
| Fresh SDK wallet/daemon compilation | Pass; zero compiler/CMake warnings. Legacy Boost Bind pragma notes were subsequently removed by rebuilding the affected targets. |
| Final SDK helper after Bind/cache migration | Pass; zero compiler/CMake warnings or legacy Bind notes, normal upstream warning policy, empty `CMAKE_CXX_FLAGS`. |
| Explorer/HTTP/diagnostic compilation | Pass; zero compiler/CMake warnings or legacy Bind notes. |
| Explorer native/SDK/schema/HTTP CTests | 7/7 pass, including new compatibility and exact-patch upgrade/refusal checks. |
| Upstream native crypto plus eight hash-vector cases | 9/9 pass. |
| PoW vectors with `RYO_USE_SOFTWARE_AES=1` | 2/2 pass, exercising the software AES path. |
| Selected upstream proof/point/Crypto/SHA-256 cases | 182/182 pass across seven suites. |
| SDK and explorer CMake 3.28.3 configuration | Pass; zero CMake warnings. |

The original SDK compatibility and point-identity patches remain unchanged.
No full native GitHub workflow was dispatched for this maintenance PR; it remains
manual-only. The running development daemon, executable and database were not
replaced or restarted.

### Limits and remaining upstream test diagnostics

The expanded upstream `BUILD_TESTS=ON` compile also succeeds. It reports three
CMake diagnostics in the old Google Test subproject and four compiler warnings:
Google Test's death-test stack probe, an upstream crypto test's `memcpy` into a
scrubbed scalar, and two warnings in the deliberate freed-memory `memwipe` test.
These test-only sources are excluded by the normal wallet/daemon release helper;
this PR does not suppress them or claim all upstream targets are warning-free.
They warrant separate test-harness review rather than unrelated production edits.

Upstream's `tests/unit_tests/serialization.cpp` is entirely disabled by its own
`#if 0`; no upstream serialization-suite pass is claimed. The explorer's existing
native genesis, historical transaction/block and RingCT fixtures provide the
actual byte round-trip coverage used here. Full-chain consensus replay and
foreign-platform/standalone wallet builds remain outside this validation.
