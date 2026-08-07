import { extractOtp } from "../otp";
import { fetchJson, mapPool, normalizeE164 } from "../http";
import type { NormalizedMessage, NormalizedNumber, SmsProvider } from "./types";

interface FreeListResponse {
  response: number;
  countries?: Array<{ country: number; country_text: string }>;
  numbers?: Record<
    string,
    {
      country: number;
      country_original?: string;
      full_number?: string;
      data_humans?: string;
      is_archive?: boolean;
    }
  >;
  messages?: {
    data?: Array<{
      text: string;
      in_number: string;
      created_at: string;
      code?: string;
    }>;
  };
}

function parseOnlineSimDate(value: string): number {
  const t = Date.parse(value.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? t : Date.now();
}

export const onlinesimProvider: SmsProvider = {
  id: "onlinesim",
  name: "OnlineSIM",

  async listNumbers(): Promise<NormalizedNumber[]> {
    const base = await fetchJson<FreeListResponse>(
      "https://onlinesim.io/api/getFreeList?lang=en",
    );
    const countries = base.countries ?? [];
    const now = Date.now();

    const batches = await mapPool(countries, 6, async (c) => {
      try {
        const data = await fetchJson<FreeListResponse>(
          `https://onlinesim.io/api/getFreeList?lang=en&country=${c.country}`,
        );
        const numbers = data.numbers ?? {};
        const chunk: NormalizedNumber[] = [];
        for (const [local, info] of Object.entries(numbers)) {
          if (info.is_archive) continue;
          chunk.push({
            e164: normalizeE164(info.full_number || `+${c.country}${local}`),
            country: c.country_text || String(c.country),
            countryCode: String(c.country),
            providerId: "onlinesim",
            lastSeenAt: now,
            meta: {
              localNumber: local.replace(/\D/g, ""),
              dialCode: String(c.country),
            },
          });
        }
        return chunk;
      } catch {
        return [] as NormalizedNumber[];
      }
    });

    return batches.flat();
  },

  async listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]> {
    const dialCode = meta?.dialCode;
    const local = meta?.localNumber;
    let country = dialCode;
    let localNumber = local;

    if (!country || !localNumber) {
      const base = await fetchJson<FreeListResponse>(
        "https://onlinesim.io/api/getFreeList?lang=en",
      );
      const codes = (base.countries ?? [])
        .map((c) => String(c.country))
        .sort((a, b) => b.length - a.length);
      const digits = number.replace(/\D/g, "");
      for (const code of codes) {
        if (digits.startsWith(code)) {
          country = code;
          localNumber = digits.slice(code.length);
          break;
        }
      }
    }

    if (!country || !localNumber) {
      throw new Error(`Unable to resolve OnlineSIM country/local for ${number}`);
    }

    const data = await fetchJson<FreeListResponse>(
      `https://onlinesim.io/api/getFreeList?lang=en&country=${country}&number=${localNumber}`,
    );

    const rows = data.messages?.data ?? [];
    return rows.map((m) => {
      const otp = m.code && /^\d{4,8}$/.test(m.code) ? m.code : extractOtp(m.text);
      return {
        from: m.in_number || "Unknown",
        text: m.text,
        receivedAt: parseOnlineSimDate(m.created_at),
        otp,
      };
    });
  },
};
