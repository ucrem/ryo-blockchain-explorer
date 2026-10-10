// Worker messages are local only. Never pass these types to a server action/API.
export type LocalAddress = {
  network: "mainnet" | "testnet" | "stagenet";
  kind: string;
  private_key_allowed: boolean;
};
export type ReceiveResult = {
  hash: string;
  network: string;
  version: number;
  ringct_type: number;
  output_count: number;
  outputs: { index: number; amount_atomic: string }[];
  total_atomic: string;
};
type LocalResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function localRyo<T>(input: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Verification cancelled.")); return; }
    let worker: Worker;
    try { worker = new Worker("/crypto/receive-worker.js", { type: "module" }); }
    catch { reject(new Error("Local verification is unavailable in this browser.")); return; }
    const finish = () => {
      clearTimeout(deadline);
      signal.removeEventListener("abort", cancel);
      worker.terminate();
    };
    const cancel = () => { finish(); reject(new Error("Verification cancelled.")); };
    const deadline = setTimeout(() => {
      finish(); reject(new Error("Local verification exceeded its 15-second limit. No server fallback is used."));
    }, 15_000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onerror = (event) => {
      event.preventDefault(); finish();
      reject(new Error("The local Ryo module could not run. No server fallback is used."));
    };
    worker.onmessage = ({ data }: MessageEvent<LocalResponse<T>>) => {
      finish();
      if (data.ok) resolve(data.data);
      else reject(new Error(data.error.message));
    };
    worker.postMessage(input);
  });
}

// Fetch only the public hash; address, key and decoded amounts stay local.
export async function publicTransaction(hash: string, signal: AbortSignal) {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("Enter a 64-character transaction hash.");
  const response = await fetch(`/api/v2/raw/transaction/${hash}`, {
    signal, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(response.status === 404
    ? "Transaction not found in this reader's chain or mempool. It may still need synchronization."
    : "Transaction data is unavailable. Check the node status and try again.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Transaction data is unavailable.");
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) throw new Error("Transaction response exceeds the local verification bounds.");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel(); }
  const result = JSON.parse(text);
  if (result.data?.hash !== hash || !["mainnet", "testnet", "stagenet"].includes(result.meta?.network)
      || typeof result.data?.blob_hex !== "string" || result.data.blob_hex.length > 8 * 1024 * 1024
      || !/^(?:[0-9a-fA-F]{2})+$/.test(result.data.blob_hex))
    throw new Error("The reader returned invalid transaction data.");
  return { hash, network: result.meta.network as string, blob_hex: result.data.blob_hex as string };
}
