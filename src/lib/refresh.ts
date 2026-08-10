import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  applyProviderSync,
  getSyncMeta,
  hasStoredNumbers,
  setSyncMeta,
  upsertProviderHealth,
} from "./db";
import { encodeNumberId, mapPool } from "./http";
import { getProvider, getProviders } from "./providers/registry";
import type { SmsProvider } from "./providers/types";

type RefreshResult = {
  ok: string[];
  failed: Array<{ id: string; error: string }>;
  alreadyRunning?: boolean;
};

let refreshPromise: Promise<RefreshResult> | null = null;
let intervalStarted = false;

const SYNC_LOCK_KEY = "refresh_started_at";
/** Stale lock TTL — Worker may be killed mid-sync */
const SYNC_LOCK_TTL_MS = 15 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Cloudflare Workers (or any env that must not rely on in-process timers). */
function isServerlessRuntime(): boolean {
  return process.env.DISABLE_BACKGROUND_REFRESH === "1";
}

const REFRESH_CONCURRENCY = envInt(
  "REFRESH_CONCURRENCY",
  isServerlessRuntime() ? 2 : 5,
);

async function readSyncLockAge(): Promise<number | null> {
  const started = Number((await getSyncMeta(SYNC_LOCK_KEY)) || 0);
  if (!started) return null;
  const age = Date.now() - started;
  if (age > SYNC_LOCK_TTL_MS) {
    await setSyncMeta(SYNC_LOCK_KEY, "");
    return null;
  }
  return age;
}

async function markSyncStarted(): Promise<void> {
  await setSyncMeta(SYNC_LOCK_KEY, String(Date.now()));
}

async function markSyncFinished(): Promise<void> {
  await setSyncMeta(SYNC_LOCK_KEY, "");
}

export async function isRefreshRunning(): Promise<boolean> {
  if (refreshPromise !== null) return true;
  return (await readSyncLockAge()) !== null;
}

async function syncOneProvider(provider: SmsProvider) {
  try {
    const numbers = await provider.listNumbers();
    // Keep existing numbers when a scrape returns empty (common on Workers:
    // blocked pages / subrequest limits). Only replace on a non-empty result.
    if (!numbers.length) {
      await upsertProviderHealth({
        id: provider.id,
        name: provider.name,
        status: "degraded",
        lastError: "Returned zero numbers (kept previous data)",
      });
      return { failed: { id: provider.id, error: "Returned zero numbers" } };
    }

    await applyProviderSync(
      provider.id,
      numbers,
      {
        id: provider.id,
        name: provider.name,
        status: "ok",
        lastSuccessAt: Date.now(),
        numberCount: numbers.length,
      },
      (n) => encodeNumberId(n.providerId, n.e164),
    );
    return { ok: provider.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertProviderHealth({
      id: provider.id,
      name: provider.name,
      status: "degraded",
      lastError: message,
    });
    return { failed: { id: provider.id, error: message } };
  }
}

export async function refreshProviders(providerId?: string): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise;

  if ((await readSyncLockAge()) !== null) {
    return { ok: [], failed: [], alreadyRunning: true };
  }

  await markSyncStarted();

  refreshPromise = (async () => {
    try {
      const targets = (
        providerId
          ? [(await getProvider(providerId))].filter(Boolean)
          : await getProviders()
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
    } finally {
      await markSyncFinished();
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Keep the refresh Promise alive after the HTTP response on Cloudflare.
 * Without waitUntil, workerd may terminate the isolate as soon as the response is sent.
 */
async function keepAlive(work: Promise<unknown>): Promise<void> {
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(work.then(() => undefined, () => undefined));
  } catch {
    void work.catch(() => undefined);
  }
}

/** Start a full sync without blocking the caller (Cloudflare-safe). */
export async function startRefreshInBackground(
  providerId?: string,
): Promise<{ started: boolean; syncing: boolean }> {
  if (await isRefreshRunning()) {
    return { started: false, syncing: true };
  }

  const work = refreshProviders(providerId);
  await keepAlive(work);
  return { started: true, syncing: true };
}

/** 缓存过期时后台刷新；Node 空库可阻塞到首次同步，Cloudflare 绝不阻塞请求。 */
export async function ensureFreshData(maxAgeMs = 10 * 60 * 1000) {
  const last = Number((await getSyncMeta("last_refresh_at")) || 0);
  const stale = !last || Date.now() - last > maxAgeMs;
  if (!stale) return;
  if (await isRefreshRunning()) return;

  if (isServerlessRuntime()) {
    await startRefreshInBackground();
    return;
  }

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
