import type { Metadata } from "next";
import { readMempool, ApiError } from "@/lib/api";
import { poolCursor } from "@/lib/contracts";
import type { ViewQuery } from "@/lib/view-pages";
import {
  bytes,
  coins,
  integer,
  feePerKiB,
  ringSize,
  paymentIdTypes,
} from "@/lib/format";
import { ResourceFailure } from "@/components/detail";
import { LiveMempool } from "@/components/live-mempool";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mempool" };
export default async function Mempool({
  searchParams,
}: {
  searchParams: Promise<ViewQuery>;
}) {
  const query = await searchParams;
  if (
    Object.keys(query).some((key) => key !== "cursor") ||
    (query.cursor !== undefined && !poolCursor.safeParse(query.cursor).success)
  )
    return (
      <ResourceFailure
        kind="Mempool"
        error={
          new ApiError(
            400,
            "invalid_request",
            "Invalid pool page. Restart from the first page.",
          )
        }
      />
    );
  let response;
  try {
    response = await readMempool(query.cursor as string | undefined);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409)
      return (
        <section className="resource-failure">
          <h1>Mempool changed</h1>
          <p>
            Transactions entered or left this node&apos;s pool. Restart to
            browse its current membership.
          </p>
          <Button asChild variant="outline">
            <a href="/mempool">Restart mempool</a>
          </Button>
        </section>
      );
    return <ResourceFailure kind="Mempool" error={error} />;
  }
  const pool = response.data;
  const offset = query.cursor ? Number((query.cursor as string).slice(65)) : 0;
  const json = `/json/mempool?limit=50${query.cursor ? `&cursor=${query.cursor}` : ""}`;
  return (
    <>
      <div className="page-topline">
        <span className="eyebrow">EXPLORER / MEMPOOL</span>
        <span className="read-time">
          Page read · {new Date().toISOString().slice(11, 19)} UTC
        </span>
      </div>
      <div className="page-heading">
        <div>
          <h1>Transaction mempool</h1>
          <p>Pending transactions held by this {response.meta.network} node.</p>
        </div>
        <div className="heading-actions">
          <Button asChild variant="outline">
            <a href="/mempool">Refresh</a>
          </Button>
          <Button asChild variant="outline">
            <a href={json}>Mempool JSON</a>
          </Button>
        </div>
      </div>
      <LiveMempool
        snapshot={pool.snapshot}
        network={response.meta.network}
        anchored={Boolean(query.cursor)}
      />
      <div className="metric-grid pool-metrics">
        {[
          ["Pending transactions", integer(pool.transaction_count)],
          ["Pool size", bytes(pool.size_bytes)],
          ["Total fees", coins(pool.fee_atomic)],
        ].map(([label, value]) => (
          <section className="metric-card" key={label}>
            <div className="metric-label">{label}</div>
            <div
              className={`metric-value${value.length > 18 ? " metric-long" : ""}`}
            >
              {value}
            </div>
          </section>
        ))}
      </div>
      <section className="blocks-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LOCAL PENDING DATA · HASH ORDER</span>
            <h2 id="pool-title">Pending transactions</h2>
          </div>
          <span className="section-note">
            {pool.items.length
              ? `${offset + 1}–${offset + pool.items.length} of ${integer(pool.transaction_count)}`
              : "0 pending"}
          </span>
        </div>
        {pool.items.length === 0 ? (
          <p className="empty-state">
            No relayable transactions in this node&apos;s pool.
          </p>
        ) : (
          <Table
            aria-labelledby="pool-title"
            scrollLabel="Pending transactions table"
          >
            <TableHeader>
              <TableRow>
                <TableHead>Transaction hash</TableHead>
                <TableHead>Fee · RYO</TableHead>
                <TableHead>Fee / KiB</TableHead>
                <TableHead>Inputs / Outputs</TableHead>
                <TableHead>Ring size</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>TX size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pool.items.map((tx) => (
                <TableRow key={tx.hash}>
                  <TableCell>
                    <a
                      className="text-link full-hash"
                      href={`/transactions/${tx.hash}`}
                    >
                      <code>{tx.hash}</code>
                    </a>
                  </TableCell>
                  <TableCell>
                    {coins(tx.fee_atomic).replace(" RYO", "")}
                  </TableCell>
                  <TableCell>
                    {feePerKiB(tx.fee_atomic, tx.size_bytes)?.replace(
                      " RYO",
                      "",
                    ) ?? "—"}
                  </TableCell>
                  <TableCell>
                    {tx.input_count} / {tx.output_count}
                  </TableCell>
                  <TableCell>{ringSize(tx.inspection)}</TableCell>
                  <TableCell title="Native presence only; encrypted and uniform payment IDs are not decrypted.">
                    {paymentIdTypes(tx.inspection?.payment_id_types)}
                  </TableCell>
                  <TableCell>{bytes(tx.size_bytes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="pagination">
          <a className="text-link" href="/mempool">
            First page
          </a>
          {pool.next_cursor && (
            <Button asChild variant="outline">
              <a href={`/mempool?cursor=${pool.next_cursor}`}>
                Next transactions
              </a>
            </Button>
          )}
        </div>
        <p className="table-note">
          This is the local relayable pool, not a network-wide list or a
          confirmation. Receive times are not exposed. Live membership changes
          restart pagination; pause updates to keep inspecting this page.
          Entries marked do-not-relay are excluded.
        </p>
      </section>
    </>
  );
}
