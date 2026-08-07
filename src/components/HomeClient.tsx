"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CountryGrid } from "./CountryGrid";
import { Disclaimer } from "./Disclaimer";
import { FavoritesList } from "./FavoritesList";
import { Filters } from "./Filters";
import { NumberTable } from "./NumberTable";
import { StaticDemoBanner } from "./StaticDemoBanner";
import { useFavorites } from "@/hooks/useFavorites";
import {
  fetchNumbersCatalog,
  triggerRefresh,
  type NumbersCatalogResponse,
} from "@/lib/api-client";
import { isStaticExport } from "@/lib/site";

export function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const viewParam = searchParams.get("view");
  const country = viewParam === "favorites" ? "" : searchParams.get("country") || "";
  const q = viewParam === "favorites" ? "" : searchParams.get("q") || "";
  const showFavorites = viewParam === "favorites";

  const [provider, setProvider] = useState("");
  const [lineType, setLineType] = useState("");
  const [data, setData] = useState<NumbersCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { favorites } = useFavorites();

  const browseCountries = !showFavorites && !country && !q.trim();

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (country) p.set("country", country);
    if (provider) p.set("provider", provider);
    if (lineType) p.set("lineType", lineType);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [country, provider, lineType, q]);

  const load = useCallback(async () => {
    if (showFavorites) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await fetchNumbersCatalog(queryString);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [queryString, showFavorites]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.syncing) return;
    const timer = setInterval(() => {
      void load();
    }, 2500);
    return () => clearInterval(timer);
  }, [data?.syncing, load]);

  function navigate(next: { view?: string; country?: string; q?: string }) {
    const p = new URLSearchParams();
    if (next.view === "favorites") {
      p.set("view", "favorites");
    } else {
      if (next.country) p.set("country", next.country);
      if (next.q?.trim()) p.set("q", next.q.trim());
    }
    const qs = p.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  function onCountrySelect(value: string) {
    navigate({ country: value });
  }

  function onQueryChange(value: string) {
    if (value.trim()) {
      navigate({ q: value });
    } else if (country) {
      navigate({ country });
    } else {
      router.push("/");
    }
  }

  async function onRefresh() {
    if (isStaticExport()) return;
    setRefreshing(true);
    try {
      await triggerRefresh();
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const okCount = data?.health?.filter((h) => h.status === "ok").length ?? 0;
  const selectedCountry = useMemo(
    () =>
      data?.countries?.find((c) => c.iso === country || c.name === country) ??
      null,
    [data?.countries, country],
  );

  return (
    <div className="page-shell flex flex-col gap-8 lg:gap-10">
      <header className="animate-rise space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="hero-badge">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            FREE PCODE
          </div>
          <button
            type="button"
            onClick={() => navigate({ view: "favorites" })}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              showFavorites
                ? "border-amber-300 bg-amber-50 text-amber-600"
                : "border-[var(--line)] bg-white/75 text-[var(--ink)] hover:border-amber-300 hover:text-amber-600"
            }`}
          >
            <span aria-hidden>★</span>
            我的收藏
            {favorites.length ? (
              <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-xs">
                {favorites.length}
              </span>
            ) : null}
          </button>
        </div>
        <h1 className="font-display max-w-4xl text-5xl font-extrabold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-6xl lg:text-7xl">
          Free PCode
          <span className="mt-3 block text-3xl font-semibold text-[var(--accent-2)] sm:text-4xl">
            免费公开接码聚合
          </span>
        </h1>
        <p className="max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
          先选国家旗帜，再浏览该国公开临时号；支持收藏常用号码，快速回到收短信页面。
        </p>
        <Disclaimer />
        <StaticDemoBanner builtAt={data?.builtAt} />
      </header>

      {!showFavorites ? (
        <Filters
          providers={data?.providers ?? []}
          provider={provider}
          lineType={lineType}
          q={q}
          onProviderChange={setProvider}
          onLineTypeChange={setLineType}
          onQueryChange={onQueryChange}
          onRefresh={onRefresh}
          refreshing={refreshing}
          showRefresh={!isStaticExport()}
        />
      ) : null}

      {!showFavorites && data?.health?.length ? (
        <div className="relative z-0 flex flex-wrap gap-2.5">
          {data.health.map((h) => (
            <span
              key={h.id}
              title={h.lastError || undefined}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium ${
                h.status === "ok"
                  ? "bg-[var(--ok)]/10 text-[var(--ok)]"
                  : "bg-black/5 text-[var(--muted)]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  h.status === "ok" ? "bg-[var(--ok)]" : "bg-[var(--muted)]"
                }`}
              />
              {h.name}
              {typeof h.numberCount === "number" ? ` · ${h.numberCount}` : ""}
              {h.status !== "ok" ? " · 暂不可用" : ""}
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-base text-[var(--muted)]">
        <span>
          {showFavorites
            ? `收藏 ${favorites.length} 个号码`
            : loading
              ? "加载中…"
              : browseCountries
                ? `共 ${data?.countries?.length ?? 0} 个国家 · ${data?.total ?? 0} 个号码`
                : `共 ${data?.total ?? 0} 个号码`}
          {!showFavorites && data?.syncing ? " · 后台同步中…" : ""}
          {!showFavorites && okCount ? ` · ${okCount} 个来源在线` : ""}
          {!showFavorites && data?.lastRefreshAt
            ? ` · 同步于 ${new Date(data.lastRefreshAt).toLocaleString("zh-CN")}`
            : ""}
        </span>
        {!showFavorites ? (
          <span className="inline-flex items-center gap-4 text-sm">
            <span>☁️ 虚拟号</span>
            <span>📶 实体卡</span>
          </span>
        ) : null}
      </div>

      {showFavorites ? (
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => router.push("/")} className="btn-ghost">
            <span aria-hidden>←</span>
            返回国家列表
          </button>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-5 py-3 text-base font-semibold text-amber-600">
            <span aria-hidden>★</span>
            我的收藏
          </div>
        </div>
      ) : null}

      {!showFavorites && !browseCountries ? (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="btn-ghost"
          >
            <span aria-hidden>←</span>
            全部国家
          </button>
          {selectedCountry ? (
            <div className="inline-flex items-center gap-3 rounded-2xl bg-[var(--accent)]/10 px-5 py-3 text-base font-semibold text-[var(--accent)]">
              <span className="text-3xl leading-none">{selectedCountry.flag}</span>
              <span>{selectedCountry.name}</span>
              {selectedCountry.dialCode ? (
                <span className="font-normal text-[var(--muted)]">
                  +{selectedCountry.dialCode}
                </span>
              ) : null}
            </div>
          ) : q.trim() ? (
            <div className="text-base text-[var(--muted)]">
              搜索：<span className="font-semibold text-[var(--ink)]">{q.trim()}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {showFavorites ? (
        <FavoritesList favorites={favorites} />
      ) : browseCountries ? (
        <CountryGrid countries={data?.countries ?? []} onSelect={onCountrySelect} />
      ) : (
        <NumberTable
          numbers={data?.numbers ?? []}
          linkContext={{ country: country || undefined, q: q || undefined }}
        />
      )}
    </div>
  );
}
