import { Suspense } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Clock3,
  Database,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Gauge,
  Coins,
  Banknote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IntervalHistory } from "@/components/interval-history";
import { LiveBlocks } from "@/components/live-blocks";
import {
  RecentTransactions,
  TransactionsLoading,
} from "@/components/recent-transactions";
import { ApiError, readBlocks, readNetwork } from "@/lib/api";
import { NodeStatusPanel } from "@/components/node-status";
import { readNodeStatus } from "@/lib/daemon-api";
import { cursor } from "@/lib/contracts";
import { bytes, integer, timestamp, coins, hashrate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string | string[];
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const query = await searchParams;
  const valid =
    Object.keys(query).every((k) => k === "cursor") &&
    (query.cursor === undefined || cursor.safeParse(query.cursor).success);
  const [networkResult, blocksResult, nodeResult] = await Promise.allSettled([
    readNetwork(),
    valid
      ? readBlocks(query.cursor as string | undefined)
      : Promise.reject(
          new ApiError(
            400,
            "invalid_request",
            "Invalid block page. Restart from the latest blocks.",
          ),
        ),
    readNodeStatus(),
  ]);
  const network =
    networkResult.status === "fulfilled" ? networkResult.value : null;
  let page = blocksResult.status === "fulfilled" ? blocksResult.value : null;
  let pageError =
    blocksResult.status === "rejected" ? blocksResult.reason : null;
  if (page && network && page.meta.network !== network.meta.network) {
    page = null;
    pageError = new ApiError(
      503,
      "unavailable",
      "The chain reader changed networks. Refresh this page.",
    );
  }
  const overview = network?.data.overview;
  const readTime = new Date().toISOString().slice(11, 19);
  const metrics = [
    {
      label: "Latest block",
      value: network ? integer(network.data.tip.height) : "—",
      note: network
        ? `${integer(network.meta.chain_height)} ${network.meta.chain_height === "1" ? "block" : "blocks"} in this reader`
        : "Reader unavailable",
      icon: Layers3,
    },
    {
      label: "Tip difficulty",
      value: network ? integer(network.data.tip_difficulty) : "—",
      note: network
        ? `For confirmed block ${integer(network.data.tip.height)}`
        : "Reader unavailable",
      icon: ShieldCheck,
    },
    {
      label: "Target interval",
      value: network
        ? `${integer(network.data.target_block_time_seconds)} s`
        : "—",
      note: "Protocol target, not observed time",
      icon: Clock3,
    },
    {
      label: "Estimated hashrate",
      value: network
        ? hashrate(
            network.data.tip_difficulty,
            network.data.target_block_time_seconds,
          )
        : "—",
      note: "At local tip · difficulty / target interval",
      icon: Gauge,
    },
    {
      label: "Issued supply",
      value: overview?.issued_atomic ? coins(overview.issued_atomic) : "—",
      note: "At local tip · emission including dev fund, excluding fees",
      icon: Coins,
    },
    {
      label: "Latest coinbase payout",
      value: overview ? coins(overview.tip_coinbase_atomic) : "—",
      note: "Includes transaction fees and any dev-fund payout",
      icon: Banknote,
    },
  ];
  return (
    <>
      <div className="page-topline">
        <span className="eyebrow">EXPLORER / OVERVIEW</span>
        <span className="read-time">Page read · {readTime} UTC</span>
      </div>
      <div className="page-heading dashboard-heading">
        <div>
          <h1>
            Ryo Blockchain
            <br />
            Explorer
          </h1>
          <p>Explore the chain. Respect the privacy.</p>
        </div>
        <div className="heading-actions">
          <Badge
            variant="outline"
            className={network ? "reader-badge" : "offline-badge"}
          >
            <span className="status-dot" />
            {network ? `${network.meta.network} reader` : "Reader unavailable"}
          </Badge>
          <Button variant="outline" asChild>
            <a
              href={
                query.cursor && valid
                  ? `/?cursor=${encodeURIComponent(query.cursor as string)}`
                  : "/"
              }
            >
              <RefreshCw aria-hidden="true" />
              Refresh
            </a>
          </Button>
        </div>
      </div>
      {valid && !query.cursor && (
        <LiveBlocks
          tipHash={network?.data.tip.hash ?? null}
          tipHeight={network?.data.tip.height ?? null}
          network={network?.meta.network ?? null}
          poolSnapshot={
            overview
              ? `${overview.pool_transactions}.${overview.pool_size_bytes}`
              : null
          }
        />
      )}
      {!network && (
        <div className="notice" role="alert">
          <Database aria-hidden="true" />
          <div>
            <strong>Chain reader unavailable</strong>
            <p>
              The dashboard could not read chain status. Try refreshing shortly.
            </p>
          </div>
        </div>
      )}
      <NodeStatusPanel
        key={
          nodeResult.status === "fulfilled" &&
          nodeResult.value &&
          nodeResult.value !== "unavailable"
            ? nodeResult.value.checkedAt
            : "unavailable"
        }
        status={
          nodeResult.status === "fulfilled" ? nodeResult.value : "unavailable"
        }
        network={network?.meta.network}
      />
      <div className="metric-grid">
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <Card key={label} className="metric-card">
            <CardContent>
              <div className="metric-label">
                {label}
                <Icon size={17} aria-hidden="true" />
              </div>
              <div
                className={`metric-value${value.length > 18 ? " metric-long" : ""}`}
              >
                {value}
              </div>
              <p>{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="overview-grid">
        <Suspense
          fallback={
            <section className="interval-panel">
              <h2>Block intervals</h2>
              <p className="table-note">Reading block intervals…</p>
            </section>
          }
        >
          <IntervalHistory
            anchor={network?.data.tip.hash}
            network={network?.meta.network}
          />
        </Suspense>
        <section className="chain-context" aria-labelledby="reader-title">
          <div className="eyebrow">NATIVE CHAIN DATA</div>
          <h2 id="reader-title">Chain reader</h2>
          <p>
            These figures describe the blockchain held by this explorer. They do
            not establish network-wide synchronization.
          </p>
          <dl>
            <div>
              <dt>Network</dt>
              <dd>{network?.meta.network ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Data source</dt>
              <dd>Native Ryo / LMDB</dd>
            </div>
            <div>
              <dt>API</dt>
              <dd>v2 · Read only</dd>
            </div>
            <div>
              <dt>Block protocol</dt>
              <dd>
                {network ? `v${network.data.tip.major_version}` : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Median block size</dt>
              <dd>
                {overview
                  ? `${bytes(overview.median_block_size_bytes)} · ${overview.median_sample_blocks} blocks`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Confirmed transactions</dt>
              <dd>
                {overview
                  ? integer(overview.confirmed_transactions)
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Local transaction pool</dt>
              <dd>
                {overview
                  ? `${overview.pool_transactions === null ? "count unavailable" : integer(overview.pool_transactions) + " pending"} · ${overview.pool_size_bytes === null ? "size unavailable" : bytes(overview.pool_size_bytes)}`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Native core</dt>
              <dd>{network?.data.native_core_version ?? "Unavailable"}</dd>
            </div>
          </dl>
          <a className="text-link" href="/mempool">
            Browse pending transactions
          </a>
          <a href="/json/network" className="text-link">
            Inspect network JSON <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </section>
      </div>
      <div className="dashboard-tables">
        <section className="blocks-section" aria-labelledby="blocks-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">BLOCK EXPLORER</span>
              <h2 id="blocks-title">
                {query.cursor ? "Earlier blocks" : "Recent blocks"}
              </h2>
            </div>
            <span className="section-note">
              {page
                ? `${page.data.items.length} ${page.data.items.length === 1 ? "block" : "blocks"} · newest first`
                : "Waiting for chain data"}
            </span>
          </div>
          {pageError && (
            <div className="notice" role="alert">
              <Layers3 aria-hidden="true" />
              <div>
                <strong>
                  {pageError instanceof ApiError && pageError.status === 409
                    ? "The chain changed"
                    : "Block page unavailable"}
                </strong>
                <p>
                  {pageError instanceof ApiError
                    ? pageError.message
                    : "Try refreshing shortly."}
                </p>
                <a href="/" className="text-link">
                  Restart from latest blocks{" "}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
          {page && (
            <>
              <Table
                scrollLabel="Recent blocks table"
                aria-labelledby="blocks-title"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Height</TableHead>
                    <TableHead>Block hash</TableHead>
                    <TableHead>Timestamp · UTC</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead>
                      <span className="sr-only">Public API views</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.data.items.map((b) => (
                    <TableRow key={b.hash}>
                      <TableCell>
                        <a
                          href={`/blocks/${b.hash}`}
                          className="height-link"
                          aria-label={`Block ${b.height}`}
                        >
                          {integer(b.height)}
                        </a>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`/blocks/${b.hash}`}
                          className="hash-text"
                          title={b.hash}
                        >
                          {b.hash.slice(0, 12)}
                          <span aria-hidden="true">…</span>
                          {b.hash.slice(-6)}
                        </a>
                      </TableCell>
                      <TableCell className="timestamp-cell">
                        {b.timestamp_unix === "0"
                          ? "Genesis · time not recorded"
                          : timestamp(b.timestamp_unix)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {integer(b.transaction_count)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {bytes(b.size_bytes)}
                      </TableCell>
                      <TableCell>
                        <a
                          href={`/json/raw/block/${b.hash}`}
                          className="raw-link"
                          aria-label={`Raw block ${b.height}`}
                        >
                          Raw <ArrowUpRight size={13} aria-hidden="true" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="pagination">
                <p>
                  Anchored at block{" "}
                  <strong>{integer(page.data.anchor_height)}</strong>.{" "}
                  {query.cursor
                    ? "New blocks do not shift this page."
                    : "Live updates follow the latest blocks unless paused."}
                </p>
                <div>
                  {query.cursor && (
                    <Button asChild variant="outline">
                      <a href="/">Latest blocks</a>
                    </Button>
                  )}
                  {page.data.next_cursor ? (
                    <Button asChild variant="outline">
                      <a
                        href={`/?cursor=${encodeURIComponent(page.data.next_cursor)}`}
                      >
                        Earlier blocks <ArrowDown aria-hidden="true" />
                      </a>
                    </Button>
                  ) : (
                    <span className="end-label">Beginning of the chain</span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
        <Suspense fallback={<TransactionsLoading />}>
          <RecentTransactions page={page} />
        </Suspense>
      </div>
      <footer className="page-footer">
        <span>Public data. Private by design.</span>
        <p>
          Separate reads can observe different chain heights. Ring candidates do
          not identify a real spend.
        </p>
      </footer>
    </>
  );
}
