# Source attribution

The selected native sources in `src/` originate from the official
[Ryo blockchain explorer](https://github.com/ryo-currency/ryo-blockchain-explorer)
at commit `2e334724f9921e813e787b09f9365d53020a6286`. The upstream BSD 3-Clause
license is retained in [LICENSE](LICENSE), together with source author notices.
The import includes only native LMDB, utility, RPC, mempool, and emission code.
The previous website, Crow server, mstch renderer, templates, browser crypto,
images, and upstream build-helper collection are not included in the active tree.

`src/services/TransactionMetadata.cpp` and `api/LegacyJson.cpp` selectively
extract the native calculations and legacy JSON field definitions from that
commit's `src/page.h` (`get_tx_details`, `get_tx_json`, and block/transaction JSON
handlers). The BSD license and original source attribution continue to apply.
The full HTML renderer is not imported. Boost.Beast/Asio comes from the existing
system Boost dependency; no new HTTP library is vendored.

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

## v0.4 web dependencies

The Next.js/React/TypeScript/Tailwind/Radix/Lucide and related npm dependencies
are resolved through `web/package-lock.json`, with upstream license notices in
their packages. The four shadcn/ui Radix Nova source components in
`web/src/components/ui/` were installed with CLI 4.21.2; their MIT license is
retained in [web/LICENSE.shadcn.txt](web/LICENSE.shadcn.txt).

Bundled Inter Variable, Montserrat Variable and IBM Plex Mono fonts are supplied
by Fontsource 5.3.0 under the SIL Open Font License 1.1. Their notices are retained
in `web/public/licenses/` and served under `/licenses/`. Inter and Montserrat are
also used by the official Ryo website. IBM Plex Mono remains the technical-data
font. The official site's Neue Kaine display font is not redistributed here.

The official Ryo wordmark, favicon and decorative artwork replace the initial
project-authored mark. See [web branding provenance](docs/WEB_BRANDING.md) for
sources and permitted use; these brand assets are not relicensed as project code.
No legacy explorer template or browser script is copied.
