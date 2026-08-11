import {
  distinctCountries,
  filterNumbers,
  type CatalogNumber,
} from "./catalog";
import { basePath, isStaticExport, staticAssetUrl } from "./site";
import type { NormalizedMessage } from "./providers/types";

interface ProviderHealth {
  id: string;
  name: string;
  status: string;
  lastError?: string;
  numberCount?: number;
}

interface ProviderMeta {
  id: string;
  name: string;
  enabled: boolean;
  supportsMessages: boolean;
}

interface StaticStore {
  numbers: CatalogNumber[];
  messages: Record<string, { messages: NormalizedMessage[]; fetchedAt: number }>;
  health: ProviderHealth[];
  syncMeta: Record<string, string>;
  providers: ProviderMeta[];
  builtAt?: number;
}

export interface NumbersCatalogResponse {
  numbers: CatalogNumber[];
  countries: ReturnType<typeof distinctCountries>;
  providers: ProviderMeta[];
  health: ProviderHealth[];
  lastRefreshAt: number;
  total: number;
  view?: "countries" | "numbers";
  syncing?: boolean;
  staticDemo?: boolean;
  builtAt?: number;
}

export interface NumberMessagesResponse {
  number: CatalogNumber | null;
  messages: NormalizedMessage[];
  fetchedAt?: number;
  cached?: boolean;
  warning?: string;
  error?: string;
}

let staticStorePromise: Promise<StaticStore> | null = null;

async function loadStaticStore(): Promise<StaticStore> {
  if (!staticStorePromise) {
    staticStorePromise = fetch(staticAssetUrl("/static-data/store.json"), {
      cache: "no-store",
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`静态数据加载失败 (${res.status})`);
      }
      return res.json() as Promise<StaticStore>;
    });
  }
  return staticStorePromise;
}

function parseCatalogParams(queryString: string) {
  const params = new URLSearchParams(queryString);
  return {
    country: params.get("country") || undefined,
    provider: params.get("provider") || undefined,
    q: params.get("q") || undefined,
    lineType: params.get("lineType") || undefined,
  };
}

export async function fetchNumbersCatalog(
  queryString: string,
): Promise<NumbersCatalogResponse> {
  if (!isStaticExport()) {
    const res = await fetch(`${basePath()}/api/numbers?${queryString}`);
    if (!res.ok) throw new Error(`加载失败 (${res.status})`);
    return res.json() as Promise<NumbersCatalogResponse>;
  }

  const store = await loadStaticStore();
  const filters = parseCatalogParams(queryString);
  const countries = distinctCountries(store.numbers, filters);
  const catalogTotal = countries.reduce((sum, c) => sum + c.count, 0);
  const browseCountries = !filters.country && !filters.q;
  const numbers = browseCountries
    ? []
    : filterNumbers(store.numbers, filters);
  const lastRefreshAt = Number(store.syncMeta.last_refresh_at || 0);

  return {
    numbers,
    countries,
    providers: store.providers,
    health: store.health,
    lastRefreshAt,
    total: browseCountries ? catalogTotal : numbers.length,
    view: browseCountries ? "countries" : "numbers",
    syncing: false,
    staticDemo: true,
    builtAt: store.builtAt,
  };
}

export async function fetchNumberMessages(
  id: string,
  _force = false,
): Promise<NumberMessagesResponse> {
  if (!isStaticExport()) {
    const suffix = _force ? "?force=1" : "";
    const res = await fetch(
      `${basePath()}/api/numbers/${encodeURIComponent(id)}/messages${suffix}`,
    );
    const json = (await res.json()) as NumberMessagesResponse;
    if (!res.ok && !json.messages) {
      throw new Error(json.error || `加载失败 (${res.status})`);
    }
    return json;
  }

  const store = await loadStaticStore();
  const number = store.numbers.find((n) => n.id === id) ?? null;
  if (!number) {
    return { number: null, messages: [], error: "Number not found" };
  }

  const entry = store.messages[id];
  return {
    number,
    messages: entry?.messages ?? [],
    fetchedAt: entry?.fetchedAt,
    cached: true,
    warning: entry
      ? undefined
      : "静态演示站点：该号码暂无构建时缓存的短信快照。完整功能请自行部署 Node 版。",
  };
}

export async function triggerRefresh(): Promise<{
  started?: boolean;
  syncing?: boolean;
}> {
  if (isStaticExport()) return {};
  const res = await fetch(`${basePath()}/api/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`同步请求失败 (${res.status})`);
  }
  return (await res.json()) as { started?: boolean; syncing?: boolean };
}
