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
- `/`: native-reader chain status, exact tip height/difficulty, configured block
  target, estimated hashrate, issued supply including the native dev fund,
  latest coinbase payout including fees, median size over up to 100 blocks,
  confirmed ordinary transaction count and bounded relayable local pool metrics.
  Optional node status separately shows synchronization, peers and next-block
  difficulty/hashrate. See the [reference comparison](DASHBOARD_REFERENCE_AUDIT.md)
  for definitions and remaining coverage. Recent blocks and earlier pages remain.
- Full-width desktop layout pairs the block and confirmed-transaction tables;
  below 1,200 px they stack, with keyboard-accessible local table scrolling.
  The TX preview contains at most twenty transactions from the displayed block
  window, newest blocks first and native transaction order within each block.
  Coinbase is explicitly labeled and has no transaction fee. Ordinary fees
  preserve all nine RYO decimals; timestamps are those of the containing block.
  Native input/output counts and transaction size appear when already supplied
  by block-detail reads. Header-only coinbase rows show unknown metadata as a
  dash. Fee per KiB uses exactly 1,024 bytes and truncates to an atomic unit.
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
  A changed tip refreshes both block and transaction tables together. Changed
  local pool count/size also refreshes the dashboard; membership changes with
  the same count/size do not trigger a refresh. The live
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
  with one bar per interval and the newest at the right edge. The plot fits its
  container at a fixed 440-pixel height, displaying every returned bar instead
  of a clipped horizontal subset. Hour labels are vertical and the native point
  count is shown explicitly as "N blocks shown". Period counts can legitimately
  change: a time window contains its actual intervals, not a fixed or estimated
  number of blocks. Hovering, tapping or keyboard inspection holds the displayed
  native window and selected block while the dashboard receives new data. A
  top-right "Back to live" button selects the latest block and resumes following.
  No horizontal scrollbar or range input is used. Switching periods resumes
  following. Reduced-motion preferences disable slide animation. Longer periods
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

There is no address-to-balance/history search, SSE, analytics store,
private-key verification, wallet-export checking or transaction submission.
The UI has no placeholder navigation advertising those capabilities.

## Live node health and error details

The node panel now checks `/api/node-status?network=mainnet` every ten seconds
independently of block/table refresh. It works on earlier dashboard pages and
continues while table updates are paused. Hidden tabs suspend checks; visibility
restores them. Requests have the existing five-second/64-KiB RPC bounds and no
redirects or browser-controlled upstream URL. The website endpoint accepts only
one optional `network` selector and is separate from native API v2.

A recent recognized log failure displays a red "Synchronization error · retrying"
notice. "Error details" reveals the native failure category, last error UTC,
last stored block and (for transaction failures) the logged blob identifier,
explicitly distinguished from a confirmed transaction hash. The bounded adapter
recognizes the pinned daemon's transaction/object-response and block-verification
failure messages; it does not classify every possible daemon error. No raw log,
peer address, internal path or arbitrary exception text is returned.

To enable details, configure server-only `RYO_DAEMON_LOG_PATH` as the absolute
path of the same daemon's regular log file and `RYO_DAEMON_LOG_UTC_OFFSET` as its
log timestamp offset, such as `+00:00`. The daemon writes local-time log headers;
use UTC for stable operation or update the fixed offset if daylight saving
changes. The application reads at most the last 64 KiB, ignores unfinished
lines and safely reports missing/unreadable/invalid configuration. There is no
persistent log archive, background whole-file scan or daemon write operation.

Only errors from the previous two minutes are current. Observed chain progress
clears older errors; ready/offline states take precedence. Separately, an unchanged
height/hash for two minutes while a higher target is reported produces
"Synchronization stalled", without inventing a validation failure. This timer
starts with observations in the current web process; it is not daemon uptime or
a network mining-rate measurement. Details unavailable/disabled are labeled.
RPC failures retain a marked last observation for at most 60 seconds, then show
unavailable. Existing chain data and chart inspection remain usable.

## Mempool and public inspection tools

`/mempool` lists relayable transactions held by this node, with 50 rows per page,
exact fees/fee per KiB, native size, input/output counts, ring size and payment-ID
presence. All entries can be traversed within the native 10,000-entry bound;
exceeding it produces unavailable, rather than a silently partial list. Native
hash order gives stable pagination independently of local receive time. Relay
timestamps remain excluded.
A membership digest binds each cursor; a changed pool returns HTTP 409 with a
restart link. Live checks every ten seconds compare membership, including
replacements with the same count/size, and return to the first page on change.
Updates can be paused; hidden tabs do not make pool reads. Failures retain the
visible page and retry. Inspection reads preserve hidden amounts and do-not-relay
exclusion. An empty pool is an explicit local observation, not a network claim.

