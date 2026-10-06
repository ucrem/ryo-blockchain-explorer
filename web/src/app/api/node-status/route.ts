import { readNodeStatus } from "@/lib/daemon-api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const network = params.get("network") ?? undefined;
  if (
    [...params.keys()].some((key) => key !== "network") ||
    params.getAll("network").length > 1 ||
    (network !== undefined &&
      !["mainnet", "testnet", "stagenet"].includes(network))
  )
    return Response.json(
      { error: "Invalid node status request" },
      { status: 400 },
    );
  return Response.json(
    { status: await readNodeStatus(network) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
