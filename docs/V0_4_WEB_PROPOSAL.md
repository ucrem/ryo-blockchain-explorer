# v0.4.0: server-first dashboard foundation

Status: implementation authorized by the owner on 2026-10-05 after the v0.4
roadmap was presented. The owner requested completion of this release. Integration
continues through a pull request; agent merging requires explicit conversational
merge authorization. This document records the concrete implementation scope.

## Current behavior and problem

v0.3 ships native read-only block/transaction services, API v2 and bundled
OpenAPI, with no website. Operators and visitors need a usable dashboard without
reintroducing the legacy templates, browser cryptography or a second data store.

## Result and affected components

Add a real `web/` Next.js application with TypeScript, Tailwind and shadcn/ui.
Server Components read the existing native API. Small client components handle
theme selection, mobile navigation, JSON formatting and live tip observation.
The initial product provides a
responsive light/dark dashboard, native-reader chain status, exact heights and
difficulty, recent blocks, bounded cursor pagination, an observed block-interval
chart when enough real samples exist, API/raw links and a developer guide.
The owner's 2026-10-05 usability request additionally includes readable block and
transaction pages and a visible public height/hash search. These reuse the
existing native detail endpoints; no native architecture or schema change is
introduced. Dedicated UI links open HTML, with JSON/raw as additional views
inside the explorer layout. Token-preserving formatting and an Original toggle
keep native quantities intact; explicit API endpoints and downloads remain available.
The owner's subsequent synchronization request adds ten-second same-origin tip
polling on the latest dashboard, with pause, hidden-tab suspension, bounded reads
and Server Component refresh on hash/network changes. Existing cursor pages stay
anchored. A limited real mainnet sync validates reader updates without claiming
network-wide synchronization or freshly mined-block observation. SSE remains a later milestone; the public pool extension is documented below.
The owner's layout request adds full-width desktop block/confirmed-transaction
tables side by side, stacking on smaller screens. A bounded server-rendered
transaction preview reuses existing headers and block details, includes labeled
coinbase, preserves exact ordinary fees and follows live tip refresh. The transaction preview adds no native endpoint, index, pool listing or browser
cryptography.
The owner's chart request replaces the twenty-header sparkline with labeled
block-number/seconds axes and 1h/24h/7d/30d controls. An additive API v2 route on
the existing BlockService reads bounded native timestamps in one snapshot, with
an optional block-hash anchor and explicit coverage. It preserves signed native
differences and remains independent of pagination. The core pin, read-only LMDB
architecture and existing route contracts remain compatible; no extra store is
introduced. Client inspection and selected periods persist across live refresh.

A server-only API client uses a configured fixed upstream origin, deadlines,
response size bounds, no redirect following and no persistent chain caching. A
same-origin read-only adapter exposes only the existing public v2 routes; it
never proxies arbitrary URLs, private-key inputs or transaction submission.
Runtime checks preserve canonical uint64 strings. No wallet balance or
network-wide consensus/synchronization is inferred.

Affected files are `web/`, build/version metadata, README, build/testing/server
and privacy documentation, release notes, changelog and the milestone plan.
The native core pin, LMDB interpretation and legacy contracts are retained.
Product version metadata advances to 0.4.0; additive v2 schema changes are
documented below.

## Reference-driven overview extension

The owner's 2026-10-06 request to compare `explorer.ryo.tools` and add key missing
information extends the dashboard with native issued supply, tip coinbase
payout, last-100 median block size, confirmed ordinary count and relayable local
pool count/size. The existing `NetworkService` supplies an optional additive
`overview` object; older DTOs remain accepted by the UI and legacy fields stay
unchanged. Closed-schema clients must update the bundled contract. The core pin
and read-only LMDB architecture remain unchanged, with bounded native reads and
native dev-fund helpers rather than reimplemented emission rules.

Optional server-only daemon GET `/get_info` supplies public sync/peer/next-block
metrics, distinguished from confirmed reader data. It is not required for chain
operation, exposes no browser RPC route and has fixed-origin/time/body/capacity
bounds. A marked public observation may survive a failed read for at most 60
seconds; no persistent store is introduced. TX previews reuse existing bounded
summary reads for size, input/output counts and fee/KiB. The
[comparison report](DASHBOARD_REFERENCE_AUDIT.md) records definitions, tests,
version/height differences and missing pool listing/tools. These additions do
not authorize transaction writes, secret handling or a core dependency upgrade.

