import type { Metadata } from "next";
import { ArrowUpRight, Braces, LockKeyhole } from "lucide-react";
import { jsonViewHref } from "@/lib/pretty-json";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "Developer API" };
const routes = [
  [
    "/api/v2/mempool?limit=50",
    "Paginated relayable local pool, native summaries and membership cursor",
    "/api/v2/mempool?limit=50",
  ],
  [
    "/api/v2/tools/key-images/{image}",
    "Confirmed-chain public key-image membership",
    null,
  ],
  [
    "/api/v2/tools/outputs/{transaction}/{key}",
    "Public output membership within a transaction",
    null,
  ],
  [
    "/api/v2/tools/addresses/{address}",
    "Native public address format and network inspection",
    null,
  ],
  [
    "/api/v2/block-intervals?window=1h",
    "Native block timestamp differences; 1h, 24h, 7d or 30d",
    "/api/v2/block-intervals?window=1h",
  ],
  [
    "/api/v2/network",
    "Native reader chain state and configured network",
    "/api/v2/network",
  ],
  [
    "/api/v2/blocks?limit=20",
    "Anchored newest-first block summaries",
    "/api/v2/blocks?limit=20",
  ],
  [
    "/api/v2/blocks/{height-or-hash}",
    "Block header and transaction summaries",
    "/api/v2/blocks/0",
  ],
  [
    "/api/v2/transactions/{hash}",
    "Confirmed or known mempool transaction",
    null,
  ],
  [
    "/api/v2/raw/block/{height-or-hash}",
    "Native block JSON and serialized hex",
    "/api/v2/raw/block/0",
  ],
  [
    "/api/v2/raw/transaction/{hash}",
    "Native transaction JSON and serialized hex",
    null,
  ],
];
export default function Developers() {
  return (
    <>
      <div className="page-topline">
        <span className="eyebrow">EXPLORER / DEVELOPERS</span>
        <span className="read-time">PUBLIC API v2</span>
      </div>
      <div className="page-heading">
        <div>
          <h1>Developer API</h1>
          <p>Build with public Ryo blockchain data.</p>
        </div>
        <Button asChild variant="outline">
          <a href="/json/openapi.json">
            OpenAPI JSON <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      </div>
      <section className="developer-intro">
        <div>
          <Braces size={26} aria-hidden="true" />
          <h2>Read the chain.</h2>
          <p>
            Use GET requests on this website&apos;s origin. Successful responses
            contain <code>data</code> and <code>meta</code>; errors contain an{" "}
            <code>error</code> object. OpenAPI describes the exact contracts.
          </p>
          <pre tabIndex={0} role="region" aria-label="API response structure">
            <code>
              {
                'GET /api/v2/blocks?limit=20\n\n{ "data": { "items": [...], "next_cursor": "..." },\n  "meta": { "network": "mainnet", "chain_height": "..." } }'
              }
            </code>
          </pre>
          <p className="section-note">
            Illustrative structure only. Follow the returned cursor unchanged;
            restart after HTTP 409.
          </p>
        </div>
        <div>
          <LockKeyhole size={26} aria-hidden="true" />
          <h2>Keep the precision.</h2>
          <p>
            Heights, difficulty, timestamps and amounts are decimal strings. Use
            an exact integer type. One RYO is 1,000,000,000 atomic units.
          </p>
          <p>
            Hidden output amounts are <code>null</code>. Ring members are
            possible candidates, not identified spends. The API offers no
            address balances, private-key verification or transaction
            submission.
          </p>
          <p>
            Native raw JSON preserves its original numeric tokens. Use an
            integer-preserving parser for those objects.
          </p>
        </div>
      </section>
      <section className="developer-routes" aria-labelledby="routes-title">
        <span className="eyebrow">AVAILABLE ENDPOINTS</span>
        <h2 id="routes-title">Public, read-only access.</h2>
        {routes.map(([path, description, example]) => (
          <div className="endpoint-row" key={path}>
            <span className="method">GET</span>
            <div>
              <code>{path}</code>
              <p>{description}</p>
            </div>
            {example && (
              <a
                href={jsonViewHref(example)}
                className="raw-link"
                aria-label={`Example ${path}`}
              >
                Example <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            )}
          </div>
        ))}
      </section>
      <footer className="page-footer">
        <span>Bounded requests. Explicit failures.</span>
        <p>
          The reader may be unavailable or change during pagination. No
          synchronization or network-wide consensus claim is implied.
        </p>
      </footer>
    </>
  );
}
