"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function JsonPanel({
  original,
  formatted,
}: {
  original: string;
  formatted: string;
}) {
  const [pretty, setPretty] = useState(true);
  return (
    <section className="json-panel" aria-label="JSON viewer">
      <div className="json-toolbar">
        <h2 id="json-response-title">JSON response</h2>
        <div
          className="json-format-controls"
          role="group"
          aria-label="JSON formatting"
        >
          <Button
            variant={pretty ? "default" : "outline"}
            aria-pressed={pretty}
            onClick={() => setPretty(true)}
          >
            Formatted
          </Button>
          <Button
            variant={!pretty ? "default" : "outline"}
            aria-pressed={!pretty}
            onClick={() => setPretty(false)}
          >
            Original
          </Button>
        </div>
      </div>
      <pre
        className="json-code"
        tabIndex={0}
        role="region"
        aria-label="JSON response"
      >
        <code>{pretty ? formatted : original}</code>
      </pre>
    </section>
  );
}
