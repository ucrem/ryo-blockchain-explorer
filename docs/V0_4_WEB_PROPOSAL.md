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
network-wide synchronization or freshly mined-block observation. SSE and live
pool/network monitoring remain later milestones.

A server-only API client uses a configured fixed upstream origin, deadlines,
response size bounds, no redirect following and no persistent caching. A
same-origin read-only adapter exposes only the existing public v2 routes; it
never proxies arbitrary URLs, private-key inputs or transaction submission.
Runtime checks preserve canonical uint64 strings. No wallet balance, peer count,
chain synchronization, network-wide hashrate or emission estimate is invented.

Affected files are `web/`, build/version metadata, README, build/testing/server
and privacy documentation, release notes, changelog and the milestone plan.
The native core pin, LMDB interpretation, legacy contracts and API v2 schemas
remain compatible; product version metadata advances to 0.4.0.

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
