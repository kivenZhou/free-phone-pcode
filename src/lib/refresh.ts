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
  /** false while more provider batches remain */
  done?: boolean;
  pending?: number;
  batch?: string[];
};

type CycleProgress = {
  pending: string[];
  ok: string[];
  failed: Array<{ id: string; error: string }>;
};

let refreshPromise: Promise<RefreshResult> | null = null;
let intervalStarted = false;

const SYNC_LOCK_KEY = "refresh_started_at";
const SYNC_PENDING_KEY = "refresh_pending";
const SYNC_PROGRESS_KEY = "refresh_progress";
/** Stale lock TTL — Worker may be killed mid-sync */
const SYNC_LOCK_TTL_MS = 20 * 60 * 1000;

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

/** Providers per Worker invocation. Free plan ~50 subrequests — keep tiny. */
const REFRESH_BATCH_SIZE = envInt(
  "REFRESH_BATCH_SIZE",
  isServerlessRuntime() ? 1 : 100,
);

const REFRESH_CONCURRENCY = envInt(
  "REFRESH_CONCURRENCY",
  isServerlessRuntime() ? 1 : 5,
);

async function readSyncLockAge(): Promise<number | null> {
  const started = Number((await getSyncMeta(SYNC_LOCK_KEY)) || 0);
  if (!started) return null;
  const age = Date.now() - started;
  if (age > SYNC_LOCK_TTL_MS) {
    await clearCycle();
    return null;
  }
  return age;
}

async function readProgress(): Promise<CycleProgress> {
  const raw = (await getSyncMeta(SYNC_PROGRESS_KEY)) || "";
  if (!raw) {
    const pendingRaw = (await getSyncMeta(SYNC_PENDING_KEY)) || "";
    try {
      const pending = pendingRaw ? (JSON.parse(pendingRaw) as string[]) : [];
      return { pending: Array.isArray(pending) ? pending : [], ok: [], failed: [] };
    } catch {
      return { pending: [], ok: [], failed: [] };
    }
  }
  try {
    const parsed = JSON.parse(raw) as CycleProgress;
    return {
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      ok: Array.isArray(parsed.ok) ? parsed.ok : [],
      failed: Array.isArray(parsed.failed) ? parsed.failed : [],
    };
  } catch {
    return { pending: [], ok: [], failed: [] };
  }
}

async function writeProgress(progress: CycleProgress): Promise<void> {
  await setSyncMeta(SYNC_PROGRESS_KEY, JSON.stringify(progress));
  await setSyncMeta(SYNC_PENDING_KEY, JSON.stringify(progress.pending));
}

async function clearCycle(): Promise<void> {
  await setSyncMeta(SYNC_LOCK_KEY, "");
  await setSyncMeta(SYNC_PENDING_KEY, "");
  await setSyncMeta(SYNC_PROGRESS_KEY, "");
}

async function markSyncStarted(): Promise<void> {
  await setSyncMeta(SYNC_LOCK_KEY, String(Date.now()));
}

