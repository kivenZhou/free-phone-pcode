import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164, sleep } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

/** Shared scraper for mianfeisms.xyz / goinsms.xyz style sites (sms.php?p=). */
export function createSmsPhpProvider(opts: {
  id: string;
  name: string;
  base: string;
}): SmsProvider {
  const { id, name, base } = opts;

  return {
    id,
    name,
    defaultLineType: "virtual",

    async listNumbers(): Promise<NormalizedNumber[]> {
      const html = await fetchText(`${base}/`);
      const $ = cheerio.load(html);
      const results: NormalizedNumber[] = [];
      const now = Date.now();
      const seen = new Set<string>();

      $('a[href*="sms.php?p="]').each((_, el) => {
        const href = ($(el).attr("href") || "").replace(/\s+/g, "");
        const match = href.match(/sms\.php\?p=(\d{7,15})/i);
        if (!match) return;
        const digits = match[1];
        // site mixes CN local 11-digit and intl without +
        let e164: string;
        let country: string;
        let countryCode: string;
        if (/^1[3-9]\d{9}$/.test(digits)) {
          e164 = normalizeE164(`+86${digits}`);
          country = "中国";
          countryCode = "86";
        } else if (digits.startsWith("1") && digits.length === 11) {
          e164 = normalizeE164(`+${digits}`);
          country = "United States";
          countryCode = "1";
        } else {
          e164 = normalizeE164(`+${digits}`);
          country = "Unknown";
          countryCode = "";
        }
        if (seen.has(e164)) return;
        seen.add(e164);
        results.push({
          e164,
          country,
          countryCode,
          providerId: id,
          lastSeenAt: now,
          lineType: "virtual",
          meta: {
            digits,
            href: `${base}/sms.php?p=${digits}`,
          },
        });
      });

      if (!results.length) throw new Error(`No numbers parsed from ${base}`);
      return results;
    },

    async listMessages(
      number: string,
      meta?: Record<string, string>,
    ): Promise<NormalizedMessage[]> {
      const digits =
        meta?.digits ||
        number.replace(/\D/g, "").replace(/^86(?=1\d{10}$)/, "");
      const url = meta?.href || `${base}/sms.php?p=${digits}`;
      const html = await fetchText(url);
      const $ = cheerio.load(html);
      const messages: NormalizedMessage[] = [];

      $(".rowbox.message_details, .message_details").each((_, el) => {
        const from = $(el).find(".sender").text().trim() || "Unknown";
        const text = $(el).find(".msg").text().replace(/\s+/g, " ").trim();
        const timeText = $(el).find(".time").text().trim();
        if (!text || text.length < 2) return;

        let receivedAt = Date.now();
        if (timeText) {
          const t = Date.parse(timeText.replace(" ", "T") + "+08:00");
          if (Number.isFinite(t)) receivedAt = t;
        }

        messages.push({
          from,
          text,
          receivedAt,
          otp: extractOtp(text),
        });
      });

      await sleep(30);
      return messages;
    },
  };
}

export const mianfeismsProvider = createSmsPhpProvider({
  id: "mianfeisms",
  name: "免费接码 SMS",
  base: "https://www.mianfeisms.xyz",
});

export const goinsmsProvider = createSmsPhpProvider({
  id: "goinsms",
  name: "GoInSMS",
  base: "https://www.goinsms.xyz",
});
