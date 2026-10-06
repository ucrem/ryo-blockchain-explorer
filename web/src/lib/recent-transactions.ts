import type { z } from "zod";
import type {
  blockResponse,
  BlocksResponse,
  TransactionInspection,
} from "./contracts";

type BlockDetail = z.infer<typeof blockResponse>;
export type RecentTransaction = {
  hash: string;
  blockHeight: string;
  blockHash: string;
  timestamp: string;
  coinbase: boolean;
  feeAtomic: string | null;
  sizeBytes: string | null;
  inputCount: number | null;
  outputCount: number | null;
  inspection: TransactionInspection | null;
};

// Native summaries already identify a block's coinbase. Read detail only when
// ordinary transactions are present, with a bounded batch and no full-chain scan.
export async function recentTransactions(
  page: BlocksResponse,
  read: (hash: string) => Promise<BlockDetail>,
): Promise<{ items: RecentTransaction[]; limited: boolean }> {
  const selected: BlocksResponse["data"]["items"] = [];
  const requests: string[] = [];
  let count = 0;
  for (const block of page.data.items) {
    if (count >= 20) break;
    if (block.transaction_count > 1) {
      if (requests.length === 4) break;
      requests.push(block.hash);
    }
    selected.push(block);
    count += block.transaction_count;
  }
  const results = await Promise.allSettled(requests.map(read));
  const details = new Map<string, BlockDetail>();
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") throw result.reason;
    const expected = selected.find((b) => b.hash === requests[i])!;
    const actual = result.value;
    if (
      actual.meta.network !== page.meta.network ||
      actual.data.header.hash !== expected.hash ||
      actual.data.header.height !== expected.height ||
      actual.data.header.timestamp_unix !== expected.timestamp_unix ||
      actual.data.header.coinbase_hash !== expected.coinbase_hash ||
      actual.data.transactions.length !== expected.transaction_count
    )
      throw new Error("Transaction block snapshot changed");
    details.set(expected.hash, actual);
  }
  const items: RecentTransaction[] = [];
  for (const block of selected) {
    const transactions = details.get(block.hash)?.data.transactions ?? [
      {
        hash: block.coinbase_hash,
        coinbase: true,
        fee_atomic: null,
        size_bytes: null,
        input_count: 0,
        output_count: null,
        inspection: undefined,
      },
    ];
    for (const transaction of transactions) {
      if (items.length === 20) break;
      items.push({
        hash: transaction.hash,
        blockHeight: block.height,
        blockHash: block.hash,
        timestamp: block.timestamp_unix,
        coinbase: transaction.coinbase,
        feeAtomic: transaction.coinbase ? null : transaction.fee_atomic,
        sizeBytes: transaction.size_bytes,
        inputCount: transaction.input_count,
        outputCount: transaction.output_count,
        inspection: transaction.inspection ?? null,
      });
    }
  }
  if (new Set(items.map((tx) => tx.hash)).size !== items.length)
    throw new Error("Duplicate transactions in the block page");
  return {
    items,
    limited: count > items.length || selected.length < page.data.items.length,
  };
}
