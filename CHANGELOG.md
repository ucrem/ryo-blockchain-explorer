# Changelog

Modernization releases follow Semantic Versioning and Keep a Changelog categories.
Upstream history remains preserved; it is not assigned modernization versions
retroactively.

## [Unreleased]

## [0.4.0] - 2026-10-05

### Added

- Official Ryo wordmark and favicon, website day/night palette, bundled
  Inter/Montserrat typography and branding provenance.

- v0.4 server-first Next.js/TypeScript/Tailwind/shadcn/ui dashboard with bundled
  fonts, light/dark themes, mobile navigation and a developer API guide.
- Native-reader chain status, exact quantities, recent block pages, reorg recovery
  and a truthful observed-header interval chart.
- Full-width desktop block and confirmed-transaction tables, stacking on mobile,
  with exact fees, labeled coinbase and a bounded native transaction preview.
- Ten-second live tip observation on latest-block pages, with pause, hidden-tab
  suspension, retained browser state and retry after reader outages.
- Readable block/transaction detail pages and global public height/hash search,
  with exact fees, paginated rows and privacy-safe RingCT/input/output views.
- Contextual explanations of structured/native JSON, hexadecimal serialization,
  exact integer strings, hidden amounts and formatting.
- Embedded formatted JSON/raw views retaining the explorer layout, with exact
  original tokens, format toggles, bounded previews and verbatim downloads.
- Bounded same-origin read-only API access preserving raw native numeric tokens,
  plus unit/browser/accessibility and real native end-to-end smoke checks.

### Changed

- Product metadata advances to 0.4.0; supported native/legacy route shapes and
  native Ryo interpretation remain compatible.
- All changes reach main through PRs. Owner merging or explicit conversational
  merge authorization is required; GitHub reviews/CI checks are not mandatory.
- Full native CI runs manually only, with no automatic PR/push build.

### Upgrade Notes

- The frontend adds Node.js 24 LTS and a separate process. Run `npm ci`,
  `npm run build` and `npm run start` in `web/`; enable native API v2 and configure
  the server-only `RYO_API_URL`. See `docs/WEB.md`.

### Known Issues

- Address search, pool listing, SSE, advanced analytics and verification
  remain later milestones. Full-chain/deployment
  capacity is not established. The developer-only ESLint glob dependency has
  the unpatched braces advisory documented in `docs/V0_4_VALIDATION.md`.

## [0.3.0] - 2026-10-04

### Added

- Independently enabled read-only API v2 for native-reader chain state, anchored
  recent-block pagination, block/transaction detail and native raw JSON/hex.
- OpenAPI 3.1.1 contract bundled into the HTTP executable and available through
  `/api/v2/openapi.json`, plus public examples and actual-response schema checks.
- Native tip/difficulty snapshots and bounded header pagination, including
  explicit errors after a pagination anchor is removed or replaced.
- Historical/RingCT/pool/native-extra/ring-reference contract tests, independent
  API flag combinations and exact integer/privacy regression checks.

### Changed

- API v2 uses decimal strings for uint64 quantities, exact native Ryo atomic
  units, null for hidden output amounts, and explicit confirmed/mempool inclusion.
- A concrete router keeps legacy JSON and v2 serialization separate while
  preserving supported legacy response and error contracts.

### Security

- V2 omits node-local mempool receive/relay times and uses bounded public query
  parameters and concise errors. Ring candidates never identify a real spend.
- Raw native bytes are bounded before hex expansion; existing connection/query/
  parsing/deadline and serialized-response limits remain enforced.

### Upgrade Notes

- The Ryo core pin and compatibility patch are unchanged from v0.2. Rebuild the
  explorer; HTTP build/tests add `python3-yaml` and `python3-jsonschema` development
  packages. Neither package is needed to run the compiled server.
- Add `--enable-api-v2`; keep `--enable-json-api` to serve the legacy subset too.
  Both default to off. Legacy packed API version remains 65537.
