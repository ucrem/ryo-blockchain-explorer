type RecordKind = "Block" | "Transaction";

function StructuredDescription({ kind }: { kind: RecordKind }) {
  return (
    <>
      {kind === "Block"
        ? "An explorer summary with the block header and a list of transaction summaries."
        : "An explorer view with transaction status, confirmations, fees, inputs and outputs."}{" "}
      Use this view to read the fields or work with the public API. Large
      integer values are decimal strings, which keep every digit exact.
    </>
  );
}
function RawDescription() {
  return (
    <>
      Ryo&apos;s native JSON structure in <code>native_json</code>, plus the
      serialized bytes in hexadecimal in <code>blob_hex</code>. Use this view
      for technical inspection and debugging. Native JSON may contain large
      number literals; this viewer preserves their digits.
    </>
  );
}
export function JsonViewGuide({ kind }: { kind: RecordKind }) {
  return (
    <aside className="json-guide" aria-label="Choosing a JSON view">
      <div className="json-guide-columns">
        <div>
          <h2>{kind} JSON</h2>
          <p>
            <StructuredDescription kind={kind} />
          </p>
        </div>
        <div>
          <h2>Raw JSON</h2>
          <p>
            <RawDescription />
          </p>
        </div>
      </div>
      <p className="json-guide-note">
        Both describe the same {kind.toLowerCase()} using data from the native
        Ryo reader.
      </p>
    </aside>
  );
}
export function JsonViewDescription({
  kind,
  raw,
}: {
  kind: RecordKind;
  raw: boolean;
}) {
  return (
    <aside className="json-view-description" aria-label="About this JSON view">
      <p>{raw ? <RawDescription /> : <StructuredDescription kind={kind} />}</p>
      {kind === "Block" && raw && (
        <p>
          Non-coinbase transactions appear as hashes in the native block
          structure. Open their Transaction JSON pages to inspect each
          transaction.
        </p>
      )}
      {kind === "Transaction" && !raw && (
        <p>
          Output amounts hidden by RingCT appear as <code>null</code>: their
          value is not publicly known, rather than zero.
        </p>
      )}
    </aside>
  );
}
