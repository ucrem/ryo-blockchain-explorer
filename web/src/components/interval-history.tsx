import { IntervalChart } from "./interval-chart";
import { readBlockIntervals } from "@/lib/api";
export async function IntervalHistory({
  anchor,
  network,
}: {
  anchor?: string;
  network?: string;
}) {
  let initial = null;
  try {
    const result = await readBlockIntervals("1h", anchor);
    if (!network || result.meta.network === network) initial = result;
  } catch {
    /* The independent chart keeps a truthful unavailable state. */
  }
  return (
    <IntervalChart
      initial={initial}
      anchor={anchor ?? null}
      network={network ?? null}
    />
  );
}
