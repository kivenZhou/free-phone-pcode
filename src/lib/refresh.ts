import {
  applyProviderSync,
  getSyncMeta,
  hasStoredNumbers,
  setSyncMeta,
} from "./db";
import { encodeNumberId, mapPool } from "./http";
import { getProvider, getProviders } from "./providers/registry";
import type { SmsProvider } from "./providers/types";

let refreshPromise: Promise<{ ok: string[]; failed: Array<{ id: string; error: string }> }> | null =
  null;
let intervalStarted = false;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const REFRESH_CONCURRENCY = envInt("REFRESH_CONCURRENCY", 5);

export function isRefreshRunning(): boolean {
  return refreshPromise !== null;
}

async function syncOneProvider(provider: SmsProvider) {
  try {
    const numbers = await provider.listNumbers();
    await applyProviderSync(
      provider.id,
      numbers,
      {
        id: provider.id,
        name: provider.name,
        status: numbers.length ? "ok" : "degraded",
        lastSuccessAt: Date.now(),
        numberCount: numbers.length,
        lastError: numbers.length ? undefined : "Returned zero numbers",
      },
      (n) => encodeNumberId(n.providerId, n.e164),
    );
    return { ok: provider.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await applyProviderSync(
      provider.id,
      [],
      {
        id: provider.id,
        name: provider.name,
        status: "degraded",
        lastError: message,
        numberCount: 0,
      },
      (n) => encodeNumberId(n.providerId, n.e164),
    );
    return { failed: { id: provider.id, error: message } };
  }
}

export async function refreshProviders(providerId?: string) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const targets = (
      providerId ? [getProvider(providerId)].filter(Boolean) : getProviders()
    ) as SmsProvider[];

    const outcomes = await mapPool(targets, REFRESH_CONCURRENCY, syncOneProvider);

    const ok: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const outcome of outcomes) {
      if ("ok" in outcome && outcome.ok) ok.push(outcome.ok);
      if ("failed" in outcome && outcome.failed) failed.push(outcome.failed);
    }

    await setSyncMeta("last_refresh_at", String(Date.now()));
    await setSyncMeta(
      "last_refresh_result",
      JSON.stringify({ ok, failed, at: Date.now() }),
    );
    return { ok, failed };
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/** 缓存过期时在后台刷新；空库则阻塞到首次同步完成。 */
export async function ensureFreshData(maxAgeMs = 10 * 60 * 1000) {
  const last = Number((await getSyncMeta("last_refresh_at")) || 0);
  const stale = !last || Date.now() - last > maxAgeMs;
  if (!stale) return;

  const running = refreshProviders();
  if (!(await hasStoredNumbers())) {
    await running;
    return;
  }
  void running.catch(() => undefined);
}

/** 本地 Node 常驻进程用；Cloudflare 上请用定时任务调 /api/cron/refresh */
export function startBackgroundRefresh(intervalMs = 8 * 60 * 1000) {
  if (process.env.DISABLE_BACKGROUND_REFRESH === "1") return;
  if (intervalStarted || typeof setInterval === "undefined") return;
  intervalStarted = true;
  setTimeout(() => {
    void refreshProviders().catch(() => undefined);
  }, 1500);
  setInterval(() => {
    void refreshProviders().catch(() => undefined);
  }, intervalMs);
}
