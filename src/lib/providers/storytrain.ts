import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164 } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

const BASE = "https://www.storytrain.info";

function toE164(digits: string): { e164: string; country: string; countryCode: string } {
  if (digits.startsWith("852") && digits.length >= 11) {
    return { e164: normalizeE164(`+${digits}`), country: "香港", countryCode: "852" };
  }
  if (digits.startsWith("60") && digits.length >= 11) {
    return { e164: normalizeE164(`+${digits}`), country: "马来西亚", countryCode: "60" };
  }
  if (digits.length === 10 || digits.length === 11) {
    // most homepage numbers are CN-style / HK short listings; keep as +86 when 11-digit 1xxxx
    if (/^1\d{10}$/.test(digits)) {
      return { e164: normalizeE164(`+86${digits}`), country: "中国", countryCode: "86" };
    }
    if (/^1\d{9}$/.test(digits)) {
      return { e164: normalizeE164(`+1${digits}`), country: "United States", countryCode: "1" };
    }
  }
  return {
    e164: normalizeE164(`+${digits}`),
    country: "Unknown",
    countryCode: "",
  };
}

export const storytrainProvider: SmsProvider = {
  id: "storytrain",
  name: "云短信 StoryTrain",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const html = await fetchText(`${BASE}/`);
    const $ = cheerio.load(html);
    const results: NormalizedNumber[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    $('a[href*="/content/"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(/\/content\/(\d{8,15})/);
      if (!match) return;
      const digits = match[1];
      const info = toE164(digits);
      if (seen.has(info.e164)) return;
      seen.add(info.e164);
      results.push({
        e164: info.e164,
        country: info.country,
        countryCode: info.countryCode,
        providerId: "storytrain",
        lastSeenAt: now,
        meta: {
          digits,
          href: href.startsWith("http") ? href : `${BASE}${href}`,
        },
      });
    });

    if (!results.length) throw new Error("No numbers parsed from storytrain.info");
    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const digits = meta?.digits || number.replace(/\D/g, "").replace(/^86/, "");
    const url = meta?.href || `${BASE}/content/${digits}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    $("article.sms-introduction p, article p, .sms-introduction p").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (!text || text.length < 8) return;
      if (/新增一个|云短信：/.test(text) && !/\d{4,8}/.test(text)) return;
      messages.push({
        from: "Unknown",
        text,
        receivedAt: 0, // storytrain does not expose message timestamps
        otp: extractOtp(text),
      });
    });

    // fallback: any paragraph with OTP-like content
    if (!messages.length) {
      $("p").each((_, el) => {
        const text = $(el).text().replace(/\s+/g, " ").trim();
        if (text.length < 10) return;
        if (!extractOtp(text) && !/code|验证码|otp/i.test(text)) return;
        messages.push({
          from: "Unknown",
          text,
          receivedAt: 0,
          otp: extractOtp(text),
        });
      });
    }

    return messages;
  },
};
