import fs from "fs";
import path from "path";
import { parsePhone, type LineType } from "./phone";
import type { NormalizedMessage, NormalizedNumber, ProviderHealth } from "./providers/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "store.json");

export interface StoredNumber extends NormalizedNumber {
  id: string;
  updatedAt: number;
  nationalNumber: string;
  dialCode: string;
  countryIso: string;
  countryNameZh: string;
  flag: string;
  lineType: LineType;
}

interface StoreShape {
  numbers: StoredNumber[];
  messages: Record<string, { messages: NormalizedMessage[]; fetchedAt: number }>;
  health: ProviderHealth[];
  syncMeta: Record<string, string>;
}

const emptyStore = (): StoreShape => ({
  numbers: [],
  messages: {},
  health: [],
  syncMeta: {},
});

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): StoreShape {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) return emptyStore();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      numbers: (parsed.numbers ?? []).map(enrichStored),
      messages: parsed.messages ?? {},
      health: parsed.health ?? [],
      syncMeta: parsed.syncMeta ?? {},
    };
  } catch {
    return emptyStore();
  }
}

function enrichStored(
  n: (StoredNumber | (NormalizedNumber & { id: string; updatedAt: number })),
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

function writeStore(store: StoreShape) {
  ensureDir();
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store), "utf8");
  fs.renameSync(tmp, DB_PATH);
}

/** Serialize JSON store writes so parallel provider syncs don't clobber each other. */
let dbWriteChain: Promise<void> = Promise.resolve();

function runDbWrite<T>(fn: () => T): Promise<T> {
  const job = dbWriteChain.then(fn);
  dbWriteChain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function hasStoredNumbers(): boolean {
  return readStore().numbers.length > 0;
}

/** Read current store snapshot (build/export scripts). */
export function readStoreForExport(): StoreShape {
  return readStore();
}

/** Replace one provider's numbers + health in a single atomic write. */
export function applyProviderSync(
  providerId: string,
  numbers: NormalizedNumber[],
  health: ProviderHealth,
  makeId: (n: NormalizedNumber) => string,
): Promise<void> {
  return runDbWrite(() => {
    const store = readStore();
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
    writeStore(store);
  });
}

export function upsertNumbers(
  numbers: NormalizedNumber[],
  makeId: (n: NormalizedNumber) => string,
) {
  const store = readStore();
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
  writeStore(store);
}

export function listNumbers(filters: {
  country?: string;
  provider?: string;
  q?: string;
  lineType?: string;
}): StoredNumber[] {
  let rows = readStore().numbers.map(enrichStored);

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

export function getNumberById(id: string): StoredNumber | null {
  const n = readStore().numbers.find((x) => x.id === id);
  return n ? enrichStored(n) : null;
}

export function getCachedMessages(
  numberId: string,
  maxAgeMs: number,
): { messages: NormalizedMessage[]; fetchedAt: number } | null {
  const entry = readStore().messages[numberId];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > maxAgeMs) return null;
  return entry;
}

export function setCachedMessages(numberId: string, messages: NormalizedMessage[]) {
  const store = readStore();
  store.messages[numberId] = { messages, fetchedAt: Date.now() };
  writeStore(store);
}

export function upsertProviderHealth(health: ProviderHealth) {
  const store = readStore();
  const idx = store.health.findIndex((h) => h.id === health.id);
  if (idx >= 0) store.health[idx] = health;
  else store.health.push(health);
  writeStore(store);
}

export function listProviderHealth(): ProviderHealth[] {
  return [...readStore().health].sort((a, b) => a.name.localeCompare(b.name));
}

export function getDistinctCountries(filters?: {
  provider?: string;
  lineType?: string;
  q?: string;
}): Array<{
  name: string;
  iso: string;
  flag: string;
  dialCode: string;
  count: number;
}> {
  const map = new Map<
    string,
    { name: string; iso: string; flag: string; dialCode: string; count: number }
  >();
  const rows = listNumbers({
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

export function setSyncMeta(key: string, value: string) {
  const store = readStore();
  store.syncMeta[key] = value;
  writeStore(store);
}

export function getSyncMeta(key: string): string | null {
  return readStore().syncMeta[key] ?? null;
}

export function clearProviderNumbers(providerId: string) {
  const store = readStore();
  store.numbers = store.numbers.filter((n) => n.providerId !== providerId);
  writeStore(store);
}
