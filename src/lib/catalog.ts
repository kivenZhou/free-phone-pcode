import type { LineType } from "./phone";

export interface CatalogNumber {
  id: string;
  e164: string;
  country: string;
  countryCode?: string;
  countryNameZh?: string;
  dialCode?: string;
  nationalNumber?: string;
  flag?: string;
  countryIso?: string;
  providerId: string;
  lastSeenAt: number;
  lineType?: LineType;
}

export interface CountrySummary {
  name: string;
  iso: string;
  flag: string;
  dialCode: string;
  count: number;
}

export function filterNumbers(
  rows: CatalogNumber[],
  filters: {
    country?: string;
    provider?: string;
    q?: string;
    lineType?: string;
  },
): CatalogNumber[] {
  let list = rows;

  if (filters.country) {
    list = list.filter(
      (n) =>
        n.country === filters.country ||
        n.countryNameZh === filters.country ||
        n.countryCode === filters.country ||
        n.dialCode === filters.country ||
        n.countryIso === filters.country,
    );
  }
  if (filters.provider) {
    list = list.filter((n) => n.providerId === filters.provider);
  }
  if (filters.lineType) {
    list = list.filter((n) => n.lineType === filters.lineType);
  }
  if (filters.q) {
    const q = filters.q.replace(/[^\d+]/g, "");
    list = list.filter(
      (n) =>
        n.e164.includes(q) ||
        (n.nationalNumber?.includes(q.replace(/^\+/, "")) ?? false) ||
        (n.dialCode?.includes(q.replace(/^\+/, "")) ?? false),
    );
  }

  return list.sort(
    (a, b) => b.lastSeenAt - a.lastSeenAt || a.e164.localeCompare(b.e164),
  );
}

export function distinctCountries(
  rows: CatalogNumber[],
  filters?: {
    provider?: string;
    lineType?: string;
    q?: string;
  },
): CountrySummary[] {
  const filtered = filterNumbers(rows, {
    provider: filters?.provider,
    lineType: filters?.lineType,
    q: filters?.q,
  });

  const map = new Map<string, CountrySummary>();
  for (const n of filtered) {
    const key = n.countryIso || n.countryNameZh || n.country;
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else {
      map.set(key, {
        name: n.countryNameZh || n.country,
        iso: n.countryIso || "XX",
        flag: n.flag || "🌐",
        dialCode: n.dialCode || n.countryCode || "",
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}
