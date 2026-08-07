import { FetchError } from "./http";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

type BrowserFetchClient = {
  fetch: (
    url: string,
    init?: {
      method?: HttpMethod;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    },
  ) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
};

/**
 * Chrome-impersonated HTTP client (TLS fingerprint) for Cloudflare-protected sites.
 * Loaded on demand so OpenNext / Workers builds do not trace native `.node` binaries.
 */
let clientPromise: Promise<BrowserFetchClient> | null = null;

async function getClient(): Promise<BrowserFetchClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { Impit } = await import("impit");
      return new Impit({
        browser: "chrome",
        timeout: 25_000,
        followRedirects: true,
      });
    })();
  }
  return clientPromise;
}

export async function browserFetchText(
  url: string,
  options: {
    method?: HttpMethod;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<string> {
  const res = await (await getClient()).fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...options.headers,
    },
    body: options.body,
    timeout: options.timeoutMs ?? 25_000,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
  }
  if (/just a moment|cf-browser-verification|attention required|you have been blocked/i.test(text)) {
    throw new FetchError(`Blocked by anti-bot for ${url}`, 403);
  }
  return text;
}

export async function browserFetchJson<T>(
  url: string,
  options: {
    method?: HttpMethod;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const text = await browserFetchText(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  return JSON.parse(text) as T;
}

export { mapPool } from "./http";
