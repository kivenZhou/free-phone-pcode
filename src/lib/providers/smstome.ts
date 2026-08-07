import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164 } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

/**
 * smstome.com — often behind Cloudflare; provider degrades when blocked.
 */
export const smstomeProvider: SmsProvider = {
  id: "smstome",
  name: "SMSToMe",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const html = await fetchText("https://smstome.com/");
    const $ = cheerio.load(html);
    const results: NormalizedNumber[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    $("a[href*='/phone/'], a[href*='/country/']").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      const text = $(el).text().trim();
      const match = (text + " " + href).match(/\+?\d[\d\s\-()]{8,20}/);
      if (!match) return;
      const e164 = normalizeE164(match[0]);
      if (e164.replace(/\D/g, "").length < 8) return;
      if (seen.has(e164)) return;
      seen.add(e164);
      results.push({
        e164,
        country: "Unknown",
        countryCode: "",
        providerId: "smstome",
        lastSeenAt: now,
        meta: {
          href: href.startsWith("http") ? href : `https://smstome.com${href}`,
        },
      });
    });

    // also crawl a few country pages linked from home
    const countryLinks = new Set<string>();
    $("a[href*='/country/']").each((_, el) => {
      const href = $(el).attr("href");
      if (href) countryLinks.add(href.startsWith("http") ? href : `https://smstome.com${href}`);
    });

    for (const link of Array.from(countryLinks).slice(0, 5)) {
      try {
        const page = await fetchText(link);
        const $$ = cheerio.load(page);
        $$("a[href*='/phone/']").each((_, el) => {
          const href = ($$(el).attr("href") || "").trim();
          const text = $$(el).text().trim();
          const match = (text + " " + href).match(/\+?\d[\d\s\-()]{8,20}/);
          if (!match) return;
          const e164 = normalizeE164(match[0]);
          if (seen.has(e164)) return;
          seen.add(e164);
          results.push({
            e164,
            country: "Unknown",
            countryCode: "",
            providerId: "smstome",
            lastSeenAt: now,
            meta: {
              href: href.startsWith("http") ? href : `https://smstome.com${href}`,
            },
          });
        });
      } catch {
        // ignore country page failures
      }
    }

    if (!results.length) {
      throw new Error("No numbers parsed from smstome.com (blocked or structure changed)");
    }
    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const digits = number.replace(/\D/g, "");
    const url = meta?.href || `https://smstome.com/phone/${digits}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    $("table tr, .message, .card, li").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length < 10) return;
      messages.push({
        from: "Unknown",
        text,
        receivedAt: Date.now(),
        otp: extractOtp(text),
      });
    });

    return messages.slice(0, 40);
  },
};
