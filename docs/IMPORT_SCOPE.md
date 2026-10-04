# Selective native import

The repository is an independent public project. Its active source tree imports
only the useful native C++ components identified during Phase 0, plus the required
JSON header, tests, and project documentation. It does not ship the old website.

| Imported source | Purpose |
| --- | --- |
| `src/MicroCore.{h,cpp}` | Native read-only LMDB initialization, blocks, transactions, output lookup |
| `src/tools.{h,cpp}` | Existing Ryo parsing, address/extra/payment-ID/ring/key-image and wallet-format helpers |
| `src/rpccalls.{h,cpp}` | Existing daemon HTTP/RPC client, reused by network snapshots |
| `src/MempoolStatus.{h,cpp}` | Native pool snapshots and daemon network status |
| `src/CurrentBlockchainStatus.{h,cpp}` | Existing Ryo emission calculation/checkpoint implementation |
| `src/monero_headers.h` | Required native Ryo includes and wallet format constants; historical filename retained |
| `third_party/json/json.hpp` | The single required upstream-vendored dependency, with embedded MIT notice |

`ryo_explorer_core` is a real static library built from these implementations.
No empty service classes, public HTTP server, frontend, or new cryptographic
implementation is introduced. Only the JSON include path and fmt compatibility
include differ in the imported native sources. No background worker starts
automatically merely by linking the library.

Excluded: `main.cpp`, `page.h`, `CmdLineOptions`, Crow, mstch, cache templates,
all legacy HTML/JavaScript/styles/images, generated version templates, unrelated
upstream CMake helpers, and the old README. The official Ryo core itself remains
an external dependency. Source provenance and notices are in
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

The requested architecture/feature/API inventories describe the **upstream
reference**, not APIs or pages implemented by this native foundation. Ryo logic
still coupled inside upstream `page.h` will be brought over in focused, tested
increments when the corresponding services are implemented. Those capabilities
are inventoried rather than silently declared removed from the product roadmap.
The original complete history remains preserved; the imported website is absent
from the current project tree. Copied topic branches are not integration branches.

Legacy RPC submission and sensitive utility functions remain internal native
code. Nothing exposes them as public endpoints. Existing pool timestamps and
emission checkpoint limitations require review before any future API exposes
their data. Read [PRIVACY_MODEL.md](PRIVACY_MODEL.md) and
[MODERNIZATION_PLAN.md](MODERNIZATION_PLAN.md).
