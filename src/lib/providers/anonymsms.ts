import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164, sleep } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

const BASE = "https://anonymsms.com";

const COUNTRY_PAGES = [
  { path: "united-states", name: "United States", code: "1" },
  { path: "united-kingdom", name: "United Kingdom", code: "44" },
  { path: "canada", name: "Canada", code: "1" },
  { path: "australia", name: "Australia", code: "61" },
  { path: "germany", name: "Germany", code: "49" },
  { path: "france", name: "France", code: "33" },
  { path: "netherlands", name: "Netherlands", code: "31" },
  { path: "sweden", name: "Sweden", code: "46" },
];

export const anonymsmsProvider: SmsProvider = {
  id: "anonymsms",
  name: "AnonymSMS",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const results: NormalizedNumber[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    // homepage numbers
    const home = await fetchText(`${BASE}/`);
    const $home = cheerio.load(home);
    $home('a[href*="/number/"]').each((_, el) => {
      const href = $home(el).attr("href") || "";
      const match = href.match(/\/number\/(\d{8,15})\/?/);
      if (!match) return;
      const digits = match[1];
      const e164 = normalizeE164(`+${digits}`);
      if (seen.has(e164)) return;
      seen.add(e164);
      results.push({
        e164,
        country: "Unknown",
        countryCode: "",
        providerId: "anonymsms",
        lastSeenAt: now,
        meta: {
          digits,
          href: href.startsWith("http") ? href : `${BASE}${href}`,
        },
      });
    });

    for (const country of COUNTRY_PAGES) {
      try {
        const html = await fetchText(`${BASE}/${country.path}/`);
        const $ = cheerio.load(html);
        $('a[href*="/number/"]').each((_, el) => {
          const href = $(el).attr("href") || "";
          const match = href.match(/\/number\/(\d{8,15})\/?/);
          if (!match) return;
          const digits = match[1];
          const e164 = normalizeE164(`+${digits}`);
          const existing = results.find((r) => r.e164 === e164);
          if (existing) {
            existing.country = country.name;
            existing.countryCode = country.code;
            return;
          }
          if (seen.has(e164)) return;
          seen.add(e164);
          results.push({
            e164,
            country: country.name,
            countryCode: country.code,
            providerId: "anonymsms",
            lastSeenAt: now,
            meta: {
              digits,
              href: href.startsWith("http") ? href : `${BASE}${href}`,
            },
          });
        });
      } catch {
        // country page may 404
      }
      await sleep(150);
    }

    if (!results.length) throw new Error("No numbers parsed from anonymsms.com");
    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const digits = meta?.digits || number.replace(/\D/g, "");
    const url = meta?.href || `${BASE}/number/${digits}/`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    if ($(".sms-group__empty-state").length) {
      return [];
    }

    $(".sms-group__message, .sms-message, article, .message").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length < 8) return;
      if (/No messages found/i.test(text)) return;
      messages.push({
        from: $(el).find(".sms-group__from, .from, strong").first().text().trim() || "Unknown",
        text,
        receivedAt: Date.now(),
        otp: extractOtp(text),
      });
    });

    // fallback: paragraphs with codes
    if (!messages.length) {
      $("p, li, td").each((_, el) => {
        const text = $(el).text().replace(/\s+/g, " ").trim();
        if (text.length < 12) return;
        if (!extractOtp(text) && !/code|otp|verify/i.test(text)) return;
        messages.push({
          from: "Unknown",
          text,
          receivedAt: Date.now(),
          otp: extractOtp(text),
        });
      });
    }

    return messages.slice(0, 50);
  },
};
