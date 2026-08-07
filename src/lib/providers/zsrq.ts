import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164, sleep } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

const BASE = "https://www.zsrq.net";

export const zsrqProvider: SmsProvider = {
  id: "zsrq",
  name: "云短信 ZSRQ",
  defaultLineType: "virtual",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const results: NormalizedNumber[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    const pages = ["/", "/?page=2", "/?page=3"];
    for (const page of pages) {
      try {
        const html = await fetchText(`${BASE}${page}`);
        const $ = cheerio.load(html);
        $('a[href*="/phone/"]').each((_, el) => {
          const href = ($(el).attr("href") || "").trim();
          const match = href.match(/\/phone\/(\d{8,15})/);
          if (!match) return;
          const digits = match[1];
          const e164 = normalizeE164(`+${digits}`);
          if (seen.has(e164)) return;
          seen.add(e164);
          results.push({
            e164,
            country: digits.startsWith("86")
              ? "中国"
              : digits.startsWith("1")
                ? "United States"
                : "Unknown",
            countryCode: digits.startsWith("86") ? "86" : digits.startsWith("1") ? "1" : "",
            providerId: "zsrq",
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
      await sleep(200);
    }

    if (!results.length) throw new Error("No numbers parsed from zsrq.net");
    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const digits = meta?.digits || number.replace(/\D/g, "");
    const url = meta?.href || `${BASE}/phone/${digits}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    $(".sms-item, .sms-list li, .sms-content").each((_, el) => {
      const root = $(el);
      // if this is sms-content alone, skip parent duplication handled via sms-item
      if (root.hasClass("sms-content") && root.closest(".sms-item").length) return;

      const text =
        root.find(".sms-content").text().replace(/\s+/g, " ").trim() ||
        root.text().replace(/\s+/g, " ").trim();
      if (!text || text.length < 4) return;
      if (/免费在线接收|版权|copyright/i.test(text) && text.length < 40) return;

      const from =
        root.find(".sms-sender").text().trim() ||
        "Unknown";

      messages.push({
        from,
        text,
        receivedAt: Date.now(),
        otp: extractOtp(text),
      });
    });

    // de-dupe identical consecutive texts
    const uniq: NormalizedMessage[] = [];
    for (const m of messages) {
      if (uniq.some((u) => u.text === m.text && u.from === m.from)) continue;
      uniq.push(m);
    }
    return uniq.slice(0, 60);
  },
};
