export function ReceiveGuide() {
  return (
    <section className="tool-guide" aria-labelledby="receive-guide-title">
      <h2 id="receive-guide-title">How to verify received outputs</h2>
      <div>
        <h3>What this reveals</h3>
        <p>Recognize the outputs intended for your address in one transaction and decode their amounts, including confidential RingCT amounts. Other recipients&apos; amounts remain hidden.</p>
      </div>
      <div>
        <h3>Where to find the inputs</h3>
        <ol>
          <li>Copy the TX ID from your wallet&apos;s transaction history, or choose Verify received outputs on an explorer transaction page.</li>
          <li>Copy the receiving address used for that payment from your wallet. Standard, integrated and subaddresses are supported.</li>
          <li>In your wallet&apos;s key/account details, reveal the <strong>private view key</strong> (64 hexadecimal characters). Depending on the wallet, this may require its password; the CLI wallet provides the <code>viewkey</code> command. A subaddress uses its account&apos;s private view key.</li>
          <li>Validate the address here, then enter the private view key and press Verify received outputs.</li>
        </ol>
        <p>The public view key shown by Address inspector cannot decode amounts. Never use a private spend key, recovery seed, private transaction key or wallet export. Kurz addresses are refused because their view key also grants spending access.</p>
      </div>
      <div>
        <h3>How to read the result</h3>
        <p>Each matching row shows its output index and exact RYO amount. The total sums only those outputs in this TX; it is not your balance, spendable funds or a full transaction history. It may include change. A valid key with no matching outputs means this address was not recognized in this TX.</p>
        <p>Key mismatch, unavailable chain data and corrupted commitments are reported separately. Native hash, output derivation and amount commitments are checked; this tool does not independently verify signatures, range proofs or chain consensus. Check current inclusion and confirmations on the transaction page.</p>
      </div>
      <div className="tool-guide-safety">
        <h3>Local privacy</h3>
        <p>Your address and private view key are processed only in a disposable worker in this browser. Only the public TX hash is requested from the server. Results are not saved or sent. The key field clears when used, cancelled or cleared; local verification has no server fallback.</p>
        <p>Use a trusted browser and HTTPS (or localhost). A view key reveals received-payment information; a compromised site or browser can still expose it. Browser strings cannot be guaranteed erased from memory. Never share a screenshot containing private information.</p>
      </div>
    </section>
  );
}
