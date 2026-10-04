# Source attribution

The selected native sources in `src/` originate from the official
[Ryo blockchain explorer](https://github.com/ryo-currency/ryo-blockchain-explorer)
at commit `2e334724f9921e813e787b09f9365d53020a6286`. The upstream BSD 3-Clause
license is retained in [LICENSE](LICENSE), together with source author notices.
The import includes only native LMDB, utility, RPC, mempool, and emission code.
The previous website, Crow server, mstch renderer, templates, browser crypto,
images, and upstream build-helper collection are not included in the active tree.

`third_party/json/json.hpp` is the upstream-vendored nlohmann JSON header. Its
MIT license and copyright notice remain embedded in the file. It is required
by the imported native utility code; no other upstream vendored library is copied.

The official Ryo core is a separately cloned, pinned build dependency; it is not
vendored in this repository. Its source and per-file licenses remain applicable.
The core's fmt sources are compiled from that checkout for native logging and
formatting. Preserve their notices when distributing linked artifacts. The
compatibility patch does not change consensus or cryptographic algorithms.

This records provenance of the selected import, not a complete distribution
license audit. Check linked dependencies before distributing binary packages.
