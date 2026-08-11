import * as cheerio from "cheerio";
import { browserFetchJson, browserFetchText } from "../browser-fetch";
import { fetchText, mapPool, normalizeE164, sleep } from "../http";
import { extractOtp } from "../otp";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

const BASE = "https://sms24.me";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const MAX_PAGES_PER_COUNTRY = envInt("SMS24_MAX_PAGES", 20);
/** Flat page-fetch concurrency across all countries */
const PAGE_CONCURRENCY = envInt("SMS24_CONCURRENCY", 10);

type Sms24ApiMessage = {
  from?: string;
  content?: string;
  created?: string;
  kind?: string;
};

type Sms24MessagesResponse = {
  messages?: Sms24ApiMessage[];
  page?: number;
  pages?: number;
};

type CountrySeed = {
  iso: string;
  countryName: string;
  maxPage: number;
  firstHtml: string;
};

function absUrl(href: string): string {
  if (href.startsWith("http")) return href;
  return `${BASE}${href.startsWith("/") ? "" : "/"}${href}`;
}

function countryNameFromPage(html: string, iso: string): string {
  const $ = cheerio.load(html);
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  const fromH1 = h1.match(/^(.+?)\s+Temporary/i)?.[1]?.trim();
  if (fromH1) return fromH1;
  return iso.toUpperCase();
}

function parseNumbersFromCountryHtml(
  html: string,
  iso: string,
  countryName: string,
  now: number,
  seen: Set<string>,
): NormalizedNumber[] {
  const $ = cheerio.load(html);
  const results: NormalizedNumber[] = [];

  $('a[href*="/numbers/"]').each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const match = href.match(/\/numbers\/(\d{8,20})(?:\/|$|\?)/);
    if (!match) return;
    const digits = match[1];
    const e164 = normalizeE164(digits);
    if (seen.has(e164)) return;
    seen.add(e164);
    results.push({
      e164,
      country: countryName,
      countryCode: "",
      countryIso: iso.toUpperCase(),
      providerId: "sms24",
      lastSeenAt: now,
      meta: {
        href: absUrl(href),
        countryIso: iso.toUpperCase(),
        digits,
      },
    });
  });

  return results;
}

function maxCountryPage(html: string, iso: string): number {
  const pages = new Set<number>([1]);
  const re = new RegExp(`/en/countries/${iso}/(\\d+)`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) pages.add(n);
  }
  return Math.min(Math.max(...pages), MAX_PAGES_PER_COUNTRY);
}

async function listCountryIsos(): Promise<string[]> {
  const html = await browserFetchText(`${BASE}/en/countries`);
  const $ = cheerio.load(html);
  const isos = new Set<string>();
  $('a[href*="/countries/"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/\/countries\/([a-z]{2})(?:\/|$|\?)/i);
    if (m) isos.add(m[1].toLowerCase());
  });
  if (!isos.size) {
    throw new Error("No countries parsed from sms24.me/en/countries");
  }
  return [...isos].sort();
}

/** Sitemap is not behind Cloudflare — useful fallback / fill-in. */
async function listNumbersFromSitemap(now: number): Promise<NormalizedNumber[]> {
  const xml = await fetchText(`${BASE}/sitemap-numbers.xml`);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const localSeen = new Set<string>();
  const results: NormalizedNumber[] = [];
  for (const loc of locs) {
    const m = loc.match(/\/numbers\/(\d{8,20})(?:\/|$)/);
    if (!m) continue;
    const e164 = normalizeE164(m[1]);
    if (localSeen.has(e164)) continue;
    localSeen.add(e164);
    results.push({
      e164,
      country: "Unknown",
      countryCode: "",
      providerId: "sms24",
      lastSeenAt: now,
      meta: { href: loc, digits: m[1] },
    });
  }
  return results;
}

