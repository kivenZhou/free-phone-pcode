import fs from "fs";
import path from "path";
import { getNumberById, readStoreForExport, setCachedMessages } from "../src/lib/db";
import { mapPool } from "../src/lib/http";
import { getProvider, listProviderMeta } from "../src/lib/providers/registry";
import { refreshProviders } from "../src/lib/refresh";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public/static-data");
const OUT_FILE = path.join(OUT_DIR, "store.json");

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function prefetchMessages(limit: number) {
  const store = readStoreForExport();
  const targets = store.numbers.slice(0, limit);
  const concurrency = envInt("PAGES_MESSAGE_CONCURRENCY", 5);

  console.log(`Prefetching messages for ${targets.length} numbers…`);

  await mapPool(targets, concurrency, async (number) => {
    const provider = getProvider(number.providerId);
    if (!provider) return;
    try {
      const messages = await provider.listMessages(number.e164, number.meta);
      setCachedMessages(number.id, messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Messages failed for ${number.id}: ${message}`);
    }
  });
}

async function main() {
  console.log("Syncing providers for GitHub Pages static export…");
  const result = await refreshProviders();
  console.log("Sync result:", result);

  const messageLimit = envInt("PAGES_MESSAGE_LIMIT", 300);
  if (messageLimit > 0) {
    await prefetchMessages(messageLimit);
  }

  const store = readStoreForExport();
  const payload = {
    numbers: store.numbers,
    messages: store.messages,
    health: store.health,
    syncMeta: store.syncMeta,
    providers: listProviderMeta(),
    builtAt: Date.now(),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload), "utf8");
  console.log(
    `Wrote ${payload.numbers.length} numbers to ${path.relative(ROOT, OUT_FILE)}`,
  );

  // Sanity check one record for generateStaticParams
  if (payload.numbers[0]) {
    getNumberById(payload.numbers[0].id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
