import { Impit, type HttpMethod } from "impit";
import { FetchError } from "./http";

/**
 * Chrome-impersonated HTTP client (TLS fingerprint) for Cloudflare-protected sites.
 * Shares cookies / connection pool across requests on this process.
 */
let client: Impit | null = null;

function getClient(): Impit {
  if (!client) {
    client = new Impit({
      browser: "chrome",
      timeout: 25_000,
      followRedirects: true,
    });
  }
  return client;
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
  const res = await getClient().fetch(url, {
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