At the owner's request, a "Seen by this node · UTC" column shows native pool
receive time and a relative age. Hover, keyboard focus or tap opens a tooltip
explaining that other nodes may observe different times and that sync can record
a downloaded historical TX. It is not creation or confirmation time. Age updates
every ten seconds in visible tabs from the stored timestamp; missing/older-server
values show a dash and a clock ahead of the browser shows "Clock difference".
Membership still controls page refresh; manual refresh rereads native metadata.
No relay timestamp or peer/source record is added.

Transaction summaries on the dashboard, block pages and pool now show an
optional native `inspection` object. Ring size counts every candidate per input,
including the real member without identifying it; mixed historical ring sizes
show min–max. Native tx-extra parsing distinguishes legacy, encrypted short and
uniform payment-ID presence. Uniform/encrypted payloads are not decrypted.
Old responses and header-only summaries show unavailable fields as a dash.

`/tools` provides confirmed-chain key-image membership, output-key membership
within an identified transaction and native public-address inspection. Forms
accept public identifiers only. Transaction detail links prefill its input key
images and output keys. Results stay in the explorer layout, with contextual
meaning, native reader provenance and embedded JSON links. Address inspection
recognizes the native standard/integrated/subaddress/kurz formats and reports
network mismatch separately; invalid checksum/format has an explicit result.
These checks do not request private keys, accept wallet exports, disclose hidden
amounts, prove recipient ownership or infer balances. An absent key image is
limited to this reader's confirmed chain; pending spends are not checked.

Selecting a tool reveals a contextual usage guide beside its form (stacked on
mobile). Each guide explains its purpose, where to obtain the requested public
data, the transaction-page shortcuts and how to interpret positive, negative and
incomplete-reader results. Address inspection explains how to obtain public
view/spend keys from a receiving address, including Kurz's shared public key.
Output inspection distinguishes the one-time output key from address view keys
and transaction public keys. Key-image guidance points to spend inputs and
explains the confirmed-chain scope. All guides distinguish public from private
keys and explicitly mark private-key output decoding as unavailable. The tool
chooser has no expanded guide before selection.

Screenshots: [key image](images/tool-guide-key-image.png),
[output key](images/tool-guide-output.png),
[address](images/tool-guide-address.png) and
[mobile address guide](images/tool-guide-address-mobile.png).

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

Optionally set `RYO_DAEMON_RPC_URL` to the private daemon HTTP(S) origin, for
example `http://127.0.0.1:12211`. It follows the same origin restrictions and is
never a browser setting. Only a fixed server-side GET `/get_info` is made: no
credentials, browser headers, arbitrary RPC paths or write calls are forwarded.
The selected public fields have a five-second deadline and 64-KiB response cap,
sharing the process's 16-read bound. Numeric RPC values must be exact safe JSON
integers or canonical uint64 strings. Network mismatch suppresses display.
This setting is optional; native chain data works without it.

Node observations show their original UTC read time. If a read fails, the
process may retain its last successful public observation for at most 60 seconds,
explicitly marked delayed. Beyond that, the panel reports unavailable. Node
status is checked on page refresh, including live tip/pool refreshes; there is
no independent node-status polling loop. Targets and peer counts are reported
by this node and do not prove network-wide consensus or synchronization.

The adapter only forwards GETs to the shipped native API v2 route shapes.
Only block/pool lists and interval windows accept their bounded query parameters;
unknown, duplicate and
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

Native chain reads and proxy responses use no-store. The only transient saved
observation is the optional public node status during its bounded failure grace.
Dashboard navigation and Refresh use a full page request, with no client
prefetch or persistent chain cache.
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

The contextual tool-guide update passed lint, TypeScript checking and an isolated
Webpack production build. The existing focused public-tools browser scenario
passed its form/result, secret-parameter rejection and accessibility checks.
Additional browser inspection verified that all three guides appear only after
selection, have no horizontal overflow at 390 px, and have no axe violations in
desktop light/dark or mobile light views after theme transitions settle. No
browser errors occurred. The development preview uses the verified production
build; the syncing daemon and native API were not restarted for this UI update.


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
