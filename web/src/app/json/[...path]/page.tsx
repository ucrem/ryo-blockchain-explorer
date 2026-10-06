import { ArrowLeft, Download, ArrowUpRight } from "lucide-react";
import { ApiError, readPublic } from "@/lib/api";
import { publicIdentifier, publicPath } from "@/lib/contracts";
import { JsonPreviewLimit, prettyJson } from "@/lib/pretty-json";
import type { ViewQuery } from "@/lib/view-pages";
import { ResourceFailure } from "@/components/detail";
import { JsonViewDescription } from "@/components/json-guide";
import { JsonPanel } from "@/components/json-panel";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "JSON view" };
export default async function JsonPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<ViewQuery>;
}) {
  const path = (await params).path.join("/");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value !== "string")
      return (
        <ResourceFailure
          kind="JSON"
          error={
            new ApiError(
              400,
              "invalid_request",
              "Invalid JSON view parameters.",
            )
          }
        />
      );
    query.set(key, value);
  }
  if (!publicPath(path, query))
    return (
      <ResourceFailure
        kind="JSON"
        error={
          new ApiError(
            400,
            "invalid_request",
            "This public JSON view is not supported.",
          )
        }
      />
    );
  let response;
  try {
    response = await readPublic(path, query);
  } catch (error) {
    return <ResourceFailure kind="JSON" error={error} />;
  }
  if (response.status !== 200)
    return (
      <ResourceFailure
        kind="JSON"
        error={
          new ApiError(
            response.status,
            "unavailable",
            response.status === 409
              ? "The chain changed. Open the latest blocks and try again."
              : "The requested JSON response is not available. Try again shortly.",
          )
        }
      />
    );
  let formatted: string | null = null;
  try {
    formatted = prettyJson(response.text);
  } catch (error) {
    if (!(error instanceof JsonPreviewLimit))
      return (
        <ResourceFailure
          kind="JSON"
          error={
            new ApiError(
              503,
              "unavailable",
              "The chain reader returned an invalid JSON response.",
            )
          }
        />
      );
  }
  const blockId = path.match(/^(?:blocks|raw\/block)\/(.+)$/)?.[1];
  const txHash = path.match(
    /^(?:transactions|raw\/transaction)\/([0-9a-fA-F]{64})$/,
  )?.[1];
  const raw = path.startsWith("raw/");
  const title = blockId
    ? `${raw ? "Raw block" : "Block"} JSON`
    : txHash
      ? `${raw ? "Raw transaction" : "Transaction"} JSON`
      : path === "network"
        ? "Network JSON"
        : path === "blocks"
          ? "Block list JSON"
          : path === "mempool"
            ? "Mempool JSON"
            : path.startsWith("tools/")
              ? "Inspection result JSON"
              : "OpenAPI JSON";
  const back = blockId
    ? `/blocks/${publicIdentifier(blockId)?.value ?? blockId}`
    : txHash
      ? `/transactions/${txHash.toLowerCase()}`
      : path === "mempool"
        ? "/mempool"
        : path.startsWith("tools/")
          ? "/tools"
          : path === "openapi.json"
            ? "/developers"
            : "/";
  const backLabel = blockId
    ? "Back to block"
    : txHash
      ? "Back to transaction"
      : path === "mempool"
        ? "Back to mempool"
        : path.startsWith("tools/")
          ? "Back to tools"
          : path === "openapi.json"
            ? "Back to developer API"
            : "Back to overview";
  const api = `/api/v2/${path}${query.size ? `?${query}` : ""}`;
  return (
    <>
      <div className="page-topline">
        <a href={back} className="text-link">
          <ArrowLeft size={14} aria-hidden="true" />
          {backLabel}
        </a>
        <span className="eyebrow">EXPLORER / JSON VIEW</span>
      </div>
      <div className="page-heading detail-heading">
        <div>
          <h1>{title}</h1>
          <p>Public response · Exact original values</p>
        </div>
        <div className="heading-actions">
          <Button asChild variant="outline">
            <a href={api} download="ryo-response.json">
              <Download aria-hidden="true" />
              Download JSON
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={api}>
              API endpoint
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
      {(blockId || txHash) && (
        <JsonViewDescription
          kind={blockId ? "Block" : "Transaction"}
          raw={raw}
        />
      )}
      {formatted === null ? (
        <div className="notice" role="status">
          <div>
            <strong>Response exceeds the formatted preview limit</strong>
            <p>
              This response is too large or deeply nested for the embedded
              preview. Download the complete JSON using the button above.
            </p>
          </div>
        </div>
      ) : (
        <JsonPanel original={response.text} formatted={formatted} />
      )}
    </>
  );
}
