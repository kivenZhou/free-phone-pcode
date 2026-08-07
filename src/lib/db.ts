import { parsePhone, type LineType } from "./phone";
import type { NormalizedMessage, NormalizedNumber, ProviderHealth } from "./providers/types";
import { getStoreBackend, readLocalStoreSync } from "./store-backend";
import { type StoreShape, type StoredNumber } from "./store-types";

export type { StoredNumber, StoreShape } from "./store-types";

function enrichStored(
  n: StoredNumber | (NormalizedNumber & { id: string; updatedAt: number }),
): StoredNumber {
  const parsed = parsePhone({
    e164: n.e164,
    country: n.country,
    countryCode: n.countryCode || (n as StoredNumber).dialCode,
    providerId: n.providerId,
    lineType: n.lineType,
    meta: n.meta,
  });
  return {
    ...n,
    country: parsed.countryNameZh || n.country,
    countryCode: parsed.dialCode || n.countryCode,
    dialCode: parsed.dialCode,
    nationalNumber: parsed.nationalNumber,
    countryIso: parsed.countryIso,
    countryNameZh: parsed.countryNameZh,
    flag: parsed.flag,
    lineType: parsed.lineType,
  };
}

async function readStore(): Promise<StoreShape> {
  const backend = await getStoreBackend();
  const store = await backend.read();
  return {
    ...store,
    numbers: store.numbers.map(enrichStored),
  };
}

async function writeStore(store: StoreShape): Promise<void> {
  const backend = await getStoreBackend();
  await backend.write(store);
}

let dbWriteChain: Promise<void> = Promise.resolve();

function runDbWrite<T>(fn: () => Promise<T>): Promise<T> {
  const job = dbWriteChain.then(fn);
  dbWriteChain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export async function hasStoredNumbers(): Promise<boolean> {
  const store = await readStore();
  return store.numbers.length > 0;
}

/** 构建脚本读取本地 data/store.json */
export function readStoreForExport(): StoreShape {
  const store = readLocalStoreSync();
  return {
    ...store,
    numbers: store.numbers.map(enrichStored),
  };
}

export function applyProviderSync(
  providerId: string,
  numbers: NormalizedNumber[],
  health: ProviderHealth,
  makeId: (n: NormalizedNumber) => string,
): Promise<void> {
  return runDbWrite(async () => {
    const store = await readStore();
    const now = Date.now();
    const kept = store.numbers.filter((n) => n.providerId !== providerId);
    const byId = new Map(kept.map((n) => [n.id, n]));

    for (const n of numbers) {
      const id = makeId(n);
      const parsed = parsePhone({
        e164: n.e164,
        country: n.country,
        countryCode: n.countryCode,
        providerId: n.providerId,
        lineType: n.lineType,
        meta: n.meta,
      });
      byId.set(id, {
        id,
        e164: parsed.e164,
        country: parsed.countryNameZh || n.country,
        countryCode: parsed.dialCode || n.countryCode,
        dialCode: parsed.dialCode,
        nationalNumber: parsed.nationalNumber,
        countryIso: parsed.countryIso,
        countryNameZh: parsed.countryNameZh,
        flag: parsed.flag,
        lineType: parsed.lineType,
        providerId: n.providerId,
        lastSeenAt: n.lastSeenAt,
        meta: n.meta,
        updatedAt: now,
      });
    }

    store.numbers = Array.from(byId.values());
    const idx = store.health.findIndex((h) => h.id === health.id);
    if (idx >= 0) store.health[idx] = health;
    else store.health.push(health);
    await writeStore(store);
  });
}

export async function upsertNumbers(
  numbers: NormalizedNumber[],
  makeId: (n: NormalizedNumber) => string,
) {
  const store = await readStore();
  const now = Date.now();
  const byId = new Map(store.numbers.map((n) => [n.id, n]));

  for (const n of numbers) {
    const id = makeId(n);
    const parsed = parsePhone({
      e164: n.e164,
      country: n.country,
      countryCode: n.countryCode,
      providerId: n.providerId,
      lineType: n.lineType,
      meta: n.meta,
    });
    byId.set(id, {
      id,
      e164: parsed.e164,
      country: parsed.countryNameZh || n.country,
      countryCode: parsed.dialCode || n.countryCode,
      dialCode: parsed.dialCode,
      nationalNumber: parsed.nationalNumber,
      countryIso: parsed.countryIso,
      countryNameZh: parsed.countryNameZh,
      flag: parsed.flag,
      lineType: parsed.lineType,
      providerId: n.providerId,
      lastSeenAt: n.lastSeenAt,
      meta: n.meta,
      updatedAt: now,
    });
  }

  store.numbers = Array.from(byId.values());
  await writeStore(store);
}

export async function listNumbers(filters: {
  country?: string;
  provider?: string;
  q?: string;
  lineType?: string;
}): Promise<StoredNumber[]> {
  let rows = (await readStore()).numbers.map(enrichStored);

  if (filters.country) {
    rows = rows.filter(
      (n) =>
        n.country === filters.country ||
        n.countryNameZh === filters.country ||
        n.countryCode === filters.country ||
        n.dialCode === filters.country ||
        n.countryIso === filters.country,
    );
  }
  if (filters.provider) {
    rows = rows.filter((n) => n.providerId === filters.provider);
  }
  if (filters.lineType) {
    rows = rows.filter((n) => n.lineType === filters.lineType);
  }
  if (filters.q) {
    const q = filters.q.replace(/[^\d+]/g, "");
    rows = rows.filter(
      (n) =>
        n.e164.includes(q) ||
        n.nationalNumber.includes(q.replace(/^\+/, "")) ||
        n.dialCode.includes(q.replace(/^\+/, "")),
    );
  }

  return rows.sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.e164.localeCompare(b.e164));
}

