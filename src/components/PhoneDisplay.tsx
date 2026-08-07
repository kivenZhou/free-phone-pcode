"use client";

import { formatNational } from "@/lib/phone";

export function PhoneDisplay({
  dialCode,
  nationalNumber,
  size = "md",
}: {
  dialCode: string;
  nationalNumber: string;
  size?: "md" | "lg";
}) {
  const national = formatNational(nationalNumber, dialCode);
  const dial = dialCode ? `+${dialCode}` : "";

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 font-display tracking-tight text-[var(--ink)] ${
        size === "lg" ? "text-3xl sm:text-4xl" : "text-xl sm:text-[1.35rem]"
      }`}
    >
      {dial ? (
        <span className="inline-flex items-center rounded-lg bg-[var(--accent-2)]/10 px-2 py-0.5 font-bold text-[var(--accent-2)]">
          {dial}
        </span>
      ) : null}
      <span className="font-semibold tabular-nums">{national || nationalNumber}</span>
    </div>
  );
}
