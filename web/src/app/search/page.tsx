import { redirect } from "next/navigation";
import { ApiError, readBlock, readTransaction } from "@/lib/api";
import { publicIdentifier } from "@/lib/contracts";
import type { ViewQuery } from "@/lib/view-pages";
import { integer } from "@/lib/format";
import { ResourceFailure } from "@/components/detail";
export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<ViewQuery>;
}) {
  const query = await searchParams;
  if (Object.keys(query).length === 0)
    return (
      <section className="search-results">
        <h1>Search the blockchain</h1>
        <p>
          Use the search field above to open a block by height or find a block
          or transaction by its hash.
        </p>
      </section>
    );
  const id = Object.keys(query).every((k) => k === "q")
    ? publicIdentifier(query.q)
    : null;
  if (!id)
    return (
      <ResourceFailure
        kind="Search"
        error={
          new ApiError(
            400,
            "invalid_request",
            "Enter a block height within uint64 range or a public 64-character hexadecimal hash.",
          )
        }
      />
    );
  if (id.kind === "height") redirect(`/blocks/${id.value}`);
  const [block, transaction] = await Promise.allSettled([
    readBlock(id.value),
    readTransaction(id.value),
  ]);
  if (block.status === "fulfilled" && transaction.status !== "fulfilled")
    redirect(`/blocks/${id.value}`);
  if (transaction.status === "fulfilled" && block.status !== "fulfilled")
    redirect(`/transactions/${id.value}`);
  if (block.status === "fulfilled" && transaction.status === "fulfilled") {
    if (block.value.meta.network !== transaction.value.meta.network)
      return (
        <ResourceFailure
          kind="Search"
          error={
            new ApiError(
              409,
              "chain_changed",
              "The reader changed networks. Search again.",
            )
          }
        />
      );
    return (
      <section className="search-results">
        <h1>Matching records</h1>
        <p>Both public record types match this identifier. Choose a view.</p>
        <div className="search-matches">
          <a href={`/blocks/${id.value}`} className="text-link">
            Block {integer(block.value.data.header.height)}
          </a>
          <a href={`/transactions/${id.value}`} className="text-link">
            Transaction<code className="full-hash">{id.value}</code>
          </a>
        </div>
      </section>
    );
  }
  const failure = [block, transaction].find(
    (r) =>
      r.status === "rejected" &&
      (!(r.reason instanceof ApiError) || r.reason.status !== 404),
  );
  if (failure?.status === "rejected")
    return <ResourceFailure kind="Search" error={failure.reason} />;
  return (
    <section className="search-results">
      <h1>No matching block or transaction</h1>
      <p>
        This hash was not found in the configured reader&apos;s current chain or
        known mempool. Check the hash and network, then search again.
      </p>
    </section>
  );
}
