import { ReceiveTool } from "@/components/receive-tool";
import { ReceiveGuide } from "@/components/receive-guide";
import type { ViewQuery } from "@/lib/view-pages";
export const metadata = { title: "Verify received outputs" };
export default async function ReceivePage({ searchParams }: { searchParams: Promise<ViewQuery> }) {
  const query = await searchParams;
  const valid = Object.keys(query).every((key) => key === "tx") && (query.tx === undefined || typeof query.tx === "string" && /^[0-9a-fA-F]{64}$/.test(query.tx));
  return <>
    <div className="page-topline"><span className="eyebrow">EXPLORER / TOOLS</span><span className="read-time">LOCAL NATIVE RYO</span></div>
    <div className="page-heading"><div><h1>Verify received outputs</h1><p>Recognize your outputs and decode their amounts in one transaction.</p></div><a className="text-link" href="/tools">All tools</a></div>
    {valid ? <div className="tool-workspace"><ReceiveTool transaction={query.tx as string | undefined} /><ReceiveGuide /></div>
      : <p role="alert">Only an optional public TX hash is accepted in the URL. Enter the address and view key locally using this tool.</p>}
  </>;
}
