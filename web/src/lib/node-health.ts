import { z } from "zod";

export const syncError = z.object({
  code: z.enum([
    "transaction_verification_failed",
    "block_verification_failed",
  ]),
  at: z.iso.datetime(),
  blobHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
});
export type SyncError = z.infer<typeof syncError>;
export const nodeHealth = z.object({
  state: z.enum([
    "syncing",
    "error",
    "stalled",
    "connecting",
    "ready",
    "offline",
  ]),
  unchangedSince: z.iso.datetime(),
  diagnostics: z.enum(["available", "unavailable", "disabled"]),
  error: syncError.nullable(),
});
export type NodeHealth = z.infer<typeof nodeHealth>;
export const STALL_MS = 120_000;
export const ERROR_FRESH_MS = 120_000;

// Extract only recognized operational failures. Never return arbitrary log text,
// peer addresses, local paths, request bodies or exception messages.
export function parseSyncError(
  text: string,
  now: number,
  utcOffset = "+00:00",
): SyncError | null {
  if (!/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/.test(utcOffset)) return null;
  let latest: SyncError | null = null;
  for (const line of text.split("\n")) {
    const time = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) /.exec(line);
    if (!time) continue;
    const at = Date.parse(time[1].replace(" ", "T") + utcOffset);
    if (!Number.isFinite(at) || now - at < 0 || now - at > ERROR_FRESH_MS)
      continue;
    const tx =
      /transaction verification failed on NOTIFY_RESPONSE_GET_OBJECTS, tx_id = ([0-9a-f]{64}), dropping connection/.exec(
        line,
      );
    const block = line.includes(
      " Block verification failed, dropping connection",
    );
    if (tx && !line.includes("[ERROR/")) continue;
    if (!tx && !block) continue;
    if (!latest || at >= Date.parse(latest.at))
      latest = {
        code: tx
          ? "transaction_verification_failed"
          : "block_verification_failed",
        at: new Date(at).toISOString(),
        blobHash: tx?.[1] ?? null,
      };
  }
  return latest;
}

export type ProgressObservation = {
  network: string;
  height: string;
  hash: string;
  unchangedSince: number;
  checkedAt: number;
  errorsClearedThrough: number | null;
};
export function observeNodeHealth(
  status: {
    network: string;
    height: string;
    hash: string;
    targetHeight: string;
    ready: boolean;
    offline: boolean;
  },
  previous: ProgressObservation | undefined,
  now: number,
  error: SyncError | null,
  diagnostics: NodeHealth["diagnostics"],
): { progress: ProgressObservation; health: NodeHealth } {
  const same =
    previous?.network === status.network &&
    previous.height === status.height &&
    previous.hash === status.hash;
  const changed = previous && !same;
  const progress: ProgressObservation = {
    network: status.network,
    height: status.height,
    hash: status.hash,
    unchangedSince: same ? previous.unchangedSince : now,
    checkedAt: now,
    // An error after the previous sample can coincide with partial progress.
    // Only clear failures that precede the previous observed chain state.
    errorsClearedThrough: changed
      ? previous.checkedAt
      : same
        ? previous.errorsClearedThrough
        : null,
  };
  const freshError =
    error &&
    now - Date.parse(error.at) >= 0 &&
    now - Date.parse(error.at) <= ERROR_FRESH_MS &&
    (progress.errorsClearedThrough === null ||
      Date.parse(error.at) > progress.errorsClearedThrough)
      ? error
      : null;
  const syncing = BigInt(status.targetHeight) > BigInt(status.height);
  const state = status.offline
    ? "offline"
    : status.ready && !syncing
      ? "ready"
      : freshError
        ? "error"
        : syncing && now - progress.unchangedSince >= STALL_MS
          ? "stalled"
          : syncing
            ? "syncing"
            : "connecting";
  return {
    progress,
    health: {
      state,
      unchangedSince: new Date(progress.unchangedSince).toISOString(),
      diagnostics,
      error: state === "error" ? freshError : null,
    },
  };
}
