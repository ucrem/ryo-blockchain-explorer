"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { coins } from "@/lib/format";
import { localRyo, publicTransaction, type LocalAddress, type ReceiveResult } from "@/lib/receive-verifier";
const subscribe = () => () => {};

export function ReceiveTool({ transaction = "" }: { transaction?: string }) {
  const hash = useRef<HTMLInputElement>(null), address = useRef<HTMLInputElement>(null), key = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const [validated, setValidated] = useState<{ text: string; info: LocalAddress } | null>(null);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const [result, setResult] = useState<ReceiveResult | null>(null);
  const secure = useSyncExternalStore(subscribe, () => window.isSecureContext, () => null);
  useEffect(() => {
    const secretInput = key.current, addressInput = address.current;
    const discard = () => {
      operation.current?.abort(); operation.current = null;
      if (secretInput) secretInput.value = "";
      if (addressInput) addressInput.value = "";
    };
    const leaving = () => {
      discard(); setResult(null); setValidated(null); setStatus(""); setBusy(false);
    };
    const returning = (event: PageTransitionEvent) => { if (event.persisted) leaving(); };
    window.addEventListener("pagehide", leaving);
    window.addEventListener("pageshow", returning);
    return () => {
      window.removeEventListener("pagehide", leaving);
      window.removeEventListener("pageshow", returning);
      discard();
    };
  }, []);
  function stop() {
    operation.current?.abort(); operation.current = null;
    if (key.current) key.current.value = "";
    setBusy(false); setResult(null); setStatus("");
  }
  function invalidateAddress() { stop(); setValidated(null); }
  function start() {
    stop(); const controller = new AbortController(); operation.current = controller; setBusy(true);
    return controller;
  }
  async function inspect() {
    const text = address.current!.value.trim();
    const controller = start(); setValidated(null); setStatus("Checking address locally…");
    try {
      const info = await localRyo<LocalAddress>({ action: "inspect", address: text }, controller.signal);
      if (controller.signal.aborted) return;
      setValidated({ text, info });
      setStatus(info.private_key_allowed ? `Validated ${info.kind} · ${info.network}. Enter the private view key.`
        : "This Kurz/shared-key address cannot be used safely here. Its view key may also grant spending access; do not enter it.");
    } catch (error) { if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Local address check failed."); }
    finally { if (!controller.signal.aborted) { operation.current = null; setBusy(false); } }
  }
  async function verify() {
    if (!validated?.info.private_key_allowed || !secure) return;
    // Secret stays out of React state/props and is cleared before any request.
    let secret = key.current!.value.trim(); key.current!.value = "";
    const controller = start();
    const tx = hash.current!.value.trim().toLowerCase();
    try {
      if (!/^[0-9a-f]{64}$/i.test(secret)) throw new Error("Enter the 64-character hexadecimal private view key.");
      if (!/^[0-9a-f]{64}$/.test(tx)) throw new Error("Enter a 64-character transaction hash.");
      setStatus("Checking the view key locally…");
      await localRyo<LocalAddress>({ action: "check", address: validated.text, view_key: secret }, controller.signal);
      setStatus("Reading public transaction bytes…");
      const fetchDeadline = setTimeout(() => controller.abort(), 10_000);
      let publicData;
      try { publicData = await publicTransaction(tx, controller.signal); }
      finally { clearTimeout(fetchDeadline); }
      if (publicData.network !== validated.info.network) throw new Error("The address belongs to a different network from this transaction reader.");
      setStatus("Recognizing outputs and checking native amount commitments locally…");
      const checked = await localRyo<ReceiveResult>({ action: "verify", address: validated.text, view_key: secret, ...publicData }, controller.signal);
      if (controller.signal.aborted) return;
      setResult(checked); setStatus(checked.outputs.length ? "Local verification complete." : "No outputs recognized for this address in this transaction.");
    } catch (error) {
      if (operation.current === controller) setStatus(controller.signal.aborted ? "Transaction read timed out. Try again when the reader is available." : error instanceof Error ? error.message : "Local verification failed.");
    } finally {
      secret = "";
      if (operation.current === controller) { operation.current = null; setBusy(false); }
    }
  }
  return (
    <section className="tool-form-panel" aria-labelledby="receive-tool-title">
      <h2 id="receive-tool-title">Verify received outputs</h2>
      <div className="tool-form">
        <label>Transaction hash<input ref={hash} defaultValue={transaction} maxLength={64} autoComplete="off" spellCheck={false} onChange={stop} /></label>
        <label>Receiving Ryo address<input ref={address} maxLength={200} autoComplete="off" spellCheck={false} onChange={invalidateAddress} /></label>
        <Button type="button" variant="outline" disabled={busy || secure === null} onClick={inspect}>Validate address locally</Button>
        <label>Private view key<input ref={key} type="password" maxLength={64} autoComplete="off" spellCheck={false} disabled={!secure || !validated?.info.private_key_allowed || busy} aria-describedby="receive-key-note" onChange={() => { setResult(null); setStatus(""); }} /></label>
        <p className="table-note" id="receive-key-note">Use the private view key from your wallet. Never enter a spend key or recovery seed. The key is cleared when used.</p>
        {secure === false && <p className="receive-warning">Private-key input requires HTTPS or localhost. This HTTP preview is for viewing the interface only.</p>}
        <div className="receive-actions">
          <Button type="button" disabled={busy || !secure || !validated?.info.private_key_allowed} onClick={verify}>Verify received outputs</Button>
          <Button type="button" variant="outline" onClick={() => { stop(); if (address.current) address.current.value = ""; if (hash.current) hash.current.value = ""; setValidated(null); }}>{busy ? "Cancel and clear" : "Clear inputs and results"}</Button>
        </div>
        <p className="receive-status" role="status" aria-live="polite">{status}</p>
      </div>
      <p className="table-note">Local verification requires JavaScript. There is no server submission or fallback.</p>
      {result && <section className="tool-result" aria-label="Received output result">
        <h3>{result.outputs.length ? "Outputs recognized for this address" : "No recognized outputs"}</h3>
        <p>{result.network} · Native TX version {result.version} · {result.outputs.length} of {result.output_count} outputs recognized</p>
        {result.outputs.length > 0 && <>
          <div className="table-scroll"><table className="receive-table"><thead><tr><th scope="col">Output index</th><th scope="col">Decoded amount</th></tr></thead><tbody>{result.outputs.map((output) => <tr key={output.index}><th scope="row">{output.index}</th><td>{coins(output.amount_atomic)}</td></tr>)}</tbody></table></div>
          <p className="receive-total">Recognized total: <strong>{coins(result.total_atomic)}</strong></p>
        </>}
        <p>This is a total for this transaction, not your balance. Outputs may include change; other recipients&apos; amounts remain hidden.</p>
        <a className="text-link" href={`/transactions/${result.hash}`}>View transaction inclusion and confirmations</a>
      </section>}
    </section>
  );
}
