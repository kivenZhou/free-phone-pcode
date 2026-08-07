"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface CountryOption {
  name: string;
  iso: string;
  flag: string;
  dialCode: string;
  count: number;
}

/** @deprecated alias for compatibility */
export type CountryChip = CountryOption;

export function CountrySelect({
  countries,
  value,
  onChange,
}: {
  countries: CountryOption[];
  value: string;
  onChange: (name: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => countries.find((c) => c.name === value || c.iso === value),
    [countries, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => {
      const dial = c.dialCode.replace(/\D/g, "");
      const qDigits = q.replace(/[^\d+]/g, "").replace(/^\+/, "");
      return (
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        `+${c.dialCode}`.includes(q) ||
        c.dialCode.includes(q) ||
        (qDigits.length > 0 && dial.startsWith(qDigits)) ||
        c.flag.includes(q)
      );
    });
  }, [countries, query]);

  useEffect(() => {
    if (!open) {
      setQuery(selected ? `${selected.flag} ${selected.name}` : "");
    }
  }, [open, selected]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`relative w-full ${open ? "z-50" : "z-10"}`}
    >
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={
            open
              ? query
              : selected
                ? `${selected.flag} ${selected.name}  (+${selected.dialCode})`
                : ""
          }
          placeholder="搜索国家 / 区号，如 美国、86、VN"
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
            if (e.key === "Enter" && filtered[0]) {
              e.preventDefault();
              pick(filtered[0].name);
            }
          }}
          className="w-full rounded-xl border border-[var(--line)] bg-white py-2.5 pl-3 pr-16 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
        />
        <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
          {value ? (
            <button
              type="button"
              aria-label="清除国家筛选"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-xs text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
            >
              清除
            </button>
          ) : null}
          <button
            type="button"
            aria-label="展开国家列表"
            onClick={() => {
              setOpen((v) => !v);
              if (!open) {
                setQuery("");
                inputRef.current?.focus();
              }
            }}
            className="rounded-lg px-2 py-1 text-[var(--muted)] hover:bg-black/5"
          >
            ▾
          </button>
        </div>
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[100] mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-[var(--line)] bg-white py-1 shadow-[0_12px_40px_rgba(15,28,36,0.18)]"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => pick("")}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--accent)]/8 ${
                !value ? "bg-[var(--accent)]/10 font-semibold text-[var(--accent)]" : "text-[var(--ink)]"
              }`}
            >
              <span>🌍</span>
              <span>全部国家 / 地区</span>
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-[var(--muted)]">没有匹配的国家</li>
          ) : (
            filtered.map((c) => {
              const active = value === c.name || value === c.iso;
              return (
                <li key={`${c.iso}-${c.name}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(c.name)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--accent)]/8 ${
                      active
                        ? "bg-[var(--accent)]/10 font-semibold text-[var(--accent)]"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-[var(--muted)]">+{c.dialCode}</span>
                    <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                      {c.count}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
