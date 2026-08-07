import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164, sleep } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

const BASE = "https://smscodeonline.com";

/** Rough dial-code → country label for common prefixes on this site. */
function guessCountry(digits: string): { country: string; countryCode: string } {
  const rules: Array<[string, string, string]> = [
    ["1", "United States / Canada", "1"],
    ["44", "United Kingdom", "44"],
    ["61", "Australia", "61"],
    ["62", "Indonesia", "62"],
    ["84", "Vietnam", "84"],
    ["91", "India", "91"],
    ["998", "Uzbekistan", "998"],
    ["7", "Russia", "7"],
    ["33", "France", "33"],
    ["49", "Germany", "49"],
  ];
  for (const [code, name, cc] of rules.sort((a, b) => b[0].length - a[0].length)) {
    if (digits.startsWith(code)) return { country: name, countryCode: cc };
  }
  return { country: "Unknown", countryCode: "" };
}

export const smscodeonlineProvider: SmsProvider = {
  id: "smscodeonline",
  name: "SMSCodeOnline",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const html = await fetchText(`${BASE}/`);
    const $ = cheerio.load(html);
    const results: NormalizedNumber[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    $('a[href*="/virtual-phone/p-"]').each((_, el) => {
      const href = ($(el).attr("href") || "").replace(/\s+/g, "").trim();
      const match = href.match(/\/virtual-phone\/p-(\d{8,15})/);
      if (!match) return;
      const digits = match[1];
      const e164 = normalizeE164(`+${digits}`);
      if (seen.has(e164)) return;
      seen.add(e164);
      const { country, countryCode } = guessCountry(digits);
      const path = `/virtual-phone/p-${digits}`;
      results.push({
        e164,
        country,
        countryCode,
        providerId: "smscodeonline",
        lastSeenAt: now,
        meta: { digits, href: `${BASE}${path}` },
      });
    });

    if (!results.length) {
      throw new Error("No numbers parsed from smscodeonline.com");
    }
    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const digits = (meta?.digits || number.replace(/\D/g, "")).replace(/\s+/g, "");
    const url = `${BASE}/virtual-phone/p-${digits}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    $(".card").each((_, el) => {
      const header = $(el).find(".card-header").text().replace(/\s+/g, " ").trim();
      const body = $(el).find(".card-body").clone();
      body.find("footer, .clear").remove();
      const text = body.text().replace(/\s+/g, " ").trim();
      if (!text || text.length < 4) return;
      if (/adsbygoogle|advertisement/i.test(text)) return;

      const fromMatch = header.match(/Sender:\s*(.+)$/i);
      const from = fromMatch?.[1]?.trim() || "Unknown";
      const timeText = $(el).find("footer.blockquote-footer").text().trim();

      messages.push({
        from,
        text,
        receivedAt: Date.now(),
        otp: extractOtp(text),
      });

      void timeText;
    });

    await sleep(50);
    return messages;
  },
};
