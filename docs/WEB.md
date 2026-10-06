# v0.4 web application

The first website is a server-first Next.js application in `web/`. It is an
independent modern implementation, with no imported legacy templates or browser
crypto. It provides an overview, block and transaction details, public identifier
search and a developer API guide.

## What is available

- The menu stays at the top during page scrolling. The single global search moves
  into it only after its original page location leaves the visible area and
  returns when scrolling back. Draft, input focus/caret and page position are
  preserved. Desktop and mobile menus retain navigation/theme controls; a
  reserved page slot prevents content jumps. Search still submits GET only.
- `/`: native-reader network and chain status, exact tip height/difficulty,
  configured block target, recent block summaries and anchored earlier pages.
- Full-width desktop layout pairs the block and confirmed-transaction tables;
  below 1,200 px they stack, with keyboard-accessible local table scrolling.
  The TX preview contains at most twenty transactions from the displayed block
  window, newest blocks first and native transaction order within each block.
  Coinbase is explicitly labeled and has no transaction fee. Ordinary fees
  preserve all nine RYO decimals; timestamps are those of the containing block.
  Coinbase-only headers need no detail lookup. At most four block-detail reads
  run concurrently with the existing five-second bounds; the preview can have
  fewer than twenty rows. Complete lists remain on block pages. Every detail
  must match the displayed block hash, height, network, time and coinbase.
  Failed or mismatched reads show an unavailable state, rather than empty data.
  The preview streams separately, allowing the block table to appear first.
- Latest-block pages watch the native reader every ten seconds through the
  same-origin network endpoint. A changed tip hash or network refreshes Server
  Components while preserving browser state. Live updates can be paused; hidden
  tabs do not poll, reads have a five-second deadline and failures retry while
  retaining the displayed data. Earlier cursor pages stay anchored and do not poll.
  This observes blocks entering the local reader, including historical sync;
  it does not establish that a block was just mined or the node is synchronized.
  A changed tip refreshes both block and transaction tables together. The live
  controls show the UTC time and local block height of the last successful check.
- A block-interval bar chart with block number on X and the exact signed timestamp
  difference from its predecessor, in seconds, on Y. Period controls select 1h,
  24h, 7d or 30d, ending at the latest available block; its height/date are shown
  explicitly, including while the node is syncing historical blocks. The chart
  reads a native window independently of the twenty-row block table. Every
  returned point is plotted without downsampling, with labeled axes, rounded
  grid ticks, pointer inspection, arrow/Home/End keyboard inspection directly
  on the focused chart and a block-detail link.
  Missing/genesis timestamps are omitted; negative and zero differences remain
  intact. The default hour labels every returned block in ascending height,
  with one bar per interval and the newest at the right edge. An overflowing
  chart starts at the right and scrolls to the newest block on live refresh;
  hovering, tapping or keyboard inspection holds the displayed native window
  and selected block while the dashboard continues receiving new data. A
  top-right "Back to live" button returns to the latest window and right edge.
  Native scrollbars are hidden and the former range input is removed; horizontal
  gestures and keyboard inspection remain available. Switching periods resumes
  following. Reduced-motion preferences disable smooth scrolling. Longer periods
  keep sparse axis labels while plotting every bar. No target reference line is shown.
  A single usable interval can be displayed. The whole-second signed mean
  truncates division.
  The selected period persists across live refresh; changed anchors reload it.
  The native read scans at most 50,000 consecutive timestamps in one snapshot,
  using a fixed period allowlist and optional block-hash anchor. Available
  coverage is returned and a scan bound within the period is labeled partial.
  Nonmonotonic timestamps are filtered by the newer block's time without a
  timestamp binary search. No new database, index or persistent cache is used.
- `/developers`: public route guide, exact units and privacy semantics, examples
  and a link to the backend's bundled OpenAPI JSON.
- `/blocks/{height-or-hash}`: readable header details, previous/next block links,
  coinbase and transaction links. The transaction table has 50 rows per page.
- `/transactions/{hash}`: inclusion/confirmations, exact fees, input key images,
  candidate ring metadata, public output keys and explicit hidden RingCT amounts.
  Outputs have 50 rows per page; inputs have 10. Each input shows up to 32 ring
  candidates and relative offsets, with a clear full-JSON link for larger lists.
  Advanced metadata shows up to 32 additional keys and 4,096 extra-hex characters;
  complete native DTO and raw views remain separately available.
