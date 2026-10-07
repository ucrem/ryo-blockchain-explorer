import type { Metadata } from "next";
import {
  checkKeyImage,
  checkOutput,
  inspectAddress,
  ApiError,
} from "@/lib/api";
import { toolQuery } from "@/lib/tool-query";
import type { ViewQuery } from "@/lib/view-pages";
import { integer } from "@/lib/format";
import { ResourceFailure, DetailRow } from "@/components/detail";
import { Button } from "@/components/ui/button";
import { ToolGuide } from "@/components/tool-guide";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Public inspection tools" };
const tools = [
  {
    id: "key-image",
    title: "Key image status",
    note: "Check whether a public key image appears in this reader's confirmed chain.",
  },
  {
    id: "output",
    title: "Output key check",
    note: "Check whether a public output key belongs to an identified transaction.",
  },
  {
    id: "address",
    title: "Address inspector",
    note: "Check a public address's native format, checksum, network and public keys.",
  },
];
export default async function Tools({
  searchParams,
}: {
  searchParams: Promise<ViewQuery>;
}) {
  const query = await searchParams;
  const selected = Object.keys(query).length ? toolQuery(query) : undefined;
  if (selected === null)
    return (
      <ResourceFailure
        kind="Tool"
        error={
          new ApiError(
            400,
            "invalid_request",
            "Choose a tool and enter the requested public identifiers only.",
          )
        }
      />
    );
  let imageResult, outputResult, addressResult;
  let failure: unknown;
  if (selected?.value) {
    try {
      if (selected.tool === "key-image")
        imageResult = await checkKeyImage(selected.value);
      else if (selected.tool === "output")
        outputResult = await checkOutput(selected.transaction!, selected.value);
      else addressResult = await inspectAddress(selected.value);
    } catch (error) {
      failure = error;
    }
  }
  let result: React.ReactNode = failure ? (
    <ResourceFailure kind="Verification" error={failure} />
  ) : null;
  if (selected?.value && !failure) {
    if (imageResult) {
      const r = imageResult;
      result = (
        <section className="tool-result" aria-label="Verification result">
          <h2>
            {r.data.spent
              ? "Key image recorded as spent"
              : "Key image not found in confirmed chain"}
          </h2>
          <dl className="detail-grid">
            <DetailRow label="Key image" wide>
              <code className="full-hash">{r.data.key_image}</code>
            </DetailRow>
            <DetailRow label="Reader">
              {r.meta.network} · {integer(r.meta.chain_height)} blocks
            </DetailRow>
          </dl>
          <p>
            This checks the confirmed chain held by this reader. A negative
            result does not prove an output is spendable, check pending spends
            or identify a real ring member.
          </p>
          <a
            className="text-link"
            href={`/json/tools/key-images/${selected.value}`}
          >
            Result JSON
          </a>
        </section>
      );
    } else if (outputResult) {
      const r = outputResult;
      result = (
        <section className="tool-result" aria-label="Verification result">
          <h2>
            {r.data.output_indices.length
              ? "Output key found in transaction"
              : "Output key not found in transaction"}
          </h2>
          <dl className="detail-grid">
            <DetailRow label="Transaction" wide>
              <a
                className="text-link full-hash"
                href={`/transactions/${r.data.transaction_hash}`}
              >
                <code>{r.data.transaction_hash}</code>
              </a>
            </DetailRow>
            <DetailRow label="Public output key" wide>
              <code className="full-hash">{r.data.public_key}</code>
            </DetailRow>
            <DetailRow label="Native curve check">
              {r.data.curve_valid
                ? "Valid public point encoding"
                : "Invalid public point encoding"}
            </DetailRow>
            <DetailRow label="Output indices">
              {r.data.output_indices.length
                ? r.data.output_indices.join(", ")
                : "No matching output"}
            </DetailRow>
            <DetailRow label="Inclusion">
              {r.data.state} · {r.meta.network}
            </DetailRow>
          </dl>
          <p>
            Matching a public output key establishes transaction membership. It
            does not identify its recipient, disclose its hidden amount or prove
            wallet ownership.
          </p>
          <a
            className="text-link"
            href={`/json/tools/outputs/${selected.transaction}/${selected.value}`}
          >
            Result JSON
          </a>
        </section>
      );
    } else if (addressResult) {
      const r = addressResult;
      result = (
        <section className="tool-result" aria-label="Verification result">
          <h2>
            {r.data.valid
              ? "Valid Ryo address"
              : "Address failed native validation"}
          </h2>
          {r.data.valid ? (
            <>
              <dl className="detail-grid">
                <DetailRow label="Network">
                  {r.data.network}
                  {!r.data.matches_reader && " · differs from this reader"}
                </DetailRow>
                <DetailRow label="Format">{r.data.kind}</DetailRow>
                <DetailRow label="Public spend key" wide>
                  <code className="full-hash">{r.data.spend_public_key}</code>
                </DetailRow>
                <DetailRow label="Public view key" wide>
                  <code className="full-hash">{r.data.view_public_key}</code>
                </DetailRow>
                {r.data.payment_id8 && (
                  <DetailRow label="Integrated payment ID">
                    <code>{r.data.payment_id8}</code>
                  </DetailRow>
                )}
              </dl>
              <p>
                Address validity describes encoding, checksum and network.
                Public keys do not reveal an address balance or transaction
                history.
              </p>
            </>
          ) : (
            <p>
              Check the address spelling and checksum. The pinned native reader
              did not recognize a supported Ryo address format.
            </p>
          )}
          <a
            className="text-link"
            href={`/json/tools/addresses/${selected.value}`}
          >
            Result JSON
          </a>
        </section>
      );
    }
  }
  return (
    <>
      <div className="page-topline">
        <span className="eyebrow">EXPLORER / TOOLS</span>
        <span className="read-time">NATIVE RYO · PUBLIC DATA</span>
      </div>
      <div className="page-heading">
        <div>
          <h1>Public inspection tools</h1>
          <p>Check public blockchain identifiers using native Ryo.</p>
        </div>
      </div>
      <nav className="tool-selector" aria-label="Inspection tools">
        {tools.map((tool) => (
          <a
            key={tool.id}
            className="tool-choice"
            aria-current={selected?.tool === tool.id ? "page" : undefined}
            href={`/tools?tool=${tool.id}`}
          >
            <h2>{tool.title}</h2>
            <p>{tool.note}</p>
          </a>
        ))}
      </nav>
      {selected && (
        <div className="tool-workspace">
          <section className="tool-form-panel">
            <h2>{tools.find((tool) => tool.id === selected.tool)!.title}</h2>
            <form action="/tools" method="get" className="tool-form">
              <input type="hidden" name="tool" value={selected.tool} />
              {selected.tool === "output" && (
                <label>
                  Transaction hash
                  <input
                    name="transaction"
                    required
                    maxLength={64}
                    pattern="[0-9a-fA-F]{64}"
                    autoComplete="off"
                    defaultValue={selected.transaction ?? ""}
                  />
                </label>
              )}
              <label>
                {selected.tool === "address"
                  ? "Public Ryo address"
                  : selected.tool === "key-image"
                    ? "Public key image"
                    : "Public output key"}
                <input
                  name="value"
                  required
                  maxLength={selected.tool === "address" ? 200 : 64}
                  pattern={
                    selected.tool === "address"
                      ? "[1-9A-HJ-NP-Za-km-z]{40,200}"
                      : "[0-9a-fA-F]{64}"
                  }
                  autoComplete="off"
                  defaultValue={selected.value ?? ""}
                />
              </label>
              <p className="table-note">
                Enter public data only. Never paste a private view, spend or
                transaction key or a wallet export.
              </p>
              <Button type="submit">
                {selected.tool === "address" ? "Inspect address" : "Check"}
              </Button>
            </form>
          </section>
          <ToolGuide tool={selected.tool} />
        </div>
      )}
      {result}
    </>
  );
}
