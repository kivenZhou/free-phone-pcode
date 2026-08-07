"use client";

import { useEffect, useState } from "react";
import { formatMessageTime, isWithinDay } from "@/lib/time";

export function MessageTime({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!at || !isWithinDay(at)) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [at]);

  if (!at) return null;
  return (
    <time dateTime={new Date(at).toISOString()} className="text-sm text-[var(--muted)]">
      {formatMessageTime(at, now)}
    </time>
  );
}