- A global GET search form resolves block heights and public block/transaction
  hashes. Decimal heights are normalized exactly within uint64 bounds; hash case
  is normalized. Hash lookups query both existing native detail routes, with
  distinct absent-data and unavailable-reader states. No new native index is used.
- JSON and raw buttons open `/json/…` inside the explorer's normal layout, with
  a formatted response panel, an Original toggle and verbatim download. Network,
  recent-block and OpenAPI examples use the same viewer. Explicit API-endpoint
  links remain available for programmatic responses at `/api/v2/…`.
- Responsive desktop/mobile navigation, persistent light/dark/system theme,
  keyboard skip link, focus indicators, bounded horizontal table/code scrolling,
  accessible SVG description and truthful unavailable/reorg/genesis states.

There is no mempool listing, address search, SSE, analytics store,
private-key verification, balance/history inference or transaction submission.
The UI has no placeholder navigation advertising those capabilities.

## Install and run on native Linux

Use Node.js 24 LTS (tested 24.21.0) and npm (tested 11.19.0). The lockfile pins the
resolved dependency tree. Next.js 16.3.8, React 19.2.8, TypeScript 5.9.3 and
Tailwind 4.3.3 are recorded in `web/package.json`. shadcn/ui source components were
installed with CLI 4.21.2 using the Radix Nova registry; its MIT notice is retained.
Inter, Montserrat and IBM Plex Mono are bundled from Fontsource, with no runtime
font CDN. The UI uses the official Ryo wordmark, favicon and day/night palette;
see [branding provenance](WEB_BRANDING.md).

```bash
cd web
npm ci
cp .env.example .env.local
NEXT_TELEMETRY_DISABLED=1 npm run dev -- --hostname 127.0.0.1
```

Start the [native HTTP executable](HTTP_SERVER.md) separately with API v2 enabled:

```bash
build/native/ryo_explorer_http --bc-path /path/to/ryo/lmdb02 --enable-api-v2
```

Development defaults to port 3000. The frontend can build without a running API;
chain data is read when a visitor requests a dashboard page. For production:

```bash
cd web
NEXT_TELEMETRY_DISABLED=1 npm run build
RYO_API_URL=http://127.0.0.1:8081 NEXT_TELEMETRY_DISABLED=1 \
  npm run start -- --hostname 127.0.0.1 --port 3000
```

A normal Node server is required; a static export cannot read the live native API.
No Docker, external database, queue, cache service or managed host is required.
Use the site's process and a TLS reverse proxy for a public deployment; this
release does not install a service or deploy a public instance. Bound public
traffic at the proxy to the operator's measured capacity. Multi-instance Node
processes each have their own request bound; full-chain/load capacity remains
unverified. Keep the internal native API off the public interface unless public
API exposure is explicitly configured by the operator.

## Configuration and public adapter

`RYO_API_URL` is a server-only HTTP(S) origin, default `http://127.0.0.1:8081`.
It accepts no credentials, path prefix, query or fragment. It is not a
`NEXT_PUBLIC_` variable, and the browser receives no internal-origin setting.
The operator controls this fixed trusted origin; visitors cannot select it.
`NEXT_TELEMETRY_DISABLED=1` disables Next.js development/build telemetry.

The adapter only forwards GETs to the shipped native API v2 route shapes.
Only block-list requests accept bounded `limit`/`cursor`; unknown, duplicate and
secret-bearing parameters are rejected before forwarding. Requests do not
forward browser cookies, authorization or arbitrary headers. Redirects are not
followed. No legacy key-bearing or write endpoint is exposed.

A maximum of 16 upstream reads per Node process is enforced without a queue.
Each read has a five-second deadline covering headers and body, an eight-MiB
response limit and a required JSON content type. Unexpected failures return a
concise 503 rather than an internal URL, configuration or exception. Proxy
responses preserve native JSON text verbatim: raw integer tokens are not passed
through `JSON.parse`/`JSON.stringify`. The dashboard separately validates its
network/list DTOs and uses BigInt for exact quantities and calculations.

Native errors/statuses on forwarded public routes are retained. Invalid adapter
requests return 400. Next.js rejects unsupported HTTP methods with 405. The
adapter is not a replacement for the native OpenAPI implementation; it is a
bounded same-origin access path for the website's supported read-only subset.

