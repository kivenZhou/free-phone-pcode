const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export class FetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "FetchError";
  }
}

export async function fetchText(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...options.headers,
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
    }

    const text = await res.text();
    if (/just a moment|cf-browser-verification|attention required/i.test(text)) {
      throw new FetchError(`Blocked by anti-bot for ${url}`, 403);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const text = await fetchText(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  return JSON.parse(text) as T;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run async work over items with a fixed concurrency limit. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export function normalizeE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`;
  return `+${digits.replace(/\D/g, "")}`;
}

/**
 * Parse relative time strings from provider message pages into a timestamp.
 * Handles both Chinese ("2分钟前", "3小时前", "8月前") and English
 * ("2 minutes ago", "3 hours ago", "6 months ago", "2 days ago").
 * Returns `now` when no match is found.
 */
export function parseRelativeTime(text: string, now = Date.now()): number {
  if (!text) return now;
  const t = text.toLowerCase().trim();

  // Chinese patterns
  const zhPatterns: Array<[RegExp, number]> = [
    [/(\d+)\s*秒前/, 1_000],
    [/(\d+)\s*分钟前/, 60_000],
    [/(\d+)\s*小时前/, 3_600_000],
    [/(\d+)\s*天前/, 86_400_000],
    [/(\d+)\s*周前/, 7 * 86_400_000],
    [/(\d+)\s*个?月前/, 30 * 86_400_000],
    [/(\d+)\s*年前/, 365 * 86_400_000],
  ];
  for (const [re, ms] of zhPatterns) {
    const m = t.match(re);
    if (m) return now - parseInt(m[1], 10) * ms;
  }

  // English patterns
  const enPatterns: Array<[RegExp, number]> = [
    [/(\d+)\s*second/, 1_000],
    [/(\d+)\s*min/, 60_000],
    [/(\d+)\s*hour/, 3_600_000],
    [/(\d+)\s*day/, 86_400_000],
    [/(\d+)\s*week/, 7 * 86_400_000],
    [/(\d+)\s*month/, 30 * 86_400_000],
    [/(\d+)\s*year/, 365 * 86_400_000],
    [/just now|刚刚/, 0],
  ];
  for (const [re, ms] of enPatterns) {
    const m = t.match(re);
    if (m) {
      const n = m[1] ? parseInt(m[1], 10) : 0;
      return now - n * ms;
    }
  }

  return now;
}

export function encodeNumberId(providerId: string, e164: string): string {
  return Buffer.from(`${providerId}|${e164}`, "utf8").toString("base64url");
}

export function decodeNumberId(id: string): { providerId: string; e164: string } {
  const raw = Buffer.from(id, "base64url").toString("utf8");
  const idx = raw.indexOf("|");
  if (idx <= 0) throw new Error("Invalid number id");
  return { providerId: raw.slice(0, idx), e164: raw.slice(idx + 1) };
}
