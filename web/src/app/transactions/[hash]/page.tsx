import { notFound } from "next/navigation";
import { ApiError, readTransaction } from "@/lib/api";
import { publicIdentifier } from "@/lib/contracts";
import {
  bytes,
  coins,
  integer,
  timestamp,
  ringSize,
  paymentIdTypes,
} from "@/lib/format";
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
export const metadata = { title: "Transaction details" };
export default async function TransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ hash: string }>;
  searchParams: Promise<ViewQuery>;
}) {
  const id = publicIdentifier((await params).hash);
  if (!id || id.kind !== "hash") notFound();
  const pages = viewPages(await searchParams, ["inputs", "outputs"]);
  if (!pages)
    return (
      <ResourceFailure
        kind="Transaction"
        error={
          new ApiError(400, "invalid_request", "Invalid input or output page.")
        }
      />
    );
  let response;
  try {
    response = await readTransaction(id.value);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return <ResourceFailure kind="Transaction" error={error} />;
  }
  const t = response.data,
    inclusion = t.inclusion;
  const inputs = slicePage(t.inputs, pages.inputs, 10),
    outputs = slicePage(t.outputs, pages.outputs, 50);
  if (!inputs || !outputs)
    return (
      <ResourceFailure
        kind="Transaction"
        error={
          new ApiError(
            400,
            "invalid_request",
            "This input or output page does not exist.",
          )
        }
      />
    );
  const path = `/transactions/${t.hash}`;
  return (
    <>
      <DetailHeading
        kind="Transaction"
        title="Transaction details"
        note={`${response.meta.network} · ${t.coinbase ? "Coinbase" : "Transfer"} · ${inclusion.state === "confirmed" ? "Confirmed" : "In mempool"}`}
        api={`/api/v2/transactions/${t.hash}`}
        raw={`/api/v2/raw/transaction/${t.hash}`}
      />
      <p className="receive-entry"><a className="text-link" href={`/tools/receive?tx=${t.hash}`}>Verify received outputs</a> · Recognize your outputs and decode their amounts locally with your address and private view key.</p>
      <dl className="detail-grid">
        <DetailRow label="Transaction hash" wide>
          <code className="full-hash">{t.hash}</code>
        </DetailRow>
        <DetailRow label="Status">
          {inclusion.state === "confirmed" ? "Confirmed" : "In mempool"}
        </DetailRow>
        <DetailRow label="Confirmations">
          {integer(inclusion.confirmations)}
        </DetailRow>
        <DetailRow label="Included in block">
          {inclusion.state === "confirmed" ? (
            <a href={`/blocks/${inclusion.block_height}`} className="text-link">
              Block {integer(inclusion.block_height)}
            </a>
          ) : (
            "Not included in a block"
          )}
        </DetailRow>
        <DetailRow label="Block timestamp · UTC">
          {inclusion.state === "confirmed"
            ? timestamp(inclusion.timestamp_unix)
            : "Not included in a block"}
        </DetailRow>
        <DetailRow label="Fee">
          <span>{coins(t.fee_atomic)}</span>
          <span className="detail-note">
            {" "}
            · {integer(t.fee_atomic)} atomic units
          </span>
        </DetailRow>
        <DetailRow label="Size">
          {bytes(t.size_bytes)}
          <span className="detail-note"> · {integer(t.size_bytes)} bytes</span>
        </DetailRow>
        <DetailRow label="Spend inputs">{integer(t.input_count)}</DetailRow>
        <DetailRow label="Outputs">{integer(t.output_count)}</DetailRow>
        <DetailRow label="Version">{t.version}</DetailRow>
        <DetailRow label="RingCT type">{t.ringct_type}</DetailRow>
        <DetailRow label="Ring size">{ringSize(t.inspection)}</DetailRow>
        <DetailRow label="Payment ID type">
          {t.coinbase ? "—" : paymentIdTypes(t.inspection?.payment_id_types)}
        </DetailRow>
      </dl>
      <section
        className="blocks-section detail-table"
        aria-labelledby="outputs-title"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">PUBLIC OUTPUT DATA</span>
            <h2 id="outputs-title">Outputs</h2>
          </div>
          <span className="section-note">
            {integer(t.output_count)}{" "}
            {t.output_count === 1 ? "output" : "outputs"}
          </span>
        </div>
        <p className="section-explanation">
          Amounts hidden by RingCT are not disclosed. An output key does not
          identify a recipient address or balance.
        </p>
        {t.outputs.length ? (
          <>
            <Table scrollLabel="Transaction outputs">
              <TableHeader>
                <TableRow>
                  <TableHead>Index</TableHead>
                  <TableHead>Output public key</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outputs.items.map((o) => (
                  <TableRow key={o.index}>
                    <TableCell>{o.index}</TableCell>
                    <TableCell>
                      <code className="full-hash">{o.public_key}</code>
                    </TableCell>
                    <TableCell>
                      {o.amount_atomic === null
                        ? "Hidden by RingCT"
                        : coins(o.amount_atomic)}
                    </TableCell>
                    <TableCell>
                      <a
                        className="text-link"
                        href={`/tools?tool=output&transaction=${t.hash}&value=${o.public_key}`}
                      >
                        Check output key
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PageLinks
              path={path}
              field="outputs"
              current={outputs.page}
              pages={outputs.pages}
              other={{ inputs: pages.inputs }}
            />
          </>
        ) : (
          <p className="section-explanation">
            No outputs are recorded in this transaction.
          </p>
        )}
      </section>
      <section className="detail-inputs" aria-labelledby="inputs-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">KEY IMAGES AND RING CANDIDATES</span>
            <h2 id="inputs-title">Inputs</h2>
          </div>
          <span className="section-note">
            {integer(t.input_count)}{" "}
            {t.input_count === 1 ? "spend input" : "spend inputs"}
          </span>
        </div>
        {t.coinbase ? (
          <p className="section-explanation">
            Coinbase generation input at block {integer(t.coinbase_height!)}.
            There are no spend key images or ring members.
          </p>
        ) : (
          <>
            <p className="section-explanation">
              Ring members are possible candidates. This view does not identify
              the real spent output.
            </p>
            {inputs.items.map((input, n) => (
              <article className="input-panel" key={n}>
                <h3>Input {(pages.inputs - 1) * 10 + n}</h3>
                <dl>
                  <DetailRow label="Key image">
                    <code className="full-hash">{input.key_image}</code>
                    <a
                      className="text-link"
                      href={`/tools?tool=key-image&value=${input.key_image}`}
                    >
                      Check spent status
                    </a>
                  </DetailRow>
                  <DetailRow label="Relative output offsets">
                    <code className="full-hash">
                      {input.key_offsets_relative
                        .slice(0, 32)
                        .map(integer)
                        .join(", ") || "None recorded"}
                    </code>
                  </DetailRow>
                </dl>
                {input.key_offsets_relative.length > 32 && (
                  <p className="section-explanation">
                    First 32 of {integer(input.key_offsets_relative.length)}{" "}
                    offsets shown. Full data is available in Transaction JSON.
                  </p>
                )}
                {input.ring_candidates.length ? (
                  <div className="ring-candidates">
                    <h4>Ring candidates</h4>
                    {input.ring_candidates.slice(0, 32).map((r, index) => (
                      <div key={index}>
                        <code className="full-hash">{r.public_key}</code>
                        <span>
                          <a
                            href={`/blocks/${r.block_height}`}
                            className="text-link"
                          >
                            Block {integer(r.block_height)}
                          </a>{" "}
                          · {timestamp(r.timestamp_unix)}
                        </span>
                      </div>
                    ))}
                    {input.ring_candidates.length > 32 && (
                      <p className="section-explanation">
                        First 32 of {integer(input.ring_candidates.length)}{" "}
                        candidates shown. Full data is available in Transaction
                        JSON.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="section-explanation">
                    Ring candidate metadata is unavailable in this reader.
                  </p>
                )}
              </article>
            ))}
            {!t.inputs.length && (
              <p className="section-explanation">
                No spend inputs are recorded.
              </p>
            )}
            <PageLinks
              path={path}
              field="inputs"
              current={inputs.page}
              pages={inputs.pages}
              other={{ outputs: pages.outputs }}
            />
          </>
        )}
      </section>
      <details className="advanced-details">
        <summary>Advanced transaction metadata</summary>
        <dl className="detail-grid">
          <DetailRow label="Transaction public key" wide>
            <code className="full-hash">{t.public_key ?? "Not recorded"}</code>
          </DetailRow>
          <DetailRow label="Native unlock value" wide>
            {integer(t.unlock_time)}
            <p className="detail-note">
              The native field can represent a block height or Unix time; it is
              not interpreted as a spendability guarantee.
            </p>
          </DetailRow>
          <DetailRow label="Payment ID" wide>
            <code className="full-hash">{t.payment_id ?? "Not recorded"}</code>
          </DetailRow>
          <DetailRow label="Encrypted short payment ID" wide>
            <code>{t.payment_id8 ?? "Not recorded"}</code>
          </DetailRow>
          <DetailRow label="Additional public keys" wide>
            {t.additional_public_keys.length
              ? t.additional_public_keys.slice(0, 32).map((key, n) => (
                  <code key={n} className="full-hash">
                    {key}
                  </code>
                ))
              : "None recorded"}
            {t.additional_public_keys.length > 32 && (
              <p className="detail-note">
                First 32 shown. Full list is available in Transaction JSON.
              </p>
            )}
          </DetailRow>
          <DetailRow label="Extra · hex" wide>
            <code className="full-hash">
              {t.extra_hex.slice(0, 4096) || "Empty"}
            </code>
            {t.extra_hex.length > 4096 && (
              <p className="detail-note">
                First 4,096 characters shown. Full extra is available in
                Transaction JSON.
              </p>
            )}
          </DetailRow>
        </dl>
      </details>
    </>
  );
}
