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
Concrete block/transaction services now selectively reuse the metadata
calculations from upstream `get_tx_details`; the separate JSON adapter reuses
field definitions from its JSON handlers. The full `page.h` is not imported.
MicroCore fixes the Ryo DB flag interface, validates the selected network for the
HTTP application, and stops native DB/worker ownership through native teardown.
There are no empty service classes or new cryptographic implementations.
Linking alone starts no process or worker; native Blockchain initialization
retains its internal worker. No legacy monitor is automatically started.

The opt-in `ryo_explorer_http` is a new bounded Boost.Beast/Asio transport for
the implemented read-only legacy JSON subset. It is not the removed Crow website.
See [HTTP_SERVER.md](HTTP_SERVER.md) for actual routes, compatibility differences,
configuration, and validation limits. No frontend or old templates are included.

Excluded: `main.cpp`, `page.h`, `CmdLineOptions`, Crow, mstch, cache templates,
all legacy HTML/JavaScript/styles/images, generated version templates, unrelated
upstream CMake helpers, and the old README. The official Ryo core itself remains
an external dependency. Source provenance and notices are in
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

The requested architecture/feature/API inventories describe the **upstream
reference**; the currently implemented subset is listed separately. Ryo logic
still coupled inside upstream `page.h` is brought over in focused, tested
increments as the corresponding services are implemented. Other capabilities
are inventoried rather than silently declared removed from the product roadmap.
The original complete history remains preserved; the imported website is absent
from the current project tree. Copied topic branches are not integration branches.

Legacy RPC submission and sensitive utility functions remain internal native
code. Nothing exposes them as public endpoints. Existing pool timestamps and
emission checkpoint limitations require review before any future API exposes
their data. Read [PRIVACY_MODEL.md](PRIVACY_MODEL.md) and
[MODERNIZATION_PLAN.md](MODERNIZATION_PLAN.md).