Both native reads and proxy responses use no-store. Dashboard navigation and
Refresh use a full page request, with no client prefetch or persistent cache.
Network/list reads are independent snapshots and may have different heights.
A replaced pagination anchor shows a restart link; appended blocks do not shift
an anchored page. If the two reads report different networks, the block list is
withheld and a refresh error is shown. Dashboard error states remain an HTTP 200
HTML page with explicit alerts; the API preserves its documented error statuses.

No analytics/tracker, remote icon/image/script/font CDN, browser chain fetch or
private-key handling is introduced. Theme selection is stored locally by
`next-themes`. Site and reverse-proxy access logging is operator controlled;
these settings are not a claim that the hosting infrastructure keeps no logs.

## Validation

```bash
cd web
npm run lint
npm run typecheck
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
npx playwright install --with-deps chromium
NEXT_TELEMETRY_DISABLED=1 npm run test:e2e
npm audit --omit=dev
```

The browser suite launches the production frontend on port 3100 and an isolated
fixture server on 3101. It uses synthetic, disclosed headers only in tests;
production never imports the fixture server or falls back to its data. It checks
exact values above JavaScript's safe integer range, pagination/reorg/outage/genesis
behavior, light/dark theme persistence, keyboard access, mobile overflow,
accessibility and browser requests staying on the website origin. Detail/search
scenarios also cover HTML navigation, exact fees, hidden amounts, mempool state,
row pagination, lookup validation and partial reader failures.

`tests/native-smoke.ts` additionally runs against an already started production
frontend connected to a disposable genesis-only native API:

```bash
cd web
NATIVE_SMOKE_URL=http://127.0.0.1:3112 npx tsx tests/native-smoke.ts
```

This smoke requires a fresh offline genesis fixture; do not point it at a public
chain instance. It checks the known native genesis hash, actual version, raw
serialized bytes, bundled OpenAPI and absence of browser errors/external origins.
See [v0.4 validation evidence](V0_4_VALIDATION.md). The full native Action remains
manual-only, and no new automatic frontend build Action is added.


## Detail and search behavior

Only public block heights or 64-character hexadecimal hashes are accepted. Search
requires explicit form submission; there are no keystroke requests or browser
chain reads. Duplicate query fields, target URLs, unsupported fields and invalid
identifiers are rejected before native lookup. Search GET parameters are visible
in browser history: never enter wallet secrets. Detail pagination accepts only
bounded canonical page numbers. Block pages use a hash for table-page navigation
so a different block at the same height does not silently replace that view.

Typed detail responses are checked before display: identifiers match the requested
resource, block transaction count/coinbase order is consistent, transaction counts
match arrays, inclusion is consistent with the reader height, and hidden RingCT
amounts remain null. Fees and public amounts use BigInt with nine decimal RYO
places. Input candidates do not identify the real spend; output keys do not
identify recipient addresses or balances. The unlock field is shown as native
metadata, not interpreted as a spendability guarantee.

Valid resources absent from the reader render route-specific not-found pages;
Next.js can return HTTP 200 for errors after streaming has begun. Other HTML
validation/unavailable messages also use the framework's rendered response. The
public API preserves its native error status codes. There is no persistent search
cache; known mempool transaction lookup is not a full live mempool feed.


## Embedded JSON viewer

Explanations appear only after opening the chosen JSON/raw view; block and
transaction detail pages have no introductory comparison panel. Each selected
JSON view explains its fields and purpose, including
`native_json`, serialized `blob_hex`, exact integer strings, hidden RingCT amounts
and the difference between formatting and changing values. The formatting note
follows the selected Formatted or Original mode.

The server reads only the same public API allowlist through the existing bounded
client. Unsupported paths and duplicate/secret query fields are rejected before
lookup. The formatted viewer validates JSON grammar and inserts whitespace around
the original tokens; it never decodes/re-encodes numeric values or strings.
Integer digits, negative zero, decimal/exponent spelling, key order, duplicate
keys and escape sequences remain unchanged. React renders JSON as escaped text,
without HTML insertion. Formatting/original toggles make no API request.

The embedded preview accepts up to 1,048,576 source UTF-16 code units, 64 levels
of nesting and 4,194,304 formatted code units. Larger/deeper responses show a
clear download fallback inside the layout. Source reads retain the existing
8-MiB network body limit. The download and explicit endpoint link retain the
original API response bytes and native HTTP statuses. JSON panels scroll with
keyboard focus, including on mobile, and keep the selected site theme.
