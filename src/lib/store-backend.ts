import fs from "fs";
import path from "path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { emptyStore, STORE_OBJECT_KEY, type StoreShape } from "./store-types";

interface KVNamespaceBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface R2Object {
  text(): Promise<string>;
}

interface R2BucketBinding {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>;
}

export interface StoreBackend {
  read(): Promise<StoreShape>;
  write(store: StoreShape): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "store.json");

function parseStore(raw: string): StoreShape {
  try {
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      numbers: parsed.numbers ?? [],
      messages: parsed.messages ?? {},
      health: parsed.health ?? [],
      syncMeta: parsed.syncMeta ?? {},
    };
  } catch {
    return emptyStore();
  }
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

class FileStoreBackend implements StoreBackend {
  async read(): Promise<StoreShape> {
    ensureDir();
    if (!fs.existsSync(DB_PATH)) return emptyStore();
    try {
      return parseStore(fs.readFileSync(DB_PATH, "utf8"));
    } catch {
      return emptyStore();
    }
  }

  async write(store: StoreShape): Promise<void> {
    ensureDir();
    const tmp = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store), "utf8");
    fs.renameSync(tmp, DB_PATH);
  }
}

class KVStoreBackend implements StoreBackend {
  constructor(private kv: KVNamespaceBinding) {}

  async read(): Promise<StoreShape> {
    const raw = await this.kv.get(STORE_OBJECT_KEY);
    if (!raw) return emptyStore();
    return parseStore(raw);
  }

  async write(store: StoreShape): Promise<void> {
    await this.kv.put(STORE_OBJECT_KEY, JSON.stringify(store));
  }
}

class R2StoreBackend implements StoreBackend {
  constructor(private bucket: R2BucketBinding) {}

  async read(): Promise<StoreShape> {
    const obj = await this.bucket.get(STORE_OBJECT_KEY);
    if (!obj) return emptyStore();
    return parseStore(await obj.text());
  }

  async write(store: StoreShape): Promise<void> {
    await this.bucket.put(STORE_OBJECT_KEY, JSON.stringify(store), {
      httpMetadata: { contentType: "application/json" },
    });
  }
}

let backendPromise: Promise<StoreBackend> | null = null;

async function resolveBackend(): Promise<StoreBackend> {
  if (process.env.STORE_BACKEND === "file") {
    return new FileStoreBackend();
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cloudflareEnv = env as {
      DATA_KV?: KVNamespaceBinding;
      DATA_BUCKET?: R2BucketBinding;
    };

    if (cloudflareEnv.DATA_KV) {
      return new KVStoreBackend(cloudflareEnv.DATA_KV);
    }
    if (cloudflareEnv.DATA_BUCKET) {
      return new R2StoreBackend(cloudflareEnv.DATA_BUCKET);
    }
  } catch {
    // 本地 next dev 没有 Cloudflare 绑定，回退到文件
  }

  return new FileStoreBackend();
}

export async function getStoreBackend(): Promise<StoreBackend> {
  if (!backendPromise) {
    backendPromise = resolveBackend();
  }
  return backendPromise;
}

/** 构建脚本等 Node 环境直接读本地文件 */
export function readLocalStoreSync(): StoreShape {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) return emptyStore();
  try {
    return parseStore(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return emptyStore();
  }
}
