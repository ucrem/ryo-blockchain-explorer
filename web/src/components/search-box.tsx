"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SearchBox() {
  const holder = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const placement = useRef(false);
  const focus = useRef<{ start: number | null; end: number | null } | null>(
    null,
  );
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [docked, setDocked] = useState(false);
  const [height, setHeight] = useState<number>();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const element = holder.current;
    const header = document.querySelector<HTMLElement>(".site-header");
    const target = document.getElementById("header-search-slot");
    if (!element || !header || !target) return;
    const check = () => {
      const next =
        element.getBoundingClientRect().bottom <=
        header.getBoundingClientRect().bottom;
      if (next === placement.current) return;
      focus.current =
        document.activeElement === input.current && input.current
          ? {
              start: input.current.selectionStart,
              end: input.current.selectionEnd,
            }
          : null;
      if (next) setHeight(element.offsetHeight);
      placement.current = next;
      setDocked(next);
    };
    const frame = requestAnimationFrame(() => {
      setSlot(target);
      check();
    });
    const observer = new ResizeObserver(check);
    observer.observe(element);
    observer.observe(header);
    window.addEventListener("scroll", check, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", check);
    };
  }, []);

  useLayoutEffect(() => {
    if (!focus.current || !input.current) return;
    input.current.focus({ preventScroll: true });
    input.current.setSelectionRange(focus.current.start, focus.current.end);
    focus.current = null;
  }, [docked]);

  const form = (
    <form action="/search" method="get" role="search" className="chain-search">
      <label htmlFor="chain-query" className={docked ? "sr-only" : undefined}>
        Search the Ryo blockchain
      </label>
      <div className="search-controls">
        <input
          ref={input}
          id="chain-query"
          name="q"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          required
          maxLength={64}
          placeholder={
            docked
              ? "Height or hash"
              : "Block height, block hash or transaction hash"
          }
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby="search-help"
        />
        <Button type="submit">
          <Search aria-hidden="true" />
          <span className={docked ? "sr-only" : undefined}>Search</span>
        </Button>
      </div>
      <p id="search-help" className={docked ? "sr-only" : undefined}>
        Enter a block height or a public 64-character hash.
      </p>
    </form>
  );
  return (
    <div
      ref={holder}
      className="search-placement"
      style={docked ? { height } : undefined}
    >
      {docked && slot ? createPortal(form, slot) : form}
    </div>
  );
}