async function fetchTextRetry(url: string, attempts = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await browserFetchText(url);
    } catch (err) {
      lastErr = err;
      await sleep(300 * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * sms24.me — country → paginated numbers; messages via JSON API.
 * HTML is Cloudflare-protected; uses Chrome TLS impersonation (impit).
 */
export const sms24Provider: SmsProvider = {
  id: "sms24",
  name: "SMS24",
  supportsMessages: false,

  async listNumbers(): Promise<NormalizedNumber[]> {
    const now = Date.now();
    const seen = new Set<string>();
    const results: NormalizedNumber[] = [];

    try {
      const isos = await listCountryIsos();

      // Phase 1: country landing pages (discover pagination + page-1 numbers)
      const seeds = await mapPool(isos, PAGE_CONCURRENCY, async (iso) => {
        try {
          const firstHtml = await fetchTextRetry(`${BASE}/en/countries/${iso}`);
          const seed: CountrySeed = {
            iso,
            countryName: countryNameFromPage(firstHtml, iso),
            maxPage: maxCountryPage(firstHtml, iso),
            firstHtml,
          };
          return seed;
        } catch {
          return null;
        }
      });

      const okSeeds = seeds.filter((s): s is CountrySeed => Boolean(s));
      for (const seed of okSeeds) {
        results.push(
          ...parseNumbersFromCountryHtml(
            seed.firstHtml,
            seed.iso,
            seed.countryName,
            now,
            seen,
          ),
        );
      }

      // Phase 2: remaining pages as one flat pool
      const pageJobs: Array<{ iso: string; countryName: string; page: number }> =
        [];
      for (const seed of okSeeds) {
        for (let page = 2; page <= seed.maxPage; page++) {
          pageJobs.push({
            iso: seed.iso,
            countryName: seed.countryName,
            page,
          });
        }
      }

      const pageBatches = await mapPool(pageJobs, PAGE_CONCURRENCY, async (job) => {
        try {
          const html = await fetchTextRetry(
            `${BASE}/en/countries/${job.iso}/${job.page}`,
          );
          return parseNumbersFromCountryHtml(
            html,
            job.iso,
            job.countryName,
            now,
            seen,
          );
        } catch {
          return [] as NormalizedNumber[];
        }
      });

      for (const batch of pageBatches) results.push(...batch);
    } catch (err) {
      if (!results.length) {
        const fallback = await listNumbersFromSitemap(now);
        if (!fallback.length) throw err;
        return fallback;
      }
    }

    if (!results.length) {
      const fallback = await listNumbersFromSitemap(now);
      if (fallback.length) return fallback;
      throw new Error(
        "No numbers parsed from sms24.me (blocked or structure changed)",
      );
    }

    try {
      const extra = await listNumbersFromSitemap(now);
      for (const n of extra) {
        if (seen.has(n.e164)) continue;
        seen.add(n.e164);
        results.push(n);
      }
    } catch {
      // ignore sitemap merge failures
    }

    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const digits =
      meta?.digits ||
      number.replace(/\D/g, "") ||
      (meta?.href || "").match(/\/numbers\/(\d+)/)?.[1] ||
      "";
    if (!digits) return [];

    const data = await browserFetchJson<Sms24MessagesResponse>(
      `${BASE}/api/messages/${digits}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: meta?.href || `${BASE}/en/numbers/${digits}`,
          Origin: BASE,
        },
        body: JSON.stringify({ page: 1, locale: "en" }),
      },
    );

    return (data.messages || [])
      .filter((m) => m.kind !== "call" && (m.content || "").trim())
      .slice(0, 40)
      .map((m) => {
        const text = (m.content || "").trim();
        const receivedAt = m.created ? Date.parse(m.created) : Date.now();
        return {
          from: (m.from || "Unknown").trim() || "Unknown",
          text,
          receivedAt: Number.isFinite(receivedAt) ? receivedAt : Date.now(),
          otp: extractOtp(text),
        };
      });
  },
};
