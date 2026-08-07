"use client";

import Link from "next/link";
import { PROVIDER_LABELS } from "@/lib/provider-labels";
import { buildNumberDetailHref } from "@/lib/favorites";
import type { FavoriteNumber } from "@/lib/favorites";
import { CopyButton } from "./CopyButton";
import { FavoriteButton } from "./FavoriteButton";
import { PhoneDisplay } from "./PhoneDisplay";

export function FavoritesList({ favorites }: { favorites: FavoriteNumber[] }) {
  if (!favorites.length) {
    return (
      <div className="glass-panel rounded-2xl px-6 py-20 text-center text-lg text-[var(--muted)]">
        还没有收藏号码。在号码卡片上点 ☆ 即可收藏，方便下次快速打开收短信。
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {favorites.map((n) => {
        const dial = n.dialCode || "";
        const national =
          n.nationalNumber || n.e164.replace(/\D/g, "").slice(dial.length);

        return (
          <article key={n.id} className="number-card glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-3xl leading-none">{n.flag || "🌐"}</span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--ink)]">
                    {n.countryName}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {PROVIDER_LABELS[n.providerId] || n.providerId}
                  </p>
                </div>
              </div>
              <FavoriteButton item={n} size="sm" />
            </div>

            <PhoneDisplay dialCode={dial} nationalNumber={national} />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <CopyButton value={n.e164} label="复制完整号" />
              <Link
                href={buildNumberDetailHref(n.id, { from: "favorites" })}
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
  );
}
