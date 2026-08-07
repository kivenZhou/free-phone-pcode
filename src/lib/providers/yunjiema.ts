import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164, sleep } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

const BASE = "https://yunjiema.net";

const COUNTRIES: Array<{ path: string; name: string; code: string }> = [
  { path: "meiguohaoma", name: "United States", code: "1" },
  { path: "helanhaoma", name: "Netherlands", code: "31" },
  { path: "yingguohaoma", name: "United Kingdom", code: "44" },
  { path: "eluosihaoma", name: "Russia", code: "7" },
  { path: "danmaihaoma", name: "Denmark", code: "45" },
];

export const yunjiemaProvider: SmsProvider = {
  id: "yunjiema",
  name: "云接码",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const results: NormalizedNumber[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    for (const country of COUNTRIES) {
      try {
        const html = await fetchText(`${BASE}/${country.path}/`);
        const $ = cheerio.load(html);
        $(`a[href*="/${country.path}/"]`).each((_, el) => {
          const href = $(el).attr("href") || "";
          const match = href.match(new RegExp(`/${country.path}/(\\d{7,15})/?`));
          if (!match) return;
          const digits = match[1];
          const e164 = normalizeE164(
            digits.startsWith(country.code) ? `+${digits}` : `+${country.code}${digits}`,
          );
          // Prefer full international digit strings already including country code
          const full = normalizeE164(`+${digits}`);
          const finalE164 = digits.length >= 10 ? full : e164;
          if (seen.has(finalE164)) return;
          seen.add(finalE164);
          results.push({
            e164: finalE164,
            country: country.name,
            countryCode: country.code,
            providerId: "yunjiema",
            lastSeenAt: now,
            meta: {
              path: country.path,
              digits,
              href: href.startsWith("http") ? href : `${BASE}${href}`,
            },
          });
        });
      } catch {
        // country page may be missing
      }
      await sleep(200);
    }

    if (!results.length) throw new Error("No numbers parsed from yunjiema.net");
    return results;
  },

  async listMessages(
    _number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const path = meta?.path;
    const digits = meta?.digits;
    const url =
      meta?.href ||
      (path && digits ? `${BASE}/${path}/${digits}/` : null);
    if (!url) throw new Error("Missing yunjiema message URL meta");

    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    $(".bg-messages, .row.border-bottom.table-hover").each((_, el) => {
      const from =
        $(el).find(".mobile_hide").first().text().trim() ||
        $(el).find(".message_head").text().replace(/^From\s+/i, "").replace(/\s*\(.*\)$/, "").trim() ||
        "Unknown";
      const cols = $(el).find('[class*="col-"]');
      let text = "";
      if (cols.length >= 3) {
        text = $(cols[cols.length - 1]).text().replace(/\s+/g, " ").trim();
      } else {
        text = $(el).text().replace(/\s+/g, " ").trim();
      }
      if (!text || text.length < 5) return;
      if (/^ADS$/i.test(from) || /adsbygoogle|Google Ads/i.test(text)) return;
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