- Raw `native_json` keeps Ryo's original number conventions and requires an
  integer-preserving JSON client; the normalized DTO precision guarantee applies
  to the surrounding documented fields. See `docs/API_V2.md`.

### Known Issues

- This is a progressive API subset: pool listing, search, emission, tools, SSE
  and the Next.js frontend remain later milestones.
- Full-chain capacity, live mapping growth, external-writer stress, broader
  historical coverage and positive testnet/stagenet fixtures remain follow-up
  work. Synthetic storage/extra/ring cases do not validate consensus or signatures.

## [0.2.0] - 2026-10-04

### Added

- Optional read-only native query diagnostics with disposable offline execution
  and a documented genesis-only measurement reference.
- Concrete block/transaction services with native metadata, owned snapshot
  results, and explicit query failures.
- A separate opt-in read-only HTTP executable for legacy block, transaction,
  raw, and version JSON routes, plus health.
- Public native RingCT and historical block blobs, isolated pool/confirmation/
  reorg tests, and real HTTP compatibility, limit, concurrency, and shutdown checks.

### Fixed

- MicroCore passes the correct Ryo `DBF_RDONLY` flag, rather than raw LMDB flags,
  and native read-only assertions protect the actual open mode.
- Native shutdown releases its internal worker/DB ownership; the pinned core
  patch skips sync of read-only environments to prevent close permission failures.

### Security

- The server validates network genesis, defaults to loopback, and bounds HTTP
  parsing, connections, queued queries, response size, and client deadlines.
- Pool transaction timestamps omit node-local receive/relay information;
  secret-key input, submission, and peer/propagation endpoints are not exposed.

### Upgrade Notes

- Rebuild the pinned core with the updated compatibility patch, then opt in with
  `RYO_BUILD_HTTP=ON`. JSON endpoints require `--enable-json-api`.
- Successful supported legacy shapes are preserved. Pool timestamps are zero/
  epoch; temporary native/resource failures use HTTP 503. See `docs/HTTP_SERVER.md`.

### Known Issues

- This is an incremental API subset without the old website or new frontend.
  API v2/OpenAPI and Next.js remain later milestones.
- Full-chain capacity, mapping-growth recovery, external-writer load/reorg stress,
  broader historical/ring fixtures, and positive testnet/stagenet coverage remain
  follow-up work. Synthetic storage transitions are not consensus validation.

## [0.1.0] - 2026-10-04

### Added

- Selected native C++ implementations for LMDB, Ryo parsing/metadata, daemon RPC,
  mempool/network snapshots, and existing emission calculation.
- A CMake static-library build with pinned official Ryo dependencies and isolated
  Ubuntu 24.04 compiler compatibility fixes.
- Real public Ryo fixtures, native parser/hash checks, and disposable offline
  integration tests for the imported implementations.
- Ubuntu 24.04 CI, discovery/API/privacy documentation, import provenance, roadmap,
  and public contributor/security/release guidance.

### Changed

- The active repository is a native foundation for the new project. The old HTTP
  server, website/templates/browser assets, and unrelated vendored libraries are
  excluded. Legacy feature/API inventories remain reference documentation.

### Fixed

- Required native Ryo modern compiler/library compatibility and explicit C++14
  selection, without changing cryptographic or consensus algorithms.

### Known Issues

- No HTTP explorer or frontend is currently provided by this foundation.
- Historical/browser parity, full-chain/reorg/performance, checkpoint behavior,
  and testnet/stagenet coverage remain follow-up work.
- v0.1.0 follows the user-selected native-only foundation scope; HTTP services
  and frontend delivery remain later milestones.

[0.1.0]: https://github.com/ucrem/ryo-blockchain-explorer/releases/tag/v0.1.0
[0.2.0]: https://github.com/ucrem/ryo-blockchain-explorer/releases/tag/v0.2.0
