"use client";
import { useEffect, useState } from "react";
import { Tooltip } from "radix-ui";
import { poolAge, timestamp } from "@/lib/format";
const explanation =
  "When this node recorded the transaction in its local mempool. Other nodes may record a different time. This is not a creation or confirmation timestamp; during sync it can refer to a downloaded historical transaction.";
export function PoolReceiveTime({
  value,
  nowUnix,
}: {
  value: string | null | undefined;
  nowUnix: string;
}) {
  const [now, setNow] = useState(nowUnix);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!value || value === "0") return;
    const timer = setInterval(() => {
      if (!document.hidden) setNow(Math.floor(Date.now() / 1000).toString());
    }, 10000);
    return () => clearInterval(timer);
  }, [value]);
  if (!value || value === "0")
    return <span aria-label="Local receive time unavailable">—</span>;
  const date = timestamp(value);
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="pool-receive-time"
            aria-label={`About this node's receive time: ${date}`}
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
          >
            <span>{date.replace(" UTC", "")}</span>
            <small>{poolAge(value, now)}</small>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <aside aria-label="Local receive time explanation">
            <Tooltip.Content
              className="pool-time-tooltip"
              side="top"
              sideOffset={8}
              collisionPadding={16}
            >
              {explanation}
              <Tooltip.Arrow />
            </Tooltip.Content>
          </aside>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
