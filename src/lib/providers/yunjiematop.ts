import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164, sleep } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

/**
 * yunjiema.top — similar to yunduanxin listing, message pages use bg-messages rows.
 */
const BASE = "https://www.yunjiema.top";

function guessCountry(digits: string): { country: string; countryCode: string } {
  if (digits.startsWith("86")) return { country: "中国", countryCode: "86" };
  if (digits.startsWith("852")) return { country: "香港", countryCode: "852" };
  if (digits.startsWith("1") && digits.length >= 11) {
    return { country: "United States", countryCode: "1" };
  }
  if (digits.startsWith("44")) return { country: "United Kingdom", countryCode: "44" };
  return { country: "Unknown", countryCode: "" };
}

export const yunjiematopProvider: SmsProvider = {
  id: "yunjiematop",
  name: "云接码 Top",
  defaultLineType: "virtual",

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
          const href = ($(el).attr("href") || "").trim();
          const match = href.match(/\/message\/(\d+)\.html/);
          if (!match) return;
          const digits = match[1];
          if (digits.length < 8) return;
          const e164 = normalizeE164(`+${digits}`);
          if (seen.has(e164)) return;
          seen.add(e164);
          const g = guessCountry(digits);
          results.push({
            e164,
            country: g.country,
            countryCode: g.countryCode,
            providerId: "yunjiematop",
            lastSeenAt: now,
            lineType: "virtual",
            meta: {
              digits,
              href: href.startsWith("http") ? href : `${BASE}${href}`,
            },
          });
        });
      } catch {
        // skip
      }
      await sleep(180);
    }

    if (!results.length) throw new Error("No numbers from yunjiema.top");
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

    $(".bg-messages, .row.border-bottom.table-hover").each((_, el) => {
      const from =
        $(el).find(".mobile_hide").first().text().trim() ||
        $(el)
          .find(".message_head")
          .text()
          .replace(/^From\s+/i, "")
          .replace(/\s*\(.*\)$/, "")
          .trim() ||
        "Unknown";
      const cols = $(el).find('[class*="col-"]');
      let text = "";
      if (cols.length >= 3) {
        text = $(cols[cols.length - 1]).text().replace(/\s+/g, " ").trim();
      } else {
        text = $(el).text().replace(/\s+/g, " ").trim();
      }
      if (!text || text.length < 5) return;
      if (/ADS|adsbygoogle|Google Ads/i.test(from + text)) return;
      if (/register|login to the website before view SMS/i.test(text)) return;

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
