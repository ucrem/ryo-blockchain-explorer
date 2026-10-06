import "server-only";
import { boundedJsonRead, upstreamOrigin } from "./upstream";
import { publicNodeStatus, type NodeObservation } from "./node-status";
import { observeNodeHealth, type ProgressObservation } from "./node-health";
import { readSyncError } from "./node-diagnostics";
const processState = globalThis as typeof globalThis & {
  ryoNodeObservation?: {
    origin: string;
    checked: number;
    data: NodeObservation;
    progress: ProgressObservation;
  };
};
export async function readNodeStatus(
  network?: string,
): Promise<NodeObservation | "unavailable" | null> {
  if (!process.env.RYO_DAEMON_RPC_URL) return null;
  let origin: string;
  try {
    origin = upstreamOrigin(process.env.RYO_DAEMON_RPC_URL);
  } catch {
    return "unavailable";
  }
  try {
    const saved = processState.ryoNodeObservation;
    const response = await boundedJsonRead(
      new URL("/get_info", origin),
      65536,
      5000,
    );
    if (response.status !== 200) throw new Error("Node unavailable");
    const status = publicNodeStatus(JSON.parse(response.text));
    if (network && status.network !== network)
      throw new Error("Node network differs");
    const checked = Date.now();
    const diagnostic = await readSyncError(checked);
    const previous = saved?.origin === origin ? saved.progress : undefined;
    const { health, progress } = observeNodeHealth(
      status,
      previous,
      checked,
      diagnostic.error,
      diagnostic.diagnostics,
    );
    const data = {
      ...status,
      checkedAt: new Date(checked).toISOString(),
      stale: false,
      health,
    };
    processState.ryoNodeObservation = { origin, checked, data, progress };
    return data;
  } catch {
    const saved = processState.ryoNodeObservation;
    if (
      saved &&
      saved.origin === origin &&
      Date.now() - saved.checked <= 60000 &&
      (!network || saved.data.network === network)
    )
      return { ...saved.data, stale: true };
    return "unavailable";
  }
}
