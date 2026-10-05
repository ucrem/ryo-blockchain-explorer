import { NextRequest } from "next/server";
import { ApiError, readPublic } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    if (
      request.headers.has("transfer-encoding") ||
      (request.headers.get("content-length") &&
        request.headers.get("content-length") !== "0")
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Request bodies are not supported.",
      );
    const path = (await params).path.join("/");
    const response = await readPublic(path, request.nextUrl.searchParams);
    // Preserve raw native JSON numeric tokens verbatim, without parse/stringify.
    return new Response(response.text, { status: response.status, headers });
  } catch (error) {
    const safe =
      error instanceof ApiError
        ? error
        : new ApiError(503, "unavailable", "The chain reader is unavailable.");
    return Response.json(
      { error: { code: safe.code, message: safe.message } },
      { status: safe.status, headers },
    );
  }
}
