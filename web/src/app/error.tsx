"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="not-found" role="alert">
      <span className="eyebrow">EXPLORER UNAVAILABLE</span>
      <h1>A moment out of view.</h1>
      <p>The page could not be loaded. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
