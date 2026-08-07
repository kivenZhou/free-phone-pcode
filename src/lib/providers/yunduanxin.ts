import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164, sleep } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

const BASE = "https://www.yunduanxin.xyz";

function guessCountry(digits: string): { country: string; countryCode: string } {
  if (digits.startsWith("86")) return { country: "中国", countryCode: "86" };
  if (digits.startsWith("1") && digits.length === 11) {
    return { country: "United States", countryCode: "1" };
  }
  if (digits.startsWith("44")) return { country: "United Kingdom", countryCode: "44" };
  if (digits.startsWith("852")) return { country: "香港", countryCode: "852" };
  if (digits.startsWith("61")) return { country: "Australia", countryCode: "61" };
  if (digits.startsWith("7")) return { country: "Russia", countryCode: "7" };
  return { country: "Unknown", countryCode: "" };
}

export const yunduanxinProvider: SmsProvider = {
  id: "yunduanxin",
  name: "云短信",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const pages = ["/", "/phone/2.html", "/phone/3.html", "/phone/4.html", "/phone/5.html"];
    const results: NormalizedNumber[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    for (const page of pages) {
      try {
        const html = await fetchText(`${BASE}${page}`);
        const $ = cheerio.load(html);
        $('a[href*="/message/"]').each((_, el) => {
          const href = $(el).attr("href") || "";
          const match = href.match(/\/message\/(\d+)\.html/);
          if (!match) return;
          const digits = match[1];
          if (digits.length < 8) return;
          const e164 = normalizeE164(`+${digits}`);
          if (seen.has(e164)) return;
          seen.add(e164);
          const { country, countryCode } = guessCountry(digits);
          results.push({
            e164,
            country,
            countryCode,
            providerId: "yunduanxin",
            lastSeenAt: now,
            meta: {
              digits,
              href: href.startsWith("http") ? href : `${BASE}${href}`,
            },
          });
        });
      } catch {
        // skip page errors
      }
      await sleep(200);
    }

    if (!results.length) throw new Error("No numbers parsed from yunduanxin.xyz");
    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const digits = meta?.digits || number.replace(/\D/g, "");
    const url = meta?.href || `${BASE}/message/${digits}.html`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    $(".panel").each((_, el) => {
      const heading = $(el).find(".panel-heading");
      const from = heading.find("span").last().text().trim() || "Unknown";
      const text = $(el).find(".panel-body").text().replace(/\s+/g, " ").trim();
      if (!text || text.length < 4) return;
      if (/sms-activation|alert-warning/i.test($(el).attr("class") || "")) return;

      messages.push({
        from,
        text,
        receivedAt: Date.now(),
        otp: extractOtp(text),
      });
    });

    return messages;
  },
};
