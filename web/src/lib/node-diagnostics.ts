import "server-only";
import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute } from "node:path";
import { parseSyncError, type NodeHealth, type SyncError } from "./node-health";

export async function readSyncError(now: number): Promise<{
  error: SyncError | null;
  diagnostics: NodeHealth["diagnostics"];
}> {
  const path = process.env.RYO_DAEMON_LOG_PATH;
  if (!path) return { error: null, diagnostics: "disabled" };
  const offset = process.env.RYO_DAEMON_LOG_UTC_OFFSET;
  if (
    !isAbsolute(path) ||
    !offset ||
    !/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/.test(offset)
  )
    return { error: null, diagnostics: "unavailable" };
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("Not a regular log file");
    const start = Math.max(0, stat.size - 65536);
    const bytes = Buffer.alloc(Math.min(stat.size, 65536));
    const { bytesRead } = await file.read(bytes, 0, bytes.length, start);
    let text = bytes.subarray(0, bytesRead).toString("utf8");
    if (start) text = text.slice(text.indexOf("\n") + 1);
    // Ignore a line still being written.
    text = text.slice(0, text.lastIndexOf("\n") + 1);
    return {
      error: parseSyncError(text, now, offset),
      diagnostics: "available",
    };
  } catch {
    return { error: null, diagnostics: "unavailable" };
  } finally {
    await file?.close();
  }
}
