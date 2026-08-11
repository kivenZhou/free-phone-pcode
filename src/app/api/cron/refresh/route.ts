import { NextRequest, NextResponse } from "next/server";
import {
  isRefreshRunning,
  refreshProviders,
  startRefreshInBackground,
} from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cloudflare Cron / batch-continue 入口 */
export async function GET(req: NextRequest) {
  const cont =
    req.nextUrl.searchParams.get("continue") === "1" ||
    req.headers.get("x-sync-continue") === "1";

  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    // Batch continue from waitUntil also sends the cron secret when configured.
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Cron / continue on Workers: kick off and return quickly.
  if (process.env.DISABLE_BACKGROUND_REFRESH === "1") {
    const status = await startRefreshInBackground(undefined, { continue: cont });
    return NextResponse.json({ triggered: true, ...status });
  }

  if (!cont && (await isRefreshRunning())) {
    return NextResponse.json({ triggered: false, syncing: true, alreadyRunning: true });
  }

  const result = await refreshProviders(undefined, { continue: cont });
  return NextResponse.json({ triggered: true, ...result });
}
