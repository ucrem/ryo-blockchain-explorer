import type { ToolQuery } from "@/lib/tool-query";

export function ToolGuide({ tool }: { tool: ToolQuery["tool"] }) {
  return (
    <section className="tool-guide" aria-labelledby="tool-guide-title">
      <h2 id="tool-guide-title">How to use this tool</h2>
      {tool === "key-image" ? (
        <>
          <div>
            <h3>What this checks</h3>
            <p>
              A spend input publishes a key image to prevent the same output
              being spent twice. This tool checks whether that image is recorded
              in this reader&apos;s confirmed chain.
            </p>
          </div>
          <div>
            <h3>Where to find the key image</h3>
            <ol>
              <li>
                Copy the transaction hash (TX ID) from your wallet&apos;s
                transaction history and open it using the explorer search.
              </li>
              <li>In the transaction page, find the Inputs section.</li>
              <li>
                Use Check spent status beside a Key image to fill this tool
                automatically, or copy its 64 hexadecimal characters here and
                press Check.
              </li>
            </ol>
            <p>
              An address or a public output key alone does not supply its key
              image. Coinbase generation inputs have no spend key image. Wallet
              export files are not inputs for this tool.
            </p>
          </div>
          <div>
            <h3>How to read the result</h3>
            <p>
              Recorded as spent means a confirmed spend uses that image. Not
              found means it is absent from the chain this reader currently
              holds; pending transactions and blocks still to be synchronized
              are not checked. Neither result identifies the real ring member
              or proves that an output in your wallet is spendable.
            </p>
          </div>
        </>
      ) : tool === "output" ? (
        <>
          <div>
            <h3>What this checks</h3>
            <p>
              A public output key is the one-time public key recorded for an
              individual transaction output. This tool checks whether that key
              appears among the outputs of the transaction you identify.
            </p>
          </div>
          <div>
            <h3>Where to find the hash and output key</h3>
            <ol>
              <li>
                Copy the transaction hash (TX ID) from your wallet&apos;s
                transaction history and enter it in the explorer search.
                Opening a transaction needs only its hash.
              </li>
              <li>
                Find Outputs and the Output public key column on the transaction
                page.
              </li>
              <li>
                Use Check output key on the chosen row to fill both fields
                automatically. Alternatively, copy the transaction hash and that
                output key here, then press Check.
              </li>
            </ol>
            <p>
              Both fields contain 64 hexadecimal characters. The public output
              key is different from an address&apos;s public view key and from
              the Transaction public key in advanced metadata.
            </p>
          </div>
          <div>
            <h3>How to read the result</h3>
            <p>
              Found lists the matching output indices in that transaction. Not
              found means none of its output keys match. This establishes
              membership only; it does not prove that you received the payment
              or reveal an amount hidden by RingCT. Missing transaction data is
              reported separately and may reflect incomplete synchronization.
            </p>
          </div>
        </>
      ) : (
        <>
          <div>
            <h3>What this checks</h3>
            <p>
              Inspect a public Ryo address&apos;s format, checksum, network and
              public keys. You can obtain its public view key here using only
              the address.
            </p>
          </div>
          <div>
            <h3>Where to find the address and public keys</h3>
            <ol>
              <li>
                Copy your public receiving address from the Receive section of
                your Ryo wallet, or use the public address you want to inspect.
              </li>
              <li>Paste the whole address and press Inspect address.</li>
              <li>
                A valid result displays Public view key and Public spend key.
                Copy the key from the result if you need its hexadecimal form.
              </li>
            </ol>
            <dl className="tool-key-guide">
              <div>
                <dt>Public view key</dt>
                <dd>
                  A public address component used when creating payments.
                  It does not let you recognize your received outputs by itself.
                </dd>
              </div>
              <div>
                <dt>Public spend key</dt>
                <dd>
                  Another public address component. It does not grant permission
                  to spend funds. Kurz addresses use the same public key for
                  both components.
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h3>How to read the result</h3>
            <p>
              Valid means the native parser recognizes the encoding, checksum
              and keys. The network may differ from this reader. Address
              inspection does not show a balance, transaction history or proof
              that you control the wallet. An invalid result asks you to check
              the copied address; no private key is needed.
            </p>
          </div>
        </>
      )}
      <div className="tool-guide-safety">
        <h3>Public and private keys</h3>
        <p>
          These forms accept public data only. A private view key is a wallet
          secret used to recognize received outputs; it is different from the
          public view key displayed by Address inspector. Private-key output
          decoding is not implemented here. Keep private view, spend and
          transaction keys, recovery seeds and wallet exports out of these forms.
        </p>
      </div>
    </section>
  );
}
