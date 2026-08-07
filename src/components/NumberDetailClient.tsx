"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PROVIDER_LABELS } from "@/lib/provider-labels";
import type { LineType } from "@/lib/phone";
import { favoriteFromNumberRow } from "@/lib/favorites";
import { fetchNumberMessages } from "@/lib/api-client";
import { isStaticExport } from "@/lib/site";
import { CopyButton } from "./CopyButton";
import { Disclaimer } from "./Disclaimer";
import { FavoriteButton } from "./FavoriteButton";
import { LineTypeBadge } from "./LineTypeBadge";
import { MessageList, type MessageItem } from "./MessageList";
import { PhoneDisplay } from "./PhoneDisplay";
import { StaticDemoBanner } from "./StaticDemoBanner";

interface NumberInfo {
  id: string;
  e164: string;
  country: string;
  countryNameZh?: string;
  providerId: string;
  dialCode?: string;
  nationalNumber?: string;
  flag?: string;
  lineType?: LineType;
  countryIso?: string;
}

export function NumberDetailClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const countryParam = searchParams.get("country");
  const fromParam = searchParams.get("from");
  const qParam = searchParams.get("q");

  const [number, setNumber] = useState<NumberInfo | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(() => !isStaticExport());

  const load = useCallback(
    async (force = false) => {
      setError(null);
      try {
        const json = await fetchNumberMessages(id, force);
        if (json.error && !json.messages) {
          throw new Error(json.error);
        }
        setNumber(json.number);
        setMessages(json.messages || []);
        setWarning(json.warning || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void load(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  const dial = number?.dialCode || "";
  const national =
    number?.nationalNumber ||
    (number ? number.e164.replace(/\D/g, "").slice(dial.length) : "");

  const backLink = useMemo(() => {
    if (fromParam === "favorites") {
      return { href: "/?view=favorites", label: "返回我的收藏" };
    }
    if (countryParam) {
      const name = number?.countryNameZh || number?.country || "该国";
      return {
        href: `/?country=${encodeURIComponent(countryParam)}`,
        label: `返回${name}号码列表`,
      };
    }
    if (fromParam === "search" && qParam) {
      return {
        href: `/?q=${encodeURIComponent(qParam)}`,
        label: "返回搜索结果",
      };
    }
    return { href: "/", label: "返回号码大厅" };
  }, [countryParam, fromParam, qParam, number?.countryNameZh, number?.country]);

  const favoriteItem = number
    ? favoriteFromNumberRow({
        id: number.id,
        e164: number.e164,
        country: number.country,
        countryNameZh: number.countryNameZh,
        flag: number.flag,
        dialCode: number.dialCode,
        nationalNumber: number.nationalNumber,
        providerId: number.providerId,
        countryIso: number.countryIso || countryParam || undefined,
      })
    : null;

  return (
    <div className="page-shell flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backLink.href}
          className="btn-ghost inline-flex cursor-pointer items-center gap-2"
        >
          <span aria-hidden>←</span>
          {backLink.label}
        </Link>
        <Link
          href="/"
          className="inline-flex cursor-pointer items-center text-sm font-medium text-[var(--muted)] transition hover:text-[var(--accent)]"
        >
          首页
        </Link>
      </div>

      <header className="animate-rise space-y-6">
        <StaticDemoBanner />
        <div className="hero-badge">FREE PCODE</div>
        {number ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-5xl leading-none">{number.flag || "🌐"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-[var(--ink)]">
                {number.countryNameZh || number.country}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {PROVIDER_LABELS[number.providerId] || number.providerId}
              </p>
            </div>
            {favoriteItem ? <FavoriteButton item={favoriteItem} /> : null}
            <LineTypeBadge type={number.lineType || "unknown"} />
          </div>
        ) : null}

        {number ? (
          <PhoneDisplay dialCode={dial} nationalNumber={national} size="lg" />
        ) : (
          <h1 className="font-display text-4xl font-extrabold text-[var(--ink)]">加载中…</h1>
        )}

        <div className="flex flex-wrap gap-3">
          {number ? <CopyButton value={number.e164} label="复制完整号" /> : null}
          {number && national ? <CopyButton value={national} label="复制号码" /> : null}
          {number && dial ? <CopyButton value={`+${dial}`} label="复制区号" /> : null}
          <button
            type="button"
            onClick={() => void load(true)}
            className="btn-ghost text-sm"
          >
            立即刷新
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="cursor-pointer"
            />
            自动刷新（约 5 秒）
          </label>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-5 py-4 text-sm leading-relaxed text-[var(--muted)]">
          提示：平台显示「已发送验证码」不等于本站收件箱一定能收到。公开共享号常被拦截、延迟或短信根本没进该上游线路。建议开着自动刷新 1–2
          分钟；仍没有就换另一个号码/来源重试。
        </div>
        <Disclaimer />
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          上游暂时异常，显示缓存短信：{warning}
        </div>
      ) : null}

      {loading ? (
        <p className="text-base text-[var(--muted)]">正在拉取短信…</p>
      ) : (
        <MessageList messages={messages} />
      )}
    </div>
  );
}
