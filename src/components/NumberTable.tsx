"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PROVIDER_LABELS } from "@/lib/provider-labels";
import { buildNumberDetailHref } from "@/lib/favorites";
import type { LineType } from "@/lib/phone";
import { CopyButton } from "./CopyButton";
import { FavoriteButtonFromRow } from "./FavoriteButton";
import { LineTypeBadge } from "./LineTypeBadge";
import { PhoneDisplay } from "./PhoneDisplay";

export interface NumberRow {
  id: string;
  e164: string;
  country: string;
  countryNameZh?: string;
  providerId: string;
  lastSeenAt: number;
  dialCode?: string;
  nationalNumber?: string;
  flag?: string;
  countryIso?: string;
  lineType?: LineType;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function NumberTable({
  numbers,
  linkContext,
}: {
  numbers: NumberRow[];
  linkContext?: { country?: string; q?: string };
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  useEffect(() => {
    setPage(1);
  }, [numbers, pageSize]);

  const totalPages = Math.max(1, Math.ceil(numbers.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return numbers.slice(start, start + pageSize);
  }, [numbers, safePage, pageSize]);

  if (!numbers.length) {
    return (
      <div className="glass-panel rounded-2xl px-6 py-20 text-center text-lg text-[var(--muted)]">
        暂无号码。点击「同步全部来源」拉取公开临时号。
      </div>
    );
  }

  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, numbers.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/60 px-5 py-4 text-base text-[var(--muted)]">
        <span className="font-medium">
          显示 <span className="text-[var(--ink)]">{from}–{to}</span> / 共{" "}
          <span className="text-[var(--ink)]">{numbers.length}</span> 个
        </span>
        <label className="inline-flex cursor-pointer items-center gap-3">
          <span className="text-sm">每页显示</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="field-input w-auto min-w-[5.5rem] cursor-pointer py-2"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} 条
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pageItems.map((n, index) => {
          const dial = n.dialCode || "";
          const national =
            n.nationalNumber || n.e164.replace(/\D/g, "").slice(dial.length);
          const countryLabel = n.countryNameZh || n.country || "未知地区";
          const detailHref = buildNumberDetailHref(n.id, {
            country: linkContext?.country || n.countryIso || undefined,
            q: linkContext?.q,
          });

          return (
            <article
              key={n.id}
              className="number-card glass-panel rounded-2xl p-5"
              style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-3xl leading-none" title={countryLabel}>
                    {n.flag || "🌐"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--ink)]">
                      {countryLabel}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {PROVIDER_LABELS[n.providerId] || n.providerId}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <FavoriteButtonFromRow number={n} size="sm" />
                  <LineTypeBadge type={n.lineType || "unknown"} />
                </div>
              </div>

              <PhoneDisplay dialCode={dial} nationalNumber={national} />

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <CopyButton value={n.e164} label="复制完整号" />
                {dial && national ? (
                  <CopyButton value={national} label="复制号码" />
                ) : null}
                <Link
                  href={detailHref}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-2)]"
                >
                  <span aria-hidden>💬</span>
                  查看短信
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <PaginationBar page={safePage} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = visiblePages(page, totalPages);

  return (
    <nav className="pagination-bar" aria-label="分页导航">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="pagination-btn pagination-nav"
      >
        ← 上一页
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span
            key={`e-${i}`}
            className="px-2 text-base text-[var(--muted)]"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`pagination-btn ${p === page ? "is-active" : ""}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="pagination-btn pagination-nav"
      >
        下一页 →
      </button>
    </nav>
  );
}

function visiblePages(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (current >= total - 2) {
    set.add(total - 1);
    set.add(total - 2);
    set.add(total - 3);
  }

  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}