## Migration and risks

Node.js 24 LTS adds a separately run frontend process. Native Linux remains
supported; Docker, PostgreSQL, Redis, external asset CDNs and analytics trackers
are not required. Operators enable API v2 and configure a server-only upstream
origin. The browser accesses the website origin rather than the internal API.

Independent network/list requests can observe different chain heights. Pagination
anchors retain the native reorg rules; a replaced anchor prompts a restart.
Backend outages, invalid responses, empty chart windows, genesis timestamps,
integer precision, unsafe proxy targets, hydration, keyboard interaction and
small screens require explicit verification. No full-chain production-capacity
claim follows from the offline fixtures.

## Acceptance checks

- Lockfile installation, lint, TypeScript checks, production build and dependency
  audit; the full native GitHub Action remains manual-only.
- Meaningful client/proxy tests for malformed data, uint64 precision, upstream
  failure/timeout/redirect/size bounds, allowed routes and rejected secret inputs.
- Browser checks against an isolated fixture backend for theme persistence,
  mobile navigation, pagination/reorg/outage behavior, no horizontal overflow,
  keyboard access and accessibility violations in light/dark/mobile layouts.
- Browser detail/search checks cover HTML navigation, native identifier lookup,
  exact fees, hidden amounts, mempool state, bounded row pagination and failures.
- Production frontend reads a real offline native genesis API; build metadata
  changes pass the existing native and legacy/HTTP test suites.
- Document supported operation, privacy limits, migration and evidence before an
  annotated tag and GitHub Release. Publish only from an owner-authorized merged
  commit, without direct pushes to `main` or automatic merging.

## Public mempool and inspection tools extension

The owner's follow-up request on 2026-10-06 explicitly adds the remaining pool
listing, ring/payment-ID summaries and dedicated verification tools. A dedicated
`/mempool` page lists every relayable local pool entry through bounded pages,
with fees, serialized size, input/output counts and native ring/payment-ID
metadata. Native TransactionService reads at most 10,000 pool metadata entries
and 100 transaction blobs per page. Deterministic hash order and a native hash
of membership invalidate stale cursors with HTTP 409; no observation timestamps,
peer records, background snapshot store or confirmed-chain scan are introduced.
The browser checks membership every ten seconds with pause/hidden-tab handling.

An optional additive `inspection` object enriches existing transaction summaries
using native input offset counts and native tx-extra parsing, including uniform
payment-ID presence. Old responses remain accepted as unknown metadata.

Dedicated `/tools` public checks reuse native Ryo functions: confirmed-chain
key-image membership, output-key membership within an identified transaction,
and address format/network decoding. GET routes accept only bounded public
identifiers; they never accept wallet exports, private view/spend/transaction
keys or infer balances, output ownership or a real ring member. A negative
key-image result is limited to the reader's confirmed chain, not proof of an
unspent wallet or pool acceptance. Output membership is not recipient proof.
These tools do not claim parity with secret-based legacy wallet-export checks.

Existing services, fixed server-only adapter, native LMDB/core pin and API/legacy
fields are retained. Additive routes/schemas, closed-validator migration,
reorg/pool mutation behavior and explicit unknown states need native fixture,
HTTP, schema and production browser checks. All changes remain on the open PR;
mainnet sync continues and the full native workflow remains manual-only.

## Owner-authorized local pool receive time

On 2026-10-06 the owner requested a timestamp/age in the pool with a tooltip
explaining that it belongs to this node. This explicitly refines the previous
receive-time exclusion for `/mempool` only. An optional decimal-string/null
`local_received_timestamp_unix` is added to pool rows from native metadata;
ordinary transaction inclusion, relay times and peer/source data stay unchanged.
The UI explains creation/confirmation/network-first-seen differences, supports
hover/focus/tap, displays unknown values truthfully and updates relative age
without changing pool pagination order or introducing a propagation archive.