export async function getNumberById(id: string): Promise<StoredNumber | null> {
  const n = (await readStore()).numbers.find((x) => x.id === id);
  return n ? enrichStored(n) : null;
}

export async function getCachedMessages(
  numberId: string,
  maxAgeMs: number,
): Promise<{ messages: NormalizedMessage[]; fetchedAt: number } | null> {
  const entry = (await readStore()).messages[numberId];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > maxAgeMs) return null;
  return entry;
}

export async function setCachedMessages(numberId: string, messages: NormalizedMessage[]) {
  return runDbWrite(async () => {
    const store = await readStore();
    store.messages[numberId] = { messages, fetchedAt: Date.now() };
    await writeStore(store);
  });
}

export async function upsertProviderHealth(health: ProviderHealth) {
  return runDbWrite(async () => {
    const store = await readStore();
    const idx = store.health.findIndex((h) => h.id === health.id);
    if (idx >= 0) store.health[idx] = health;
    else store.health.push(health);
    await writeStore(store);
  });
}

export async function listProviderHealth(): Promise<ProviderHealth[]> {
  return [...(await readStore()).health].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDistinctCountries(filters?: {
  provider?: string;
  lineType?: string;
  q?: string;
}): Promise<
  Array<{
    name: string;
    iso: string;
    flag: string;
    dialCode: string;
    count: number;
  }>
> {
  const map = new Map<
    string,
    { name: string; iso: string; flag: string; dialCode: string; count: number }
  >();
  const rows = await listNumbers({
    provider: filters?.provider,
    lineType: filters?.lineType,
    q: filters?.q,
  });
  for (const n of rows) {
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

export async function setSyncMeta(key: string, value: string) {
  return runDbWrite(async () => {
    const store = await readStore();
    store.syncMeta[key] = value;
    await writeStore(store);
  });
}

export async function getSyncMeta(key: string): Promise<string | null> {
  return (await readStore()).syncMeta[key] ?? null;
}

export async function clearProviderNumbers(providerId: string) {
  return runDbWrite(async () => {
    const store = await readStore();
    store.numbers = store.numbers.filter((n) => n.providerId !== providerId);
    await writeStore(store);
  });
}

// re-export LineType for callers that imported from db
export type { LineType };
