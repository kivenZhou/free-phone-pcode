import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164 } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

/**
 * receive-smss.com — often behind Cloudflare; provider degrades when blocked.
 */
export const receiveSmssProvider: SmsProvider = {
  id: "receive-smss",
  name: "Receive-SMSS",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const html = await fetchText("https://receive-smss.com/");
    const $ = cheerio.load(html);
    const results: NormalizedNumber[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    $("a[href*='/sms/'], a[href*='/number/']").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      const text = $(el).text().trim();
      const candidate = text.match(/\+?\d[\d\s\-()]{8,20}/)?.[0] || href;
      const digits = candidate.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return;
      const e164 = normalizeE164(candidate.startsWith("+") ? candidate : `+${digits}`);
      if (seen.has(e164)) return;
      seen.add(e164);
      results.push({
        e164,
        country: "Unknown",
        countryCode: "",
        providerId: "receive-smss",
        lastSeenAt: now,
        meta: { href: href.startsWith("http") ? href : `https://receive-smss.com${href}` },
      });
    });

    if (!results.length) {
      throw new Error("No numbers parsed from receive-smss.com (page structure may have changed)");
    }
    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const digits = number.replace(/\D/g, "");
    const url = meta?.href || `https://receive-smss.com/sms/${digits}/`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    $("div.list-item, .message, tr").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length < 8) return;
      if (!/\d{4,8}/.test(text) && !/code|otp|verify/i.test(text)) return;
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
