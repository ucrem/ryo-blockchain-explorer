import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="not-found">
      <span className="eyebrow">404 / PAGE NOT FOUND</span>
      <h1>Outside this view.</h1>
      <p>This page is not available in the current explorer.</p>
      <Button asChild>
        <a href="/">Back to overview</a>
      </Button>
    </div>
  );
}
