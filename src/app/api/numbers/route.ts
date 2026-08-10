import { NextRequest, NextResponse } from "next/server";
import {
  getDistinctCountries,
  getSyncMeta,
  listNumbers,
  listProviderHealth,
} from "@/lib/db";
import { listProviderMeta } from "@/lib/providers/registry";
import { ensureFreshData, isRefreshRunning, startBackgroundRefresh } from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

startBackgroundRefresh();

export async function GET(req: NextRequest) {
  try {
    await ensureFreshData();
  } catch {
    // continue with cached data if refresh fails
  }

  const { searchParams } = req.nextUrl;
  const country = searchParams.get("country") || undefined;
  const provider = searchParams.get("provider") || undefined;
  const q = searchParams.get("q") || undefined;
  const lineType = searchParams.get("lineType") || undefined;

  const countries = await getDistinctCountries({ provider, lineType, q });
  const health = await listProviderHealth();
  const providers = listProviderMeta();
  const lastRefreshAt = Number((await getSyncMeta("last_refresh_at")) || 0);
  const catalogTotal = countries.reduce((sum, c) => sum + c.count, 0);

  const browseCountries = !country && !q;
  const numbers = browseCountries
    ? []
    : await listNumbers({ country, provider, q, lineType });

  return NextResponse.json({
    numbers,
    countries,
    providers,
    health,
    lastRefreshAt,
    total: browseCountries ? catalogTotal : numbers.length,
    view: browseCountries ? "countries" : "numbers",
    syncing: await isRefreshRunning(),
  });
}
