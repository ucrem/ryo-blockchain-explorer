import type { ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsonViewHref } from "@/lib/pretty-json";
import { ApiError } from "@/lib/api";

export function DetailHeading({
  kind,
  title,
  note,
  api,
  raw,
}: {
  kind: string;
  title: string;
  note: string;
  api: string;
  raw: string;
}) {
  return (
    <>
      <div className="page-topline">
        <a className="text-link" href="/">
          <ArrowLeft size={14} aria-hidden="true" />
          Overview
        </a>
        <span className="eyebrow">EXPLORER / {kind.toUpperCase()}</span>
      </div>
      <div className="page-heading detail-heading">
        <div>
          <h1>{title}</h1>
          <p>{note}</p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" asChild>
            <a href={jsonViewHref(api)}>
              {kind} JSON
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={jsonViewHref(raw)}>
              Raw JSON
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}
export function DetailRow({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "detail-row detail-wide" : "detail-row"}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
export function ResourceFailure({
  kind,
  error,
}: {
  kind: string;
  error: unknown;
}) {
  const status = error instanceof ApiError ? error.status : 503;
  const title =
    status === 404
      ? `${kind} not found`
      : status === 400
        ? "Invalid request"
        : status === 409
          ? "The chain changed"
          : "Chain reader unavailable";
  return (
    <section className="resource-failure">
      <h1>{title}</h1>
      <div className="notice" role="alert">
        <div>
          <p>
            {status === 404
              ? `This ${kind.toLowerCase()} is not available in this reader. Check the identifier or search again.`
              : error instanceof ApiError
                ? error.message
                : "Try refreshing shortly."}
          </p>
        </div>
      </div>
      <Button asChild variant="outline">
        <a href="/">Back to overview</a>
      </Button>
    </section>
  );
}
export function PageLinks({
  path,
  field,
  current,
  pages,
  other = {},
}: {
  path: string;
  field: string;
  current: number;
  pages: number;
  other?: Record<string, number>;
}) {
  const target = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...other, [field]: page }))
      if (value > 1) query.set(key, String(value));
    return `${path}${query.size ? `?${query}` : ""}`;
  };
  if (pages < 2) return null;
  return (
    <nav className="pagination" aria-label={`${field} pages`}>
      <p>
        Page {current} of {pages}
      </p>
      <div>
        {current > 1 && (
          <Button asChild variant="outline">
            <a href={target(current - 1)}>Previous {field}</a>
          </Button>
        )}
        {current < pages && (
          <Button asChild variant="outline">
            <a href={target(current + 1)}>Next {field}</a>
          </Button>
        )}
      </div>
    </nav>
  );
}
