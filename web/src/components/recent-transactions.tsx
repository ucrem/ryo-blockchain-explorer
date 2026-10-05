import { ArrowUpRight, ArrowRightLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readBlock } from "@/lib/api";
import type { BlocksResponse } from "@/lib/contracts";
import { coins, integer, timestamp } from "@/lib/format";
import { recentTransactions } from "@/lib/recent-transactions";

export function TransactionsLoading() {
  return (
    <section
      className="blocks-section transactions-section"
      aria-labelledby="transactions-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">TRANSACTION EXPLORER</span>
          <h2 id="transactions-title">Recent transactions</h2>
        </div>
      </div>
      <p className="table-note">Reading confirmed transactions…</p>
    </section>
  );
}

export async function RecentTransactions({
  page,
}: {
  page: BlocksResponse | null;
}) {
  let result: Awaited<ReturnType<typeof recentTransactions>> | null = null;
  if (page) {
    try {
      result = await recentTransactions(page, readBlock);
    } catch {
      // A failed/mismatched block is unavailable, not an empty transaction list.
    }
  }
  return (
    <section
      className="blocks-section transactions-section"
      aria-labelledby="transactions-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">TRANSACTION EXPLORER</span>
          <h2 id="transactions-title">Recent transactions</h2>
        </div>
        <span className="section-note">
          {result
            ? `${result.items.length} confirmed · newest blocks first`
            : "Waiting for transaction data"}
        </span>
      </div>
      {!result ? (
        <div className="notice" role="alert">
          <ArrowRightLeft aria-hidden="true" />
          <div>
            <strong>Transaction list unavailable</strong>
            <p>
              Transactions could not be read for this block page. Refresh or
              open a block to try again.
            </p>
          </div>
        </div>
      ) : (
        <>
          <Table
            scrollLabel="Recent transactions table"
            aria-labelledby="transactions-title"
          >
            <TableHeader>
              <TableRow>
                <TableHead>Transaction hash</TableHead>
                <TableHead>Block</TableHead>
                <TableHead className="text-right">Fee · RYO</TableHead>
                <TableHead>Timestamp · UTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((tx) => (
                <TableRow key={tx.hash}>
                  <TableCell>
                    <a
                      href={`/transactions/${tx.hash}`}
                      className="transaction-link"
                      title={tx.hash}
                      aria-label={`Transaction ${tx.hash}`}
                    >
                      <span className="hash-text">
                        {tx.hash.slice(0, 12)}…{tx.hash.slice(-6)}
                      </span>
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </a>
                    <span className="transaction-kind">
                      {tx.coinbase ? "Coinbase" : "Transaction"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/blocks/${tx.blockHash}`}
                      className="height-link"
                      aria-label={`Transaction block ${tx.blockHeight}`}
                    >
                      {integer(tx.blockHeight)}
                    </a>
                  </TableCell>
                  <TableCell className="text-right transaction-fee">
                    {tx.feeAtomic === null ? (
                      <span aria-label="Coinbase has no transaction fee">
                        —
                      </span>
                    ) : (
                      coins(tx.feeAtomic).replace(" RYO", "")
                    )}
                  </TableCell>
                  <TableCell className="timestamp-cell">
                    {tx.timestamp === "0"
                      ? "Genesis · time not recorded"
                      : timestamp(tx.timestamp).replace(" UTC", "")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="table-note">
            Confirmed in the blocks on this page · coinbase included.
            {result.limited &&
              " Open a block to explore its complete transaction list."}
          </p>
        </>
      )}
    </section>
  );
}
