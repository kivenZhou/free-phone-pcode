import * as cheerio from "cheerio";
import { extractOtp } from "../otp";
import { fetchText, normalizeE164, sleep } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

const BASE = "https://freephonenum.com";
const COUNTRIES: Array<{ path: string; name: string; code: string }> = [
  { path: "us", name: "United States", code: "1" },
  { path: "ca", name: "Canada", code: "1" },
];

export const freephonenumProvider: SmsProvider = {
  id: "freephonenum",
  name: "FreePhoneNum",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const results: NormalizedNumber[] = [];
    const now = Date.now();

    for (const country of COUNTRIES) {
      const html = await fetchText(`${BASE}/${country.path}`);
      const $ = cheerio.load(html);
      const seen = new Set<string>();

      $(`a[href*="/${country.path}/receive-sms/"]`).each((_, el) => {
        const href = $(el).attr("href") || "";
        const match = href.match(/\/receive-sms\/(\d{7,15})/);
        if (!match) return;
        const local = match[1];
        const e164 = normalizeE164(`+${country.code}${local}`);
        if (seen.has(e164)) return;
        seen.add(e164);
        results.push({
          e164,
          country: country.name,
          countryCode: country.code,
          providerId: "freephonenum",
          lastSeenAt: now,
          meta: {
            path: country.path,
            localNumber: local,
          },
        });
      });

      await sleep(250);
    }

    return results;
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const path = meta?.path || "us";
    const local =
      meta?.localNumber ||
      number.replace(/\D/g, "").replace(/^1/, "");
    const html = await fetchText(`${BASE}/${path}/receive-sms/${local}`);
    const $ = cheerio.load(html);
    const messages: NormalizedMessage[] = [];

    $(".msg").each((_, el) => {
      const from =
        $(el).find(".font-bold").first().text().trim() ||
        $(el).find("a.mono").first().text().trim() ||
        "Unknown";
      const text = $(el).find(".js-msgtext").text().trim();
      if (!text) return;
      messages.push({
        from,
        text,
        receivedAt: 0, // freephonenum does not expose message timestamps
        otp: extractOtp(text),
      });
    });

    return messages;
  },
};