export async function isRefreshRunning(): Promise<boolean> {
  if (refreshPromise !== null) return true;
  if ((await readSyncLockAge()) !== null) return true;
  const progress = await readProgress();
  return progress.pending.length > 0;
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

/**
 * Kick the next batch in a fresh Worker invocation (new subrequest budget).
 * Uses service binding when available; otherwise the next /api/numbers or cron continues.
 */
async function scheduleNextBatch(): Promise<void> {
  if (!isServerlessRuntime()) return;

  try {
    const { ctx, env } = await getCloudflareContext({ async: true });
    const cloudflareEnv = env as {
      WORKER_SELF_REFERENCE?: { fetch: typeof fetch };
    };

    const headers: Record<string, string> = {
      "x-sync-continue": "1",
    };
    const secret = process.env.CRON_SECRET?.trim();
    if (secret) headers.Authorization = `Bearer ${secret}`;

    const run = async () => {
      // Let KV writes settle before the next isolate reads them.
      await new Promise((r) => setTimeout(r, 400));
      const self = cloudflareEnv.WORKER_SELF_REFERENCE;
      if (!self?.fetch) return;
      await self.fetch(
        new Request("https://free-phone-pcode.internal/api/cron/refresh?continue=1", {
          method: "GET",
          headers,
        }),
      );
    };

    ctx.waitUntil(run().catch(() => undefined));
  } catch {
    // Next page poll / cron will pick up remaining pending providers.
  }
}

/**
 * Run one batch (or a full pass on Node). On Cloudflare, remaining work is
 * chained via scheduleNextBatch so each invocation stays under subrequest limits.
 */
export async function refreshProviders(
  providerId?: string,
  options: { continue?: boolean } = {},
): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise;

  const continuing = Boolean(options.continue);
  let progress = await readProgress();

  // Fresh cycle (not a continue): reject if another cycle is active.
  if (!continuing && !providerId) {
    if ((await readSyncLockAge()) !== null && progress.pending.length > 0) {
      return {
        ok: [],
        failed: [],
        alreadyRunning: true,
        done: false,
        pending: progress.pending.length,
      };
    }
  }

  // Single-provider sync (manual / targeted).
  if (providerId && !continuing) {
    if ((await readSyncLockAge()) !== null) {
      return { ok: [], failed: [], alreadyRunning: true, done: false };
    }
  }

  refreshPromise = (async () => {
    try {
      if (providerId && !continuing) {
        await markSyncStarted();
        const provider = await getProvider(providerId);
        if (!provider) {
          await clearCycle();
          return {
            ok: [],
            failed: [{ id: providerId, error: "Provider unavailable" }],
            done: true,
            pending: 0,
          };
        }
        const outcome = await syncOneProvider(provider);
        const ok = "ok" in outcome && outcome.ok ? [outcome.ok] : [];
        const failed =
          "failed" in outcome && outcome.failed ? [outcome.failed] : [];
        await setSyncMeta("last_refresh_at", String(Date.now()));
        await setSyncMeta(
          "last_refresh_result",
          JSON.stringify({ ok, failed, at: Date.now() }),
        );
        await clearCycle();
        return { ok, failed, done: true, pending: 0, batch: [providerId] };
      }

      // Start a new multi-provider cycle.
      if (!continuing || progress.pending.length === 0) {
        if (!continuing) {
          const all = await getProviders();
          progress = {
            pending: all.map((p) => p.id),
            ok: [],
            failed: [],
          };
          await markSyncStarted();
          await writeProgress(progress);
        } else if (progress.pending.length === 0) {
          // Spurious continue with nothing left.
          await clearCycle();
          return { ok: [], failed: [], done: true, pending: 0 };
        }
      } else {
        // Touch lock so TTL doesn't expire mid-chain.
        await markSyncStarted();
      }

      const batchIds = progress.pending.slice(0, REFRESH_BATCH_SIZE);
      const rest = progress.pending.slice(REFRESH_BATCH_SIZE);
      const targets = (
        await Promise.all(batchIds.map((id) => getProvider(id)))
      ).filter(Boolean) as SmsProvider[];

      const outcomes = await mapPool(
        targets,
        Math.min(REFRESH_CONCURRENCY, targets.length || 1),
        syncOneProvider,
      );

      for (const outcome of outcomes) {
        if ("ok" in outcome && outcome.ok) progress.ok.push(outcome.ok);
        if ("failed" in outcome && outcome.failed) {
          progress.failed.push(outcome.failed);
        }
      }

      // Providers that vanished from registry still leave the queue.
      const ran = new Set(targets.map((t) => t.id));
      for (const id of batchIds) {
        if (!ran.has(id) && !progress.failed.some((f) => f.id === id)) {
          progress.failed.push({ id, error: "Provider unavailable" });
        }
      }

      progress.pending = rest;
      await writeProgress(progress);

      if (progress.pending.length === 0) {
        await setSyncMeta("last_refresh_at", String(Date.now()));
        await setSyncMeta(
          "last_refresh_result",
          JSON.stringify({
            ok: progress.ok,
            failed: progress.failed,
            at: Date.now(),
          }),
        );
        await clearCycle();
        return {
          ok: progress.ok,
          failed: progress.failed,
          done: true,
          pending: 0,
          batch: batchIds,
        };
      }

      // More work remains — chain another invocation on Cloudflare.
      if (isServerlessRuntime()) {
        await scheduleNextBatch();
      } else {
        // Node: drain remaining batches in this process.
        while (progress.pending.length > 0) {
          const nextIds = progress.pending.slice(0, REFRESH_BATCH_SIZE);
          progress.pending = progress.pending.slice(REFRESH_BATCH_SIZE);
          const nextTargets = (
            await Promise.all(nextIds.map((id) => getProvider(id)))
          ).filter(Boolean) as SmsProvider[];
          const nextOutcomes = await mapPool(
            nextTargets,
            REFRESH_CONCURRENCY,
            syncOneProvider,
          );
          for (const outcome of nextOutcomes) {
            if ("ok" in outcome && outcome.ok) progress.ok.push(outcome.ok);
            if ("failed" in outcome && outcome.failed) {
              progress.failed.push(outcome.failed);
            }
          }
          await writeProgress(progress);
        }
        await setSyncMeta("last_refresh_at", String(Date.now()));
        await setSyncMeta(
          "last_refresh_result",
          JSON.stringify({
            ok: progress.ok,
            failed: progress.failed,
            at: Date.now(),
          }),
        );
        await clearCycle();
        return {
          ok: progress.ok,
          failed: progress.failed,
          done: true,
          pending: 0,
          batch: batchIds,
        };
      }

      return {
        ok: progress.ok,
        failed: progress.failed,
        done: false,
        pending: progress.pending.length,
        batch: batchIds,
      };
    } catch (err) {
      // Leave pending queue so a later continue/cron can resume.
      await markSyncStarted();
      throw err;
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

/** Start (or continue) sync without blocking the caller (Cloudflare-safe). */
export async function startRefreshInBackground(
  providerId?: string,
  options: { continue?: boolean } = {},
): Promise<{ started: boolean; syncing: boolean; pending?: number }> {
  if (!options.continue && (await isRefreshRunning()) && !providerId) {
    const progress = await readProgress();
    // If a cycle is stuck with pending but no in-flight work, allow continue kick.
    if (progress.pending.length > 0) {
      const work = refreshProviders(undefined, { continue: true });
      await keepAlive(work);
      return {
        started: true,
        syncing: true,
        pending: progress.pending.length,
      };
    }
    return {
      started: false,
      syncing: true,
      pending: progress.pending.length,
    };
  }

  const work = refreshProviders(providerId, options);
  await keepAlive(work);
  return { started: true, syncing: true };
}

/** 缓存过期时后台刷新；Node 空库可阻塞到首次同步，Cloudflare 绝不阻塞请求。 */
export async function ensureFreshData(maxAgeMs = 10 * 60 * 1000) {
  const progress = await readProgress();
  // Resume an incomplete batched cycle even if last_refresh_at is recent.
  if (progress.pending.length > 0) {
    if (isServerlessRuntime()) {
      await startRefreshInBackground(undefined, { continue: true });
    } else if (!(await isRefreshRunning())) {
      void refreshProviders(undefined, { continue: true }).catch(() => undefined);
    }
    return;
  }

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
