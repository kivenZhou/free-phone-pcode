"use client";

import type { CountryOption } from "./CountrySelect";

export function CountryGrid({
  countries,
  onSelect,
}: {
  countries: CountryOption[];
  onSelect: (value: string) => void;
}) {
  if (!countries.length) {
    return (
      <div className="glass-panel rounded-2xl px-6 py-20 text-center text-lg text-[var(--muted)]">
        暂无国家数据。点击「同步全部来源」拉取公开临时号。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {countries.map((c, index) => {
        const value = c.iso && c.iso !== "XX" ? c.iso : c.name;
        return (
          <button
            key={`${c.iso}-${c.name}`}
            type="button"
            onClick={() => onSelect(value)}
            className="country-card glass-panel flex flex-col items-center gap-3 rounded-2xl px-4 py-7 text-center"
            style={{ animationDelay: `${Math.min(index, 20) * 0.02}s` }}
          >
            <span className="text-5xl leading-none sm:text-6xl" aria-hidden>
              {c.flag || "🌐"}
            </span>
            <span className="w-full truncate text-base font-semibold text-[var(--ink)]">
              {c.name}
            </span>
            <span className="text-sm text-[var(--muted)]">
              {c.dialCode ? `+${c.dialCode}` : "区号未知"}
            </span>
            <span className="rounded-lg bg-[var(--accent)]/10 px-3 py-1 text-xs font-bold text-[var(--accent)]">
              {c.count} 个号码
            </span>
          </button>
        );
      })}
    </div>
  );
}
