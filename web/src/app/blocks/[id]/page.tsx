import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ApiError, readBlock } from "@/lib/api";
import { publicIdentifier } from "@/lib/contracts";
import { bytes, coins, integer, timestamp } from "@/lib/format";
import { slicePage, viewPages, type ViewQuery } from "@/lib/view-pages";
import {
  DetailHeading,
  DetailRow,
  PageLinks,
  ResourceFailure,
} from "@/components/detail";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export const dynamic = "force-dynamic";
export const metadata = { title: "Block details" };
export default async function BlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ViewQuery>;
}) {
  const id = publicIdentifier((await params).id);
  if (!id) notFound();
  const pages = viewPages(await searchParams, ["page"]);
  if (!pages)
    return (
      <ResourceFailure
        kind="Block"
        error={
          new ApiError(400, "invalid_request", "Invalid transaction page.")
        }
      />
    );
  let response;
  try {
    response = await readBlock(id.value);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return <ResourceFailure kind="Block" error={error} />;
  }
  const { header: h, transactions } = response.data;
  const list = slicePage(transactions, pages.page, 50);
  if (!list)
    return (
      <ResourceFailure
        kind="Block"
        error={
          new ApiError(
            400,
            "invalid_request",
            "This transaction page does not exist.",
          )
        }
      />
    );
  return (
    <>
      <DetailHeading
        kind="Block"
        title={`Block ${integer(h.height)}`}
        note={`${response.meta.network} · Native chain data`}
        api={`/api/v2/blocks/${h.hash}`}
        raw={`/api/v2/raw/block/${h.hash}`}
      />
      <dl className="detail-grid">
        <DetailRow label="Block hash" wide>
          <code className="full-hash">{h.hash}</code>
        </DetailRow>
        <DetailRow label="Height">{integer(h.height)}</DetailRow>
        <DetailRow label="Timestamp · UTC">
          {h.height === "0" && h.timestamp_unix === "0"
            ? "Genesis · time not recorded"
            : timestamp(h.timestamp_unix)}
        </DetailRow>
        <DetailRow label="Size">
          {bytes(h.size_bytes)}{" "}
          <span className="detail-note">({integer(h.size_bytes)} bytes)</span>
        </DetailRow>
        <DetailRow label="Transactions">
          {integer(h.transaction_count)}{" "}
          <span className="detail-note">including coinbase</span>
        </DetailRow>
        <DetailRow label="Version">
          {h.major_version}.{h.minor_version}
        </DetailRow>
        <DetailRow label="Nonce">{integer(h.nonce)}</DetailRow>
        <DetailRow label="Previous block" wide>
          {h.height === "0" ? (
            "Genesis has no previous block."
          ) : (
            <a
              href={`/blocks/${h.previous_hash}`}
              className="text-link full-hash"
            >
              <code>{h.previous_hash}</code>
            </a>
          )}
        </DetailRow>
        <DetailRow label="Coinbase transaction" wide>
          <a
            href={`/transactions/${h.coinbase_hash}`}
            className="text-link full-hash"
          >
            <code>{h.coinbase_hash}</code>
          </a>
        </DetailRow>
      </dl>
      <nav className="block-neighbors" aria-label="Adjacent blocks">
        {h.height !== "0" && (
          <a href={`/blocks/${h.previous_hash}`} className="text-link">
            <ArrowLeft size={14} aria-hidden="true" />
            Previous block
          </a>
        )}
        {BigInt(h.height) + 1n < BigInt(response.meta.chain_height) && (
          <a href={`/blocks/${BigInt(h.height) + 1n}`} className="text-link">
            Next block
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        )}
      </nav>
      <section
        className="blocks-section detail-table"
        aria-labelledby="block-transactions"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">COINBASE FIRST · NATIVE ORDER</span>
            <h2 id="block-transactions">Transactions in this block</h2>
          </div>
          <span className="section-note">
            {integer(transactions.length)}{" "}
            {transactions.length === 1 ? "transaction" : "transactions"}
          </span>
        </div>
        <Table scrollLabel="Block transactions">
          <TableHeader>
            <TableRow>
              <TableHead>Transaction hash</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.map((t) => (
              <TableRow key={t.hash}>
                <TableCell>
                  <a
                    href={`/transactions/${t.hash}`}
                    className="text-link full-hash"
                  >
                    <code>{t.hash}</code>
                  </a>
                </TableCell>
                <TableCell>{t.coinbase ? "Coinbase" : "Transfer"}</TableCell>
                <TableCell>{coins(t.fee_atomic)}</TableCell>
                <TableCell>{bytes(t.size_bytes)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PageLinks
          path={`/blocks/${h.hash}`}
          field="page"
          current={list.page}
          pages={list.pages}
        />
      </section>
    </>
  );
}
