# v0.4 validation evidence

Recorded 2026-10-05 (UTC). This report covers the v0.4 web implementation, not
full-chain production capacity. Release publication is a separate owner-authorized
step; the prepared release notes are in [releases/v0.4.0.md](releases/v0.4.0.md).

## Native foundation and compatibility

The pinned official core remains `185dd1fa33ba88c88bb22df9069ad368c0f9a27e`, with
the existing isolated Ubuntu 24.04 compatibility patch. The native implementation
change is product/OpenAPI metadata from 0.3.0 to 0.4.0; service interpretation,
core pin, read-only LMDB access and route shapes are unchanged.

The HTTP/benchmark-enabled build passed in the established Ubuntu 24.04 PRoot
environment (GCC 13, Boost 1.83, OpenSSL 3), using the real pinned core archives.
All five CTest checks passed in 28.85 seconds:

| Check | Result |
| --- | --- |
| Native mainnet genesis | Passed, 1.04 s |
| Offline native LMDB/RPC | Passed, 3.81 s |
| Native historical/RingCT/services/reorg/schema responses | Passed, 5.13 s |
| OpenAPI/DTO schema and examples | Passed, 0.61 s |
| Real HTTP v2/legacy/flags/bounds/concurrency/shutdown | Passed, 18.22 s |

Local log: `build/v04-native-build.log` (ignored build artifact). Native fixtures
retain their documented synthetic-storage and consensus/signature limitations.
The full native GitHub Action remains manual-only; no per-PR full build is added.
The owner-authorized manual [native run 37370952211](https://github.com/ucrem/ryo-blockchain-explorer/actions/runs/37370952211)
also passed on the implementation commit `7284564bca0f1608193e159127badc3e8b9c7589`.
The subsequent visual revision changes frontend assets, layout, fonts and documentation;
its native sources are identical to that validated commit.

## Frontend build, resource and precision checks

The host frontend environment is Ubuntu 26.04, Node.js 24.21.0 and npm 11.19.0.
The production build uses Next.js 16.3.8, React 19.2.8, TypeScript 5.9.3 and
Tailwind 4.3.3. Registry-resolved dependencies are pinned in the npm lockfile.

- Clean lockfile installation succeeded; no API was needed at build time.
- ESLint, route generation/TypeScript checks and the production build passed.
- Thirteen Node tests passed: public native schema examples, exact values above
  2^53 and uint64 bounds, invalid/secret route queries, timestamp interpretation,
  trusted origins, raw numeric-token preservation, reorg status, redirect/content
  type/declared and streamed response-size rejection, concurrency and deadline.
  Detail cases cover count/inclusion consistency, hidden RingCT amounts, exact
  RYO formatting, public identifier normalization and bounded row pagination.
  JSON cases cover token preservation (including uint64, decimal spelling,
  exponents, negative zero, escapes and duplicate keys), malformed syntax and
  preview size/depth/expansion bounds.
- Production dependency audit reported zero vulnerabilities. The complete audit
  reported five high entries, all one developer-only `braces` advisory and its
  Next ESLint glob dependency chain. The advisory has no published patched version:
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
  It concerns attacker-supplied nested glob patterns in lint tooling, not runtime
  visitor input. No downgrade or unreviewed dependency override was applied.

## Production browser checks

Seven Chromium Playwright scenarios passed against the production Next server
in 18.7 seconds with the official-brand detail/search/JSON UI. Their isolated fixture
server uses explicitly synthetic headers and public genesis examples; it is never
imported by application code.

The scenarios cover exact displayed difficulty/height beyond JavaScript's safe
integer range; raw numeric text; no-store and rejected writes/private-key query
shapes; theme persistence; desktop light/dark and mobile accessibility checks;
no page-level horizontal overflow; native cursor navigation; 409 restart;
mobile developer navigation; keyboard skip link; backend outage and genesis empty
states; invalid page parameters; no hydration/page errors; and browser requests
restricted to the website origin. Additional scenarios cover HTML block/transaction
navigation, height/block-hash/transaction-hash searches, uppercase hash
normalization, exact fees, hidden output amounts, mempool inclusion, output-row
pagination, rejected duplicate/unsupported queries without native reads, absent
resources and partial reader outages. JSON checks cover retained layout, exact
formatted/original tokens, escaped markup without execution, verbatim downloads,
light/dark/mobile accessibility and rejected private queries without native reads.
Detail tables and JSON panels scroll with keyboard focus.
Axe reported no violations in the tested
states; that is not a substitute for broad manual assistive-technology testing.

The minimal host lacked Chromium's shared libraries, fontconfig and fonts.
Required Ubuntu packages were downloaded/extracted under `/tmp/ryo-v04-browser`
without root installation; its library path/fontconfig were supplied only to
local browser tests. The website bundles its fonts and makes no font-CDN request.
These local environment paths are not app/runtime dependencies.

## Real native end-to-end smoke

A pinned `ryod --offline` created a separate genesis-only database under
`build/v04-native-smoke/chain`. The real v0.4 C++ HTTP executable opened it
read-only with API v2 enabled. The production Next server used that fixed API
origin. `web/tests/native-smoke.ts` passed in Chromium:

- Dashboard showed block zero and the truthful missing-timestamp/interval state.
- Actual reader height was `"1"`, the native tip hash was
  `6eb04b6b8c68049a76206fe2805ede5f7465c03b7112850d3262a067b9914dac`,
  and product version was `0.4.0`.
- Same-origin raw block returned native serialized hex and the expected hash;
  bundled OpenAPI reported 0.4.0.
- Block links opened readable native header/transaction HTML pages. The native
  coinbase output showed exactly `8,800,000.000000000 RYO`; height zero and both
  hash types resolved through the search field.
- Native raw transaction JSON opened inside the explorer layout. The original
  toggle matched the API response text exactly; formatted digits were preserved.
- No browser page errors or external-origin requests occurred.

Only the smoke's own loopback processes and offline directory were used; processes
were stopped afterward. No supplied chain, wallet, private keys, mainnet sync or
transaction submission was involved. An actual native-genesis screenshot is
included below; multi-block browser screenshots use synthetic test headers.

The replacement UI was inspected against the current official Ryo site in both
light and dark modes. Its actual wordmark, favicon and decorative artwork have
recorded [branding provenance](WEB_BRANDING.md). Inter/Montserrat are self-hosted;
the official site's Neue Kaine display font is not redistributed.

![Light dashboard against the real disposable native genesis LMDB](images/v0.4-native-dashboard.png)

![Dark dashboard against the real disposable native genesis LMDB](images/v0.4-native-dashboard-dark.png)

![Block details against the real disposable native genesis LMDB](images/v0.4-native-block.png)

![Transaction details against the real disposable native genesis LMDB](images/v0.4-native-transaction.png)

![Embedded formatted native JSON within the explorer layout](images/v0.4-native-json.png)

## Limits and release gate

Full-chain performance, live mapping growth/external writers, wider historical
chains, positive testnet/stagenet fixtures, browser engines beyond Chromium,
public reverse-proxy operation and long-running deployment remain unverified.
No native cryptographic primitive was reimplemented in the frontend.

Merge only through a PR after owner action or explicit conversational merge
instruction. Tag and publish from the authorized merged source, with accurate
validation evidence. Do not restore per-PR CI, bypass protection or push directly
to `main` to publish this milestone.
